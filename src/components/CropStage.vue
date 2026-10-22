<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Cropper from 'cropperjs'
import {
  PhArrowCounterClockwise as ArrowCounterClockwise,
  PhLockSimple as LockSimple,
  PhPlus as Plus,
  PhUploadSimple as UploadSimple,
} from '@phosphor-icons/vue'
import { CROP_RATIO } from '../lib/constants'
import { t } from '../lib/i18n'
import { formatPixels } from '../lib/image'

const props = defineProps({
  image: {
    type: Object,
    default: null,
  },
  target: {
    type: Object,
    required: true,
  },
  imageCount: {
    type: Number,
    default: 0,
  },
  maxImages: {
    type: Number,
    default: 5,
  },
  isBusy: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'crop-change',
  'crop-error',
  'files-selected',
  'ready',
])

const CROPPER_TEMPLATE = `
  <cropper-canvas>
    <cropper-image
      rotatable="false"
      scalable
      translatable
      min-fit="contain"
    ></cropper-image>
    <cropper-shade theme-color="rgba(7, 8, 6, 0.64)"></cropper-shade>
    <cropper-handle action="move" plain></cropper-handle>
    <cropper-selection
      aspect-ratio="1.6"
      movable
      resizable
      precise
    >
      <cropper-grid
        role="grid"
        bordered
        covered
        theme-color="rgba(255, 255, 255, 0.28)"
      ></cropper-grid>
      <cropper-handle
        action="move"
        theme-color="rgba(255, 255, 255, 0.001)"
      ></cropper-handle>
      <cropper-handle action="n-resize" theme-color="#ff5a2f"></cropper-handle>
      <cropper-handle action="e-resize" theme-color="#ff5a2f"></cropper-handle>
      <cropper-handle action="s-resize" theme-color="#ff5a2f"></cropper-handle>
      <cropper-handle action="w-resize" theme-color="#ff5a2f"></cropper-handle>
      <cropper-handle action="ne-resize" theme-color="#ff5a2f"></cropper-handle>
      <cropper-handle action="nw-resize" theme-color="#ff5a2f"></cropper-handle>
      <cropper-handle action="se-resize" theme-color="#ff5a2f"></cropper-handle>
      <cropper-handle action="sw-resize" theme-color="#ff5a2f"></cropper-handle>
    </cropper-selection>
  </cropper-canvas>
`

const fileInput = ref(null)
const hostEl = ref(null)
const sourceImage = ref(null)
const isReady = ref(false)
const initError = ref('')
const dragging = ref(false)
const metrics = ref(null)
const canAdd = computed(
  () => !props.isBusy && props.imageCount < props.maxImages,
)
const isFull = computed(() => props.imageCount >= props.maxImages)
const cropStates = new Map()

let cropper = null
let selection = null
let canvas = null
let cropperImage = null
let resizeObserver = null
let dragDepth = 0
let clampScheduled = false
let resizeTimer = 0
let metricsTimer = 0
let lastSurfaceSize = null
let initToken = 0

function emitReady(value) {
  isReady.value = value
  emit('ready', value)
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function waitForImage(image) {
  if (image.complete && image.naturalWidth > 0) {
    return image.decode?.().catch(() => {}) ?? Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const onLoad = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('无法在这个浏览器中读取截图。'))
    }
    const cleanup = () => {
      image.removeEventListener('load', onLoad)
      image.removeEventListener('error', onError)
    }

    image.addEventListener('load', onLoad)
    image.addEventListener('error', onError)
  }).then(() => image.decode?.().catch(() => {}))
}

function captureCropState(id) {
  if (!id || !selection || !cropperImage || !canvas || !isReady.value) return
  const canvasRect = canvas.getBoundingClientRect()
  if (!canvasRect.width || !canvasRect.height) return

  cropStates.set(id, {
    transform: cropperImage.$getTransform(),
    selection: {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    },
    canvasWidth: canvasRect.width,
    canvasHeight: canvasRect.height,
  })
}

