<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  PhArrowUpRight as ArrowUpRight,
  PhCaretDown as CaretDown,
  PhCheckCircle as CheckCircle,
  PhDownloadSimple as DownloadSimple,
  PhGithubLogo as GithubLogo,
  PhInfo as Info,
  PhLockSimple as LockSimple,
  PhWarningCircle as WarningCircle,
  PhX as X,
} from '@phosphor-icons/vue'
import CropStage from './components/CropStage.vue'
import ImageLibrary from './components/ImageLibrary.vue'
import SpecDialog from './components/SpecDialog.vue'
import {
  DEFAULT_TARGET_INDEX,
  MAX_FILE_BYTES,
  MAX_IMAGES,
  TARGETS,
} from './lib/constants'
import { locale, setLocale, t } from './lib/i18n'
import {
  assertSourceDimensions,
  detectTransparency,
  downloadBlob,
  encodeJpeg,
  encodeRgbPng,
  formatBytes,
  formatPixels,
  loadImage,
  validateFile,
} from './lib/image'

const stageRef = ref(null)
const specRef = ref(null)

const images = ref([])
const activeId = ref(null)
const targetIndex = ref(DEFAULT_TARGET_INDEX)
const format = ref('jpeg')
const importErrors = ref([])
const isLoadingFiles = ref(false)
const isExporting = ref(false)
const cropReady = ref(false)
const cropMetrics = ref(null)
const toast = ref(null)
const lastExport = ref(null)

let nextImageId = 1
let nextErrorId = 1
let importToken = 0
let toastTimer = 0

const activeImage = computed(
  () => images.value.find((item) => item.id === activeId.value) ?? null,
)
const target = computed(() => TARGETS[targetIndex.value])
const isLocked = computed(
  () => isLoadingFiles.value || isExporting.value,
)
const canExport = computed(
  () =>
    Boolean(activeImage.value) &&
    cropReady.value &&
    !isExporting.value &&
    !isLoadingFiles.value,
)

const upscaleWarning = computed(() => {
  if (!cropMetrics.value) return ''
  const scale = Math.max(
    target.value.width / cropMetrics.value.width,
    target.value.height / cropMetrics.value.height,
  )
  if (!Number.isFinite(scale) || scale <= 1.02) return ''
  return t('app.upscaleWarning', {
    width: formatPixels(cropMetrics.value.width),
    height: formatPixels(cropMetrics.value.height),
    scale: scale.toFixed(1),
  })
})

const exportFootnote = computed(() => {
  if (lastExport.value) {
    return t('app.exportFootLast', {
      filename: lastExport.value.filename,
      size: formatBytes(lastExport.value.size),
    })
  }
  if (!activeImage.value) return t('app.exportFootIdle')
  if (!cropReady.value) return t('app.exportFootPreparing')
  if (format.value === 'jpeg') return t('app.exportFootJpeg')
  return t('app.exportFootPng')
})

const exportButtonLabel = computed(() => {
  if (isExporting.value) return t('app.exporting')
  if (!activeImage.value) return t('app.export')
  if (!cropReady.value) return t('app.preparing')
  return t('app.export')
})

const toastRole = computed(() => (toast.value?.tone === 'error' ? 'alert' : 'status'))

function showToast({ title, detail, tone = 'success' }) {
  window.clearTimeout(toastTimer)
  toast.value = { title, detail, tone }
  toastTimer = window.setTimeout(
    () => {
      toast.value = null
    },
    tone === 'error' ? 7600 : 5600,
  )
}

function dismissToast() {
  window.clearTimeout(toastTimer)
  toast.value = null
}

function revokeLater(url) {
  if (!url) return
  window.setTimeout(() => URL.revokeObjectURL(url), 400)
}

function resetImportErrors() {
  importErrors.value = []
}

function fileImportError(file, error) {
  return {
    id: `import-error-${nextErrorId++}`,
    name: file?.name || '',
    key: error?.i18nKey || 'errors.readFailed',
    params: error?.i18nParams || {},
  }
}

