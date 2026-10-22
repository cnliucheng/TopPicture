<script setup>
import {
  PhImages as Images,
  PhPlus as Plus,
  PhX as X,
} from '@phosphor-icons/vue'
import { ref } from 'vue'
import { t } from '../lib/i18n'
import { formatPixels } from '../lib/image'

const props = defineProps({
  images: {
    type: Array,
    default: () => [],
  },
  activeId: {
    type: [String, Number],
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  showAddTile: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select', 'remove', 'files-selected'])
const addInput = ref(null)

function openAddPicker() {
  if (props.disabled || !props.showAddTile) return
  addInput.value?.click()
}

function onAddInput(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) emit('files-selected', [file])
}
</script>

<template>
  <div class="image-library">
    <input
      v-if="showAddTile"
      ref="addInput"
      class="visually-hidden"
      type="file"
      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
      :disabled="disabled"
      :aria-label="t('library.addOneAria')"
      @change="onAddInput"
    />

    <div v-if="!images.length && !showAddTile" class="library-empty">
      <span class="library-empty-icon" aria-hidden="true">
        <Images :size="18" weight="light" />
      </span>
      <span>{{ t('library.empty') }}</span>
    </div>

    <template v-else>
      <button
        v-if="!images.length && showAddTile"
        class="library-add-empty"
        type="button"
        :disabled="disabled"
        :aria-label="t('library.addOneAria')"
        @click="openAddPicker"
      >
        <Plus :size="18" weight="light" aria-hidden="true" />
        <span>{{ t('library.addOne') }}</span>
      </button>

      <div
        v-else
        class="thumb-grid"
        role="list"
        :aria-label="t('library.aria')"
      >
        <div
          v-for="(item, index) in images"
          :key="item.id"
          class="thumb-card"
          :class="{ 'is-active': item.id === activeId }"
          role="listitem"
          :data-image-id="item.id"
        >
          <button
            class="thumb-select"
            type="button"
            :aria-pressed="item.id === activeId"
            :disabled="disabled"
            :title="item.name"
            @click="emit('select', item.id)"
          >
            <span class="thumb-frame">
              <img :src="item.url" alt="" />
              <span class="thumb-index" aria-hidden="true">
                {{ String(index + 1).padStart(2, '0') }}
              </span>
              <span
                v-if="item.transparent"
                class="alpha-dot"
                :title="t('library.transparent')"
                aria-hidden="true"
              ></span>
            </span>
            <span class="thumb-name">{{ item.name }}</span>
            <span class="thumb-dims">
              {{ formatPixels(item.width) }} × {{ formatPixels(item.height) }}
            </span>
            <span class="visually-hidden">
              {{ item.transparent ? t('library.transparent') : t('library.opaque') }}
            </span>
          </button>

          <button
            class="thumb-remove"
            type="button"
            :disabled="disabled"
            :aria-label="t('library.removeAria', { name: item.name })"
            :title="t('library.removeAria', { name: item.name })"
            @click.stop="emit('remove', item.id)"
          >
            <X :size="10" weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div v-if="showAddTile" class="thumb-add-cell" role="listitem">
          <button
            class="thumb-add"
            type="button"
            :disabled="disabled"
            :aria-label="t('library.addOneAria')"
            @click="openAddPicker"
          >
            <Plus :size="19" weight="light" aria-hidden="true" />
            <span>{{ t('library.addOne') }}</span>
          </button>
        </div>
      </div>

      <p v-if="images.length" class="library-hint">
        {{ t('library.hint') }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.image-library {
  min-width: 0;
}

.library-empty {
  display: flex;
  min-height: 76px;
  align-items: center;
  gap: 11px;
  padding: 13px;
  color: var(--ink-faint);
  font-size: 10px;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.28);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-control);
}

.library-empty-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--ink-soft);
  background: rgba(25, 26, 23, 0.045);
  border-radius: 9px;
}

.thumb-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.thumb-card {
  position: relative;
  min-width: 0;
}

.thumb-select {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 4px;
  color: var(--ink);
  text-align: left;
  background: rgba(255, 255, 255, 0.34);
  border: 1px solid var(--line);
  border-radius: 9px;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 140ms ease;
}

.thumb-select:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.68);
  border-color: var(--line-strong);
}

.thumb-select:active:not(:disabled) {
  transform: translateY(1px);
}

.thumb-card.is-active .thumb-select {
  background: rgba(255, 255, 255, 0.72);
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.thumb-select:disabled {
  cursor: wait;
  opacity: 0.72;
}

.thumb-frame {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background-color: #dedbd2;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.5) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.5) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.5) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.5) 75%);
  background-position:
    0 0,
    0 4px,
    4px -4px,
    -4px 0;
  background-size: 8px 8px;
  border-radius: 5px;
}

.thumb-frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-index {
  position: absolute;
  bottom: 4px;
  left: 4px;
  padding: 1px 5px;
  color: rgba(255, 255, 255, 0.9);
  font-family: var(--font-mono);
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: rgba(16, 17, 14, 0.62);
  border-radius: 999px;
  backdrop-filter: blur(3px);
}

.alpha-dot {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 7px;
  height: 7px;
  background: var(--warning);
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(17, 18, 15, 0.28);
}

.thumb-name {
  display: block;
  width: 100%;
  overflow: hidden;
  padding: 1px 1px 0;
  font-size: 8px;
  font-weight: 590;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb-dims {
  display: block;
  width: 100%;
  overflow: hidden;
  padding: 0 1px 1px;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 7px;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.thumb-remove {
  position: absolute;
  top: 7px;
  right: 7px;
  z-index: 2;
  display: grid;
  width: 19px;
  height: 19px;
  place-items: center;
  color: rgba(255, 255, 255, 0.88);
  background: rgba(17, 18, 15, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  opacity: 0;
  transition:
    opacity 150ms ease,
    background 150ms ease;
}

.thumb-card:hover .thumb-remove,
.thumb-card:focus-within .thumb-remove,
.thumb-card.is-active .thumb-remove {
  opacity: 1;
}

.thumb-remove:hover:not(:disabled) {
  background: rgba(171, 54, 44, 0.88);
}

.thumb-remove:disabled {
  cursor: wait;
  opacity: 0.4;
}

.thumb-add-cell {
  display: flex;
  min-width: 0;
}

.thumb-add {
  display: flex;
  width: 100%;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.02em;
  background: rgba(255, 255, 255, 0.18);
  border: 1px dashed var(--line-strong);
  border-radius: 9px;
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
}

.thumb-add:hover:not(:disabled) {
  color: var(--accent-strong);
  background: rgba(255, 90, 47, 0.045);
  border-color: rgba(255, 90, 47, 0.55);
}

.thumb-add:disabled {
  cursor: wait;
  opacity: 0.6;
}

.library-add-empty {
  display: flex;
  width: 100%;
  min-height: 76px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.02em;
  background: rgba(255, 255, 255, 0.24);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-control);
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
}

.library-add-empty:hover:not(:disabled) {
  color: var(--accent-strong);
  background: rgba(255, 90, 47, 0.045);
  border-color: rgba(255, 90, 47, 0.55);
}

.library-add-empty:disabled {
  cursor: wait;
  opacity: 0.6;
}

.library-hint {
  margin: 7px 0 0;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.01em;
}

@media (hover: none) {
  .thumb-remove {
    opacity: 1;
  }
}

@media (max-width: 400px) {
  .thumb-grid {
    gap: 6px;
  }

  .thumb-select {
    padding: 3px;
  }
}
</style>