function restoreCropState() {
  if (!props.image || !cropperImage || !selection) return false
  const saved = cropStates.get(props.image.id)
  const canvasRect = canvas?.getBoundingClientRect()
  if (!saved || !canvasRect) return false

  if (
    Math.abs(canvasRect.width - saved.canvasWidth) > 2 ||
    Math.abs(canvasRect.height - saved.canvasHeight) > 2
  ) {
    return false
  }

  cropperImage.$setTransform(...saved.transform)
  selection.$change(
    saved.selection.x,
    saved.selection.y,
    saved.selection.width,
    saved.selection.height,
    CROP_RATIO,
    true,
  )
  return true
}

function getImageBounds() {
  if (!canvas || !cropperImage) return null

  const canvasRect = canvas.getBoundingClientRect()
  const imageRect = cropperImage.getBoundingClientRect()
  const left = Math.max(0, imageRect.left - canvasRect.left)
  const top = Math.max(0, imageRect.top - canvasRect.top)
  const right = Math.min(canvasRect.width, imageRect.right - canvasRect.left)
  const bottom = Math.min(canvasRect.height, imageRect.bottom - canvasRect.top)
  const width = right - left
  const height = bottom - top

  if (width < 4 || height < 4) return null
  return { left, top, width, height }
}

function setInitialSelection() {
  if (!selection) return
  const bounds = getImageBounds()
  if (!bounds) return

  const coverage = 0.9
  let width = bounds.width * coverage
  let height = width / CROP_RATIO

  if (height > bounds.height * coverage) {
    height = bounds.height * coverage
    width = height * CROP_RATIO
  }

  const x = bounds.left + (bounds.width - width) / 2
  const y = bounds.top + (bounds.height - height) / 2
  selection.$change(x, y, width, height, CROP_RATIO, true)
}

function clampSelection() {
  if (!selection || !isReady.value) return
  const bounds = getImageBounds()
  if (!bounds) return

  let width = Math.min(selection.width, bounds.width)
  let height = width / CROP_RATIO

  if (height > bounds.height) {
    height = bounds.height
    width = height * CROP_RATIO
  }

  if (width < 24 || height < 15) return

  const x = Math.min(
    Math.max(selection.x, bounds.left),
    bounds.left + bounds.width - width,
  )
  const y = Math.min(
    Math.max(selection.y, bounds.top),
    bounds.top + bounds.height - height,
  )

  const changed =
    Math.abs(x - selection.x) > 0.5 ||
    Math.abs(y - selection.y) > 0.5 ||
    Math.abs(width - selection.width) > 0.5 ||
    Math.abs(height - selection.height) > 0.5

  if (changed) {
    selection.$change(x, y, width, height, CROP_RATIO, true)
  }
}

function updateMetrics() {
  if (!selection || !cropperImage) return

  const matrix = cropperImage.$getTransform()
  const scale = Math.abs(matrix[0]) || 1
  const width = Math.max(1, Math.round(selection.width / scale))
  const height = Math.max(1, Math.round(selection.height / scale))
  metrics.value = { width, height }
  emit('crop-change', metrics.value)
}

function scheduleClamp() {
  if (clampScheduled) return
  clampScheduled = true
  requestAnimationFrame(() => {
    clampScheduled = false
    clampSelection()
    updateMetrics()
  })
}

function scheduleMetrics() {
  window.clearTimeout(metricsTimer)
  metricsTimer = window.setTimeout(() => {
    clampSelection()
    updateMetrics()
  }, 90)
}

function handleSelectionChange() {
  scheduleClamp()
}

function handleWheel() {
  scheduleMetrics()
}

function handleActionEnd() {
  clampSelection()
  updateMetrics()
}

function bindEvents() {
  selection?.addEventListener('change', handleSelectionChange)
  canvas?.addEventListener('wheel', handleWheel, { passive: true })
  canvas?.addEventListener('actionend', handleActionEnd)
}

function unbindEvents() {
  selection?.removeEventListener('change', handleSelectionChange)
  canvas?.removeEventListener('wheel', handleWheel)
  canvas?.removeEventListener('actionend', handleActionEnd)
}

function cleanupCropper() {
  unbindEvents()
  resizeObserver?.disconnect()
  resizeObserver = null
  window.clearTimeout(resizeTimer)
  window.clearTimeout(metricsTimer)

  if (cropper) {
    cropper.destroy()
    cropper = null
  }

  selection = null
  canvas = null
  cropperImage = null
  metrics.value = null
  lastSurfaceSize = null
  dragDepth = 0
  dragging.value = false
  emitReady(false)
}