async function handleFiles(files) {
  if (isLoadingFiles.value || isExporting.value) return

  const selectedFiles = Array.from(files || []).filter(
    (file) => file instanceof File,
  )
  if (!selectedFiles.length) return

  resetImportErrors()

  const slots = Math.max(0, MAX_IMAGES - images.value.length)
  if (slots === 0) {
    importErrors.value = [
      {
        id: `import-error-${nextErrorId++}`,
        name: '',
        key: 'errors.listFull',
        params: { max: MAX_IMAGES },
      },
    ]
    showToast({
      title: t('toast.importFailed'),
      detail: t('errors.listFull', { max: MAX_IMAGES }),
      tone: 'error',
    })
    return
  }

  const acceptedFiles = selectedFiles.slice(0, slots)
  const errors = []

  if (selectedFiles.length > acceptedFiles.length) {
    errors.push({
      id: `import-error-${nextErrorId++}`,
      name: '',
      key: 'errors.batchLimit',
      params: { max: MAX_IMAGES, count: acceptedFiles.length },
    })
  }

  const token = ++importToken
  isLoadingFiles.value = true

  try {
    const nextImages = []

    for (const file of acceptedFiles) {
      let objectUrl = ''

      try {
        await validateFile(file)
        objectUrl = URL.createObjectURL(file)
        const decoded = await loadImage(objectUrl)
        assertSourceDimensions(decoded.naturalWidth, decoded.naturalHeight)
        const transparency = await detectTransparency(decoded)

        nextImages.push({
          id: `image-${nextImageId++}`,
          name: file.name || 'screenshot',
          mime: file.type,
          size: file.size,
          width: decoded.naturalWidth,
          height: decoded.naturalHeight,
          url: objectUrl,
          transparent: transparency.transparent,
          scanSampled: transparency.sampled,
        })
        objectUrl = ''
      } catch (error) {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        errors.push(fileImportError(file, error))
      }
    }

    if (token !== importToken) {
      nextImages.forEach((item) => URL.revokeObjectURL(item.url))
      return
    }

    if (nextImages.length) {
      images.value = [...images.value, ...nextImages]
      activeId.value = nextImages[0].id
      cropMetrics.value = null
      cropReady.value = false
      lastExport.value = null
    }

    importErrors.value = errors

    if (errors.length) {
      showToast({
        title: nextImages.length
          ? t('toast.importPartial')
          : t('toast.importFailed'),
        detail: t('library.errorsTitle', { count: errors.length }),
        tone: nextImages.length ? 'warning' : 'error',
      })
    }
  } finally {
    if (token === importToken) isLoadingFiles.value = false
  }
}

function selectImage(id) {
  if (isLocked.value || id === activeId.value) return
  if (!images.value.some((item) => item.id === id)) return

  activeId.value = id
  cropMetrics.value = null
  cropReady.value = false
  lastExport.value = null
}

function removeImage(id) {
  if (isLocked.value) return

  const index = images.value.findIndex((item) => item.id === id)
  if (index < 0) return

  const [removed] = images.value.splice(index, 1)
  if (activeId.value === id) {
    const next = images.value[index] || images.value[index - 1] || null
    activeId.value = next?.id ?? null
    cropMetrics.value = null
    cropReady.value = false
    lastExport.value = null
  }
  revokeLater(removed.url)
}

function onCropChange(nextMetrics) {
  cropMetrics.value = nextMetrics
}

function onCropReady(value) {
  cropReady.value = value
}

function onCropError(errorInfo) {
  showToast({
    title: t('toast.canvasFailed'),
    detail: t(errorInfo?.key || 'stage.initFailed'),
    tone: 'error',
  })
}

async function exportScreenshot() {
  if (!canExport.value || !stageRef.value) return

  isExporting.value = true
  await nextTick()
  await new Promise((resolve) => requestAnimationFrame(() => resolve()))

  try {
    const canvas = await stageRef.value.renderExport()
    let blob
    let quality = null
    let filename

    if (format.value === 'jpeg') {
      const encoded = await encodeJpeg(canvas)
      blob = encoded.blob
      quality = encoded.quality
      filename = `screenshot_${target.value.width}x${target.value.height}.jpg`
    } else {
      blob = encodeRgbPng(canvas)
      filename = `screenshot_${target.value.width}x${target.value.height}.png`
    }

    downloadBlob(blob, filename)
    lastExport.value = { filename, size: blob.size, quality }

    const oversize = blob.size > MAX_FILE_BYTES
    const detailParts = [
      t('toast.exportDetail', {
        filename,
        size: formatBytes(blob.size),
      }),
    ]
    if (quality !== null && quality < 0.92) {
      detailParts.push(
        t('toast.qualityReduced', { quality: Math.round(quality * 100) }),
      )
    }
    if (oversize) {
      detailParts.push(t('toast.oversizeHint'))
    }

    showToast({
      title: oversize ? t('toast.exportedOversize') : t('toast.exported'),
      detail: detailParts.join(' · '),
      tone: oversize ? 'warning' : 'success',
    })
  } catch (error) {
    showToast({
      title: t('toast.exportFailed'),
      detail: error?.i18nKey
        ? t(error.i18nKey, error.i18nParams)
        : t('errors.exportFailed'),
      tone: 'error',
    })
  } finally {
    isExporting.value = false
  }
}