function observeResize() {
  if (!hostEl.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect
    if (!box) return

    if (!lastSurfaceSize) {
      lastSurfaceSize = { width: box.width, height: box.height }
      return
    }

    const changed =
      Math.abs(box.width - lastSurfaceSize.width) > 24 ||
      Math.abs(box.height - lastSurfaceSize.height) > 24

    if (!changed) return
    lastSurfaceSize = { width: box.width, height: box.height }

    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(async () => {
      if (!cropperImage || !isReady.value) return
      cropStates.clear()
      cropperImage.$center('contain')
      await nextFrame()
      setInitialSelection()
      updateMetrics()
    }, 160)
  })
  resizeObserver.observe(hostEl.value)
}

async function initCropper() {
  if (!props.image || !hostEl.value || !sourceImage.value) return
  initError.value = ''

  try {
    await waitForImage(sourceImage.value)
    await nextTick()

    const host = hostEl.value
    if (!host) return

    cropper = new Cropper(sourceImage.value, {
      container: host,
      template: CROPPER_TEMPLATE,
    })

    canvas = cropper.getCropperCanvas()
    cropperImage = cropper.getCropperImage()
    selection = cropper.getCropperSelection()

    if (!canvas || !cropperImage || !selection) {
      throw new Error('裁剪组件未能初始化。')
    }

    selection.aspectRatio = CROP_RATIO
    cropperImage.$center('contain')
    await nextFrame()
    await nextFrame()

    if (!restoreCropState()) setInitialSelection()
    bindEvents()
    observeResize()
    updateMetrics()
    emitReady(true)
  } catch {
    cleanupCropper()
    initError.value = 'stage.initFailed'
    emit('crop-error', { key: initError.value })
  }
}

async function retryCrop() {
  const token = ++initToken
  initError.value = ''
  await nextTick()
  await initCropper(token)
}

async function resetCrop() {
  if (!cropperImage || !isReady.value) return
  cropperImage.$center('contain')
  await nextFrame()
  setInitialSelection()
  updateMetrics()
}

async function renderExport() {
  if (!isReady.value || !selection) {
    throw new Error('画布还在准备中，请稍候再试。')
  }

  await nextTick()
  const cropped = await selection.$toCanvas({
    width: props.target.width,
    height: props.target.height,
    beforeDraw(context, targetCanvas) {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, targetCanvas.width, targetCanvas.height)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
    },
  })

  // Cropper sizes its result from the live selection ratio. Guard the output
  // against sub-pixel rounding so the downloaded file is always exact.
  if (
    cropped.width === props.target.width &&
    cropped.height === props.target.height
  ) {
    return cropped
  }

  const exact = document.createElement('canvas')
  exact.width = props.target.width
  exact.height = props.target.height
  const context = exact.getContext('2d')
  if (!context) throw new Error('浏览器无法创建导出画布。')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, exact.width, exact.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(cropped, 0, 0, exact.width, exact.height)
  return exact
}

function openFilePicker() {
  if (!canAdd.value) return
  fileInput.value?.click()
}

function onFileInput(event) {
  const files = Array.from(event.target.files ?? [])
  event.target.value = ''
  if (files.length) emit('files-selected', files)
}

function onDragEnter(event) {
  if (props.isBusy) return
  const types = Array.from(event.dataTransfer?.types ?? [])
  if (!types.includes('Files')) return
  dragDepth += 1
  dragging.value = true
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

function onDrop(event) {
  dragDepth = 0
  dragging.value = false
  if (props.isBusy) return
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length) emit('files-selected', files)
}

watch(
  () => props.image,
  async (nextImage, previousImage) => {
    if (previousImage) captureCropState(previousImage.id)
    const token = ++initToken
    cleanupCropper()
    initError.value = ''
    if (!nextImage) return
    await nextTick()
    await initCropper(token)
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  initToken += 1
  cleanupCropper()
})

defineExpose({ renderExport, resetCrop })
</script>