watch([targetIndex, format], () => {
  lastExport.value = null
})

watch(activeId, () => {
  lastExport.value = null
})

watch(locale, () => {
  dismissToast()
})

onBeforeUnmount(() => {
  importToken += 1
  window.clearTimeout(toastTimer)
  images.value.forEach((item) => URL.revokeObjectURL(item.url))
})
</script>

<template>
  <div class="app-shell" :class="`locale-${locale}`">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <span class="brand-frame"></span>
          <span class="brand-dot"></span>
        </span>
        <span class="brand-name">framecheck</span>
        <span class="brand-divider" aria-hidden="true"></span>
        <span class="brand-descriptor">{{ t('brand.descriptor') }}</span>
      </div>

      <div class="topbar-actions">
        <span class="local-status">
          <LockSimple :size="13" weight="bold" aria-hidden="true" />
          <span>{{ t('topbar.local') }}</span>
        </span>
        <div
          class="locale-switch"
          role="group"
          :aria-label="t('locale.groupLabel')"
        >
          <button
            class="locale-option"
            :class="{ 'is-active': locale === 'zh' }"
            type="button"
            data-locale="zh"
            :aria-label="t('locale.zhLabel')"
            :aria-pressed="locale === 'zh'"
            @click="setLocale('zh')"
          >
            中
          </button>
          <button
            class="locale-option"
            :class="{ 'is-active': locale === 'en' }"
            type="button"
            data-locale="en"
            :aria-label="t('locale.enLabel')"
            :aria-pressed="locale === 'en'"
            @click="setLocale('en')"
          >
            EN
          </button>
        </div>
        <a
          class="repo-button"
          href="https://github.com/cnliucheng/TopPicture"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('topbar.githubAria')"
          :title="t('topbar.githubTitle')"
        >
          <GithubLogo :size="14" weight="bold" aria-hidden="true" />
          <span>GitHub</span>
        </a>
        <button
          class="spec-button"
          type="button"
          :aria-label="t('topbar.spec')"
          @click="specRef?.open()"
        >
          <Info :size="14" weight="bold" aria-hidden="true" />
          <span>{{ t('topbar.spec') }}</span>
          <ArrowUpRight :size="12" weight="bold" aria-hidden="true" />
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="control-panel" aria-labelledby="page-title">
        <div class="intro">
          <p class="eyebrow">
            <span class="eyebrow-mark" aria-hidden="true"></span>
            {{ t('intro.eyebrow') }}
          </p>
          <h1 id="page-title">{{ t('intro.titleLead') }}<span>{{ t('intro.titleAccent') }}</span><em>.</em></h1>
          <p class="lede">{{ t('intro.lede') }}</p>
        </div>

        <div class="control-stack">
          <section class="control-step" aria-labelledby="step-library">
            <div class="step-head">
              <span class="step-index">01</span>
              <h2 id="step-library">{{ t('library.title') }}</h2>
              <span class="step-note">
                {{ isLoadingFiles ? t('library.importing') : `${images.length} / ${MAX_IMAGES}` }}
              </span>
            </div>

            <ImageLibrary
              :images="images"
              :active-id="activeId"
              :disabled="isLocked"
              @select="selectImage"
              @remove="removeImage"
            />

            <p
              v-if="activeImage?.transparent"
              class="inline-notice inline-notice--warn"
              role="status"
            >
              <WarningCircle :size="14" weight="bold" aria-hidden="true" />
              {{ t('app.transparencyNotice') }}
            </p>

            <div
              v-if="importErrors.length"
              class="inline-notice inline-notice--error import-errors"
              role="alert"
            >
              <WarningCircle :size="14" weight="bold" aria-hidden="true" />
              <div class="import-errors-copy">
                <p class="import-errors-title">
                  {{ t('library.errorsTitle', { count: importErrors.length }) }}
                </p>
                <ul class="import-errors-list">
                  <li v-for="item in importErrors" :key="item.id">
                    <strong v-if="item.name">{{ item.name }}</strong>
                    <span>{{ t(item.key, item.params) }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section class="control-step" aria-labelledby="step-size">
            <div class="step-head">
              <span class="step-index">02</span>
              <h2 id="step-size">{{ t('app.stepSize') }}</h2>
              <span class="step-note">16:10</span>
            </div>

            <label class="visually-hidden" for="target-size">{{ t('app.targetResolution') }}</label>
            <div class="select-shell">
              <select id="target-size" v-model.number="targetIndex">
                <option
                  v-for="(size, index) in TARGETS"
                  :key="size.label"
                  :value="index"
                >
                  {{ size.label }}
                </option>
              </select>
              <CaretDown :size="14" weight="bold" aria-hidden="true" />
            </div>

            <div class="select-meta">
              <span><span class="mono">16:10</span> {{ t('app.aspectLocked') }}</span>
              <span>{{ target.label }} px</span>
            </div>

            <p
              v-if="upscaleWarning"
              class="inline-notice inline-notice--warn"
              role="status"
            >
              <WarningCircle :size="14" weight="bold" aria-hidden="true" />
              {{ upscaleWarning }}
            </p>
          </section>

          <section class="control-step" aria-labelledby="step-format">
            <div class="step-head">
              <span class="step-index">03</span>
              <h2 id="step-format">{{ t('app.stepFormat') }}</h2>
              <span class="step-note">JPEG / PNG</span>
            </div>

            <fieldset class="format-options">
              <legend class="visually-hidden">{{ t('app.formatLegend') }}</legend>

              <label
                class="format-card"
                :class="{ 'is-selected': format === 'jpeg' }"
              >
                <input v-model="format" type="radio" value="jpeg" />
                <span class="format-radio" aria-hidden="true"></span>
                <span class="format-copy">
                  <strong>JPEG</strong>
                  <small>{{ t('app.jpegQuality') }}</small>
                </span>
                <span class="format-tag">{{ t('app.recommended') }}</span>
              </label>

              <label
                class="format-card"
                :class="{ 'is-selected': format === 'png' }"
              >
                <input v-model="format" type="radio" value="png" />
                <span class="format-radio" aria-hidden="true"></span>
                <span class="format-copy">
                  <strong>PNG</strong>
                  <small>{{ t('app.pngLossless') }}</small>
                </span>
                <span class="format-tag">{{ t('app.noAlpha') }}</span>
              </label>
            </fieldset>
          </section>
        </div>

        <div class="export-block">
          <button
            class="export-button"
            type="button"
            :disabled="!canExport"
            :aria-busy="isExporting ? 'true' : 'false'"
            @click="exportScreenshot"
          >
            <span class="export-label">
              {{ exportButtonLabel }}
              <span v-if="isExporting" class="encoding-dots" aria-hidden="true">
                <i></i><i></i><i></i>
              </span>
            </span>
            <span class="export-icon" aria-hidden="true">
              <DownloadSimple :size="17" weight="bold" />
            </span>
          </button>

          <p class="export-foot" :class="{ 'has-export': lastExport }">
            <CheckCircle
              v-if="lastExport"
              :size="12"
              weight="bold"
              aria-hidden="true"
            />
            <span>{{ exportFootnote }}</span>
          </p>
        </div>
      </aside>

      <CropStage
        ref="stageRef"
        :image="activeImage"
        :target="target"
        :image-count="images.length"
        :max-images="MAX_IMAGES"
        :is-busy="isLocked"
        @crop-change="onCropChange"
        @crop-error="onCropError"
        @files-selected="handleFiles"
        @ready="onCropReady"
      />
    </main>

    <SpecDialog ref="specRef" :target="target" />

    <Transition name="toast">
      <div
        v-if="toast"
        class="toast"
        :class="`toast--${toast.tone}`"
        :role="toastRole"
        aria-live="polite"
      >
        <span class="toast-icon" aria-hidden="true">
          <CheckCircle
            v-if="toast.tone === 'success'"
            :size="19"
            weight="fill"
          />
          <WarningCircle v-else :size="19" weight="fill" />
        </span>
        <span class="toast-copy">
          <strong>{{ toast.title }}</strong>
          <span>{{ toast.detail }}</span>
        </span>
        <button
          class="toast-close"
          type="button"
          :aria-label="t('toast.closeAria')"
          @click="dismissToast"
        >
          <X :size="13" weight="bold" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
}