<template>
  <section class="stage-panel" aria-labelledby="stage-title">
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
      multiple
      :disabled="!canAdd"
      :aria-label="t('app.fileInputAria')"
      @change="onFileInput"
    />

    <header class="stage-head">
      <div class="stage-heading">
        <span class="stage-eyebrow">{{ t('stage.eyebrow') }}</span>
        <h2 id="stage-title">{{ t('stage.title') }}</h2>
      </div>

      <div class="stage-actions">
        <span class="stage-hint">{{ t('stage.hint') }}</span>
        <button
          v-if="image"
          class="stage-add-button"
          type="button"
          :disabled="!canAdd"
          :title="isFull ? t('stage.limitTitle', { max: maxImages }) : t('stage.addImages')"
          :aria-label="isFull ? t('stage.limitTitle', { max: maxImages }) : t('stage.addImages')"
          @click="openFilePicker"
        >
          <Plus :size="13" weight="bold" aria-hidden="true" />
          <span>{{ isFull ? t('stage.limitReached') : t('stage.addImages') }}</span>
          <span class="stage-add-count">{{ imageCount }}/{{ maxImages }}</span>
        </button>
        <span class="ratio-badge">
          <LockSimple :size="13" weight="bold" aria-hidden="true" />
          16:10
        </span>
        <button
          v-if="image"
          class="stage-icon-button"
          type="button"
          :title="t('stage.reset')"
          :aria-label="t('stage.reset')"
          :disabled="!isReady"
          @click="resetCrop"
        >
          <ArrowCounterClockwise :size="17" weight="bold" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div class="crop-shell">
      <div
        class="crop-surface"
        :class="{ 'is-dragging': dragging, 'is-ready': isReady }"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <button
          v-if="!image"
          class="stage-empty"
          type="button"
          :disabled="!canAdd"
          @click="openFilePicker"
        >
          <span class="corner-mark corner-mark--tl" aria-hidden="true"></span>
          <span class="corner-mark corner-mark--tr" aria-hidden="true"></span>
          <span class="corner-mark corner-mark--bl" aria-hidden="true"></span>
          <span class="corner-mark corner-mark--br" aria-hidden="true"></span>

          <span class="empty-icon">
            <UploadSimple :size="26" weight="light" aria-hidden="true" />
          </span>
          <span class="empty-title">
            {{ isBusy ? t('stage.importing') : t('stage.emptyTitle') }}
          </span>
          <span class="empty-copy">{{ t('stage.emptyCopy') }}</span>
          <span class="empty-meta">{{ t('stage.emptyMeta', { max: maxImages }) }}</span>
        </button>

        <div v-else ref="hostEl" class="cropper-host">
          <img
            ref="sourceImage"
            class="cropper-source"
            :src="image.url"
            :alt="t('stage.alt')"
          />
        </div>

        <div v-if="image && !isReady" class="stage-loading" role="status">
          <template v-if="initError">
            <span class="stage-error-copy">{{ t(initError) }}</span>
            <button class="stage-retry" type="button" @click="retryCrop">
              {{ t('stage.retry') }}
            </button>
          </template>
          <template v-else>
            <span class="loading-line" aria-hidden="true"></span>
            <span>{{ t('stage.loading') }}</span>
          </template>
        </div>

        <div v-if="dragging" class="drop-overlay" aria-hidden="true">
          <UploadSimple :size="28" weight="light" />
          <span>{{ t('stage.dropOverlay') }}</span>
        </div>
      </div>
    </div>

    <footer class="stage-foot">
      <div class="stage-metric">
        <span class="metric-label">{{ t('stage.cropArea') }}</span>
        <span class="metric-value">
          {{ metrics ? `${formatPixels(metrics.width)} × ${formatPixels(metrics.height)} px` : t('stage.waiting') }}
        </span>
      </div>

      <span class="metric-rule" aria-hidden="true"></span>

      <div class="stage-metric">
        <span class="metric-label">{{ t('stage.output') }}</span>
        <span class="metric-value metric-value--accent">
          {{ target.label }} px
        </span>
      </div>

      <div class="stage-foot-note">
        <span class="status-dot" aria-hidden="true"></span>
        {{ t('stage.flatten') }}
      </div>
    </footer>
  </section>
</template>

<style scoped>
.stage-panel {
  display: flex;
  min-width: 0;
  min-height: 540px;
  height: calc(100dvh - 132px);
  max-height: 860px;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  overflow: hidden;
  color: var(--paper);
  background:
    radial-gradient(circle at 76% 14%, rgba(255, 255, 255, 0.06), transparent 30%),
    var(--stage);
  border: 1px solid #2b2c27;
  border-radius: var(--radius-stage);
  box-shadow:
    0 22px 50px -30px rgba(23, 24, 21, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}

.stage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 38px;
  padding: 0 2px;
}

.stage-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.stage-eyebrow {
  color: rgba(245, 243, 235, 0.6);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.stage-heading h2 {
  margin: 0;
  color: var(--paper);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.stage-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stage-hint {
  color: rgba(245, 243, 235, 0.58);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.stage-add-button {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  color: rgba(245, 243, 235, 0.78);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
}

.stage-add-button:hover:not(:disabled) {
  color: var(--paper);
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.24);
}

.stage-add-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.stage-add-count {
  color: rgba(245, 243, 235, 0.4);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.ratio-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  color: rgba(245, 243, 235, 0.82);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
}

.stage-icon-button {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  color: rgba(245, 243, 235, 0.64);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
}

.stage-icon-button:hover:not(:disabled) {
  color: var(--paper);
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.2);
}

.stage-icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.crop-shell {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
}

.crop-surface {
  position: relative;
  width: 100%;
  max-width: calc((100dvh - 300px) * 1.6);
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.055), transparent 58%),
    #10110e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.25),
    inset 0 0 60px rgba(0, 0, 0, 0.28);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.crop-surface.is-dragging {
  border-color: var(--accent);
  box-shadow:
    inset 0 0 0 1px var(--accent),
    inset 0 0 80px rgba(255, 90, 47, 0.1);
}

.stage-empty {
  position: relative;
  display: flex;
  width: 100%;
  cursor: pointer;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--paper);
  background: transparent;
  border: 0;
  border-radius: inherit;
  text-align: center;
  transition: background 180ms ease;
}

.stage-empty:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.012);
}

.stage-empty:disabled {
  cursor: wait;
}

.stage-empty::before {
  position: absolute;
  inset: 20px;
  pointer-events: none;
  content: '';
  border: 1px dashed rgba(245, 243, 235, 0.17);
  border-radius: 5px;
  transition: border-color 180ms ease;
}

.stage-empty:hover:not(:disabled)::before {
  border-color: rgba(255, 90, 47, 0.55);
}

.empty-icon {
  display: grid;
  width: 52px;
  height: 52px;
  margin-bottom: 5px;
  place-items: center;
  color: rgba(245, 243, 235, 0.82);
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    transform 180ms ease;
}

.stage-empty:hover:not(:disabled) .empty-icon {
  color: var(--accent);
  border-color: rgba(255, 90, 47, 0.42);
  transform: translateY(-2px);
}

.empty-title {
  font-size: 18px;
  font-weight: 560;
  letter-spacing: -0.025em;
}

.empty-copy {
  max-width: 34ch;
  color: rgba(245, 243, 235, 0.64);
  font-size: 10px;
  line-height: 1.55;
  letter-spacing: 0.01em;
}

.empty-meta {
  margin-top: 2px;
  color: rgba(245, 243, 235, 0.43);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.035em;
}

.corner-mark {
  position: absolute;
  z-index: 1;
  width: 16px;
  height: 16px;
  pointer-events: none;
  border-color: rgba(245, 243, 235, 0.64);
  border-style: solid;
}

.corner-mark--tl {
  top: 30px;
  left: 30px;
  border-width: 1px 0 0 1px;
}

.corner-mark--tr {
  top: 30px;
  right: 30px;
  border-width: 1px 1px 0 0;
}

.corner-mark--bl {
  bottom: 30px;
  left: 30px;
  border-width: 0 0 1px 1px;
}

.corner-mark--br {
  right: 30px;
  bottom: 30px;
  border-width: 0 1px 1px 0;
}

.cropper-host {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
}

.cropper-source {
  display: block;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.stage-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  color: rgba(245, 243, 235, 0.6);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  background: rgba(16, 17, 14, 0.72);
  backdrop-filter: blur(6px);
}

.stage-error-copy {
  max-width: 34ch;
  color: rgba(245, 243, 235, 0.76);
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0;
  text-align: center;
}

.stage-retry {
  padding: 6px 12px;
  color: var(--paper);
  font-size: 10px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  transition:
    background 150ms ease,
    border-color 150ms ease;
}