.topbar {
  display: flex;
  height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 clamp(18px, 3vw, 40px);
  background: rgba(244, 242, 236, 0.86);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(14px);
}

.brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  background: var(--ink);
  border-radius: 9px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.brand-frame {
  width: 19px;
  height: 12px;
  border: 1.5px solid #f7f4ec;
  border-radius: 1.5px;
}

.brand-dot {
  position: absolute;
  right: 7px;
  bottom: 7px;
  width: 5px;
  height: 5px;
  background: var(--accent);
  border: 1.5px solid var(--ink);
  border-radius: 50%;
}

.brand-name {
  color: var(--ink);
  font-size: 15px;
  font-weight: 680;
  letter-spacing: -0.035em;
}

.brand-divider {
  width: 1px;
  height: 13px;
  margin-left: 3px;
  background: var(--line-strong);
}

.brand-descriptor {
  overflow: hidden;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.local-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 6px;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.local-status svg {
  color: #487a61;
}

.locale-switch {
  display: inline-flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.34);
  border: 1px solid var(--line-strong);
  border-radius: 999px;
}

.locale-option {
  display: grid;
  min-width: 27px;
  height: 26px;
  place-items: center;
  padding: 0 6px;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.01em;
  background: transparent;
  border: 0;
  border-radius: 999px;
  transition:
    color 150ms ease,
    background 150ms ease;
}