.stage-retry:hover {
  background: rgba(255, 255, 255, 0.13);
  border-color: rgba(255, 255, 255, 0.3);
}

.loading-line {
  position: relative;
  display: block;
  width: 92px;
  height: 1px;
  overflow: hidden;
  background: rgba(245, 243, 235, 0.14);
}

.loading-line::after {
  position: absolute;
  top: 0;
  left: 0;
  width: 40%;
  height: 100%;
  content: '';
  background: var(--accent);
  animation: loading-sweep 1s ease-in-out infinite;
}

.drop-overlay {
  position: absolute;
  inset: 12px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  color: var(--paper);
  font-size: 15px;
  pointer-events: none;
  font-weight: 540;
  background: rgba(16, 17, 14, 0.84);
  border: 1px dashed rgba(255, 90, 47, 0.8);
  border-radius: 7px;
  backdrop-filter: blur(4px);
}

.stage-foot {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 14px;
  padding: 0 3px;
}

.stage-metric {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.metric-label {
  color: rgba(245, 243, 235, 0.56);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.metric-value {
  overflow: hidden;
  color: rgba(245, 243, 235, 0.84);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-value--accent {
  color: #ff7a57;
}

.metric-rule {
  width: 1px;
  height: 22px;
  background: rgba(255, 255, 255, 0.09);
}

.stage-foot-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: rgba(245, 243, 235, 0.62);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.status-dot {
  width: 5px;
  height: 5px;
  background: #68a985;
  border-radius: 50%;
}

:deep(cropper-canvas) {
  width: 100% !important;
  height: 100% !important;
  min-width: 0;
  min-height: 0;
  background: transparent !important;
}

:deep(cropper-image) {
  box-shadow: 0 18px 56px rgba(0, 0, 0, 0.34);
}

:deep(cropper-shade) {
  pointer-events: none;
}

:deep(cropper-selection) {
  outline: 1.5px dashed rgba(255, 255, 255, 0.92);
  outline-offset: -1.5px;
}

:deep(cropper-handle[action='move']) {
  cursor: grab;
}

:deep(cropper-handle[action='move']:active) {
  cursor: grabbing;
}

:deep(cropper-grid) {
  opacity: 0.72;
}

@keyframes loading-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}

@media (min-width: 921px) and (max-height: 840px) {
  .stage-panel {
    height: calc(100dvh - 108px);
    min-height: 500px;
  }

  .crop-surface {
    max-width: calc((100dvh - 252px) * 1.6);
  }
}

@media (max-width: 1100px) {
  .stage-panel {
    height: calc(100dvh - 112px);
    min-height: 480px;
  }

  .stage-hint {
    display: none;
  }

  .crop-surface {
    max-width: calc((100dvh - 280px) * 1.6);
  }
}

@media (max-width: 920px) {
  .stage-panel {
    height: auto;
    min-height: 0;
    gap: 14px;
    padding: 14px;
    border-radius: 18px;
  }

  .crop-shell {
    width: 100%;
  }

  .crop-surface {
    width: 100%;
    max-width: none;
  }

  .stage-head {
    min-height: 34px;
  }

  .stage-hint {
    display: none;
  }

  .stage-foot {
    flex-wrap: wrap;
    gap: 10px 14px;
  }

  .stage-foot-note {
    margin-left: 0;
  }
}

@media (max-width: 560px) {
  .stage-eyebrow {
    display: none;
  }

  .stage-add-button {
    width: 28px;
    justify-content: center;
    padding: 0;
  }

  .stage-add-button > span {
    display: none;
  }

  .stage-heading h2 {
    font-size: 13px;
  }

  .empty-title {
    font-size: 16px;
  }

  .empty-copy {
    flex-wrap: wrap;
    justify-content: center;
    font-size: 9px;
  }

  .empty-meta {
    font-size: 7.5px;
  }

  .stage-empty::before {
    inset: 12px;
  }

  .corner-mark {
    display: none;
  }

  .stage-foot-note {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stage-icon-button,
  .stage-add-button,
  .stage-empty,
  .stage-empty::before,
  .empty-icon,
  .crop-surface {
    transition: none;
  }

  .loading-line::after {
    width: 100%;
    animation: none;
    opacity: 0.65;
  }
}
</style>