.locale-option:hover:not(.is-active) {
  color: var(--ink);
}

.locale-option.is-active {
  color: var(--paper);
  background: var(--ink);
}

.repo-button,
.spec-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 11px;
  color: var(--ink);
  font-size: 10px;
  font-weight: 600;
  text-decoration: none;
  background: transparent;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  transition:
    background 160ms ease,
    border-color 160ms ease;
}

.repo-button:hover,
.spec-button:hover {
  background: rgba(255, 255, 255, 0.54);
  border-color: var(--ink-soft);
}

.workspace {
  display: grid;
  width: 100%;
  max-width: 1480px;
  grid-template-columns: minmax(326px, 378px) minmax(0, 1fr);
  gap: clamp(28px, 4vw, 64px);
  align-items: start;
  margin: 0 auto;
  padding: 30px clamp(18px, 3vw, 40px) 34px;
}

.control-panel {
  display: flex;
  min-width: 0;
  min-height: calc(100dvh - 132px);
  flex-direction: column;
}

.intro {
  animation: reveal-up 480ms var(--ease-out) both;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 17px;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.eyebrow-mark {
  width: 13px;
  height: 1px;
  background: var(--accent);
}

.intro h1 {
  margin: 0;
  color: var(--ink);
  font-size: clamp(30px, 2.9vw, 40px);
  font-weight: 610;
  letter-spacing: -0.065em;
  line-height: 1.08;
  white-space: nowrap;
}

.intro h1 span {
  color: var(--ink-soft);
}

.intro h1 em {
  color: var(--accent);
  font-style: normal;
}

.app-shell.locale-en .intro h1 {
  font-size: clamp(27px, 2.5vw, 34px);
  letter-spacing: -0.05em;
}

.lede {
  max-width: 34ch;
  margin: 16px 0 0;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.75;
}

.control-stack {
  margin-top: 30px;
  animation: reveal-up 520ms 70ms var(--ease-out) both;
}

.control-step {
  padding: 17px 0 18px;
  border-top: 1px solid var(--line);
}

.control-step:first-child {
  padding-top: 0;
  border-top: 0;
}

.step-head {
  display: flex;
  min-height: 20px;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 11px;
}

.step-index {
  color: var(--accent-strong);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.step-head h2 {
  margin: 0;
  color: var(--ink);
  font-size: 12px;
  font-weight: 620;
  letter-spacing: 0.005em;
}

.step-note {
  margin-left: auto;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.inline-notice {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 10px 0 0;
  padding: 8px 9px;
  font-size: 10px;
  line-height: 1.55;
  border-radius: 7px;
}

.inline-notice svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.inline-notice--warn {
  color: #7b4a0e;
  background: rgba(188, 126, 35, 0.08);
  border: 1px solid rgba(188, 126, 35, 0.18);
}

.inline-notice--error {
  color: #8d2d25;
  background: rgba(171, 54, 44, 0.07);
  border: 1px solid rgba(171, 54, 44, 0.17);
}

.import-errors {
  align-items: flex-start;
}

.import-errors-copy {
  min-width: 0;
}

.import-errors-title {
  margin: 0 0 3px;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.45;
}

.import-errors-list {
  max-height: 96px;
  padding-left: 14px;
  margin: 0;
  overflow-y: auto;
}

.import-errors-list li {
  margin: 2px 0;
  font-size: 9px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.import-errors-list strong {
  font-weight: 650;
}

.import-errors-list strong::after {
  content: ': ';
}

.select-shell {
  position: relative;
}

.select-shell select {
  width: 100%;
  height: 48px;
  padding: 0 42px 0 14px;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.02em;
  appearance: none;
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease;
}

.select-shell select:hover {
  background: rgba(255, 255, 255, 0.8);
  border-color: var(--ink-soft);
}

.select-shell svg {
  position: absolute;
  top: 50%;
  right: 14px;
  color: var(--ink-soft);
  pointer-events: none;
  transform: translateY(-50%);
}

.select-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.015em;
}

.select-meta .mono {
  color: var(--ink-soft);
  font-weight: 600;
}

.format-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 0;
  margin: 0;
  border: 0;
}

.format-card {
  position: relative;
  display: flex;
  min-width: 0;
  height: 62px;
  align-items: center;
  gap: 9px;
  padding: 10px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.38);
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  transition:
    background 170ms ease,
    border-color 170ms ease,
    color 170ms ease;
}

.format-card:hover {
  background: rgba(255, 255, 255, 0.68);
  border-color: var(--line-strong);
}

.format-card.is-selected {
  color: var(--paper);
  background: var(--ink);
  border-color: var(--ink);
}

.format-card input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.format-card:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.format-radio {
  display: grid;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
}

.format-card.is-selected .format-radio {
  border-color: var(--accent);
}

.format-card.is-selected .format-radio::after {
  width: 6px;
  height: 6px;
  content: '';
  background: var(--accent);
  border-radius: 50%;
}

.format-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.format-copy strong {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.format-copy small {
  overflow: hidden;
  color: var(--ink-faint);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.format-card.is-selected .format-copy small {
  color: rgba(245, 243, 235, 0.62);
}

.format-tag {
  position: absolute;
  top: 6px;
  right: 7px;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.03em;
}

.format-card.is-selected .format-tag {
  color: #ff8565;
}

.export-block {
  margin-top: auto;
  padding-top: 22px;
  animation: reveal-up 560ms 130ms var(--ease-out) both;
}

.export-button {
  display: flex;
  width: 100%;
  height: 55px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 8px 0 18px;
  color: var(--paper);
  background: var(--ink);
  border: 1px solid var(--ink);
  border-radius: var(--radius-control);
  box-shadow:
    0 12px 24px -16px rgba(25, 26, 23, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition:
    background 170ms ease,
    transform 140ms ease,
    box-shadow 170ms ease;
}

.export-button:hover:not(:disabled) {
  background: #282a25;
  box-shadow:
    0 15px 30px -16px rgba(25, 26, 23, 0.58),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.export-button:active:not(:disabled) {
  transform: translateY(1px);
}

.export-button:disabled {
  color: #8c8a82;
  background: #dcd9d0;
  border-color: #dcd9d0;
  box-shadow: none;
  cursor: not-allowed;
}

.export-label {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  font-weight: 590;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.encoding-dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.encoding-dots i {
  display: block;
  width: 3px;
  height: 3px;
  background: var(--accent);
  border-radius: 50%;
  animation: dot-pulse 900ms ease-in-out infinite;
}

.encoding-dots i:nth-child(2) {
  animation-delay: 120ms;
}

.encoding-dots i:nth-child(3) {
  animation-delay: 240ms;
}

.export-icon {
  display: grid;
  width: 39px;
  height: 39px;
  place-items: center;
  color: var(--paper);
  background: rgba(255, 255, 255, 0.09);
  border-radius: 9px;
  transition: background 170ms ease;
}

.export-button:hover:not(:disabled) .export-icon {
  background: var(--accent);
}

.export-button:disabled .export-icon {
  color: #a3a097;
  background: rgba(25, 26, 23, 0.04);
}

.export-foot {
  display: flex;
  min-height: 17px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 9px 0 0;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.02em;
  text-align: center;
}

.export-foot.has-export {
  color: #46745d;
}

.toast {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 30;
  display: flex;
  width: min(420px, calc(100vw - 32px));
  align-items: flex-start;
  gap: 10px;
  padding: 12px 10px 12px 13px;
  color: var(--paper);
  background: #20211d;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 22px 45px -20px rgba(15, 16, 13, 0.6);
}

.toast-icon {
  display: flex;
  flex: 0 0 auto;
  margin-top: 1px;
  color: #7db997;
}

.toast--warning .toast-icon {
  color: #d8a251;
}

.toast--error .toast-icon {
  color: #e88174;
}

.toast-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.toast-copy strong {
  font-size: 11px;
  font-weight: 590;
}

.toast-copy span {
  overflow-wrap: anywhere;
  color: rgba(245, 243, 235, 0.56);
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 1.5;
}

.toast-close {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  margin-left: auto;
  place-items: center;
  color: rgba(245, 243, 235, 0.4);
  background: transparent;
  border-radius: 50%;
  transition:
    color 150ms ease,
    background 150ms ease;
}

.toast-close:hover {
  color: var(--paper);
  background: rgba(255, 255, 255, 0.08);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 200ms ease,
    transform 240ms var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

@keyframes reveal-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dot-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

@media (min-width: 921px) and (max-height: 840px) {
  .workspace {
    padding-top: 20px;
    padding-bottom: 20px;
  }

  .intro h1 {
    font-size: clamp(32px, 2.8vw, 38px);
  }

  .lede {
    margin-top: 12px;
    line-height: 1.65;
  }

  .control-stack {
    margin-top: 20px;
  }

  .control-step {
    padding: 12px 0 13px;
  }

  .step-head {
    margin-bottom: 9px;
  }

  .export-block {
    padding-top: 14px;
  }
}

@media (max-width: 1100px) {
  .workspace {
    grid-template-columns: minmax(310px, 340px) minmax(0, 1fr);
    gap: 30px;
  }

  .brand-descriptor {
    display: none;
  }

  .brand-divider {
    display: none;
  }
}

@media (max-width: 920px) {
  .topbar {
    height: 60px;
  }

  .workspace {
    grid-template-columns: 1fr;
    gap: 28px;
    padding-top: 24px;
    padding-bottom: 28px;
  }

  .control-panel {
    min-height: 0;
  }

  .intro h1 {
    font-size: clamp(34px, 7vw, 42px);
  }

  .app-shell.locale-en .intro h1 {
    font-size: clamp(25px, 6.5vw, 30px);
  }

  .lede {
    max-width: 46ch;
  }

  .export-block {
    margin-top: 0;
    padding-top: 20px;
  }

  .toast {
    right: 16px;
    bottom: 16px;
  }
}

@media (max-width: 620px) {
  .topbar {
    gap: 12px;
    padding: 0 16px;
  }

  .brand {
    gap: 8px;
  }

  .brand-name {
    font-size: 14px;
  }

  .local-status {
    display: none;
  }

  .locale-switch {
    height: 30px;
  }

  .locale-option {
    min-width: 25px;
    height: 24px;
    padding: 0 5px;
  }

  .repo-button,
  .spec-button {
    height: 30px;
    padding: 0 9px;
    font-size: 9px;
  }

  .workspace {
    padding: 20px 16px 24px;
  }

  .intro h1 {
    font-size: 35px;
  }

  .control-stack {
    margin-top: 24px;
  }

  .format-card {
    height: 60px;
  }

  .export-button {
    height: 54px;
  }
}

@media (max-width: 400px) {
  .repo-button span,
  .spec-button span:nth-child(2) {
    display: none;
  }

  .repo-button,
  .spec-button {
    width: 32px;
    justify-content: center;
    padding: 0;
  }

  .spec-button svg:last-child {
    display: none;
  }

  .format-tag {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .intro,
  .control-stack,
  .export-block {
    animation: none;
  }

  .format-card,
  .export-button,
  .spec-button,
  .repo-button,
  .locale-option,
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }

  .encoding-dots i {
    animation: none;
    opacity: 0.8;
  }
}
</style>
