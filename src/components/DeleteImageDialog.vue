<script setup>
import { nextTick, ref } from 'vue'
import {
  PhDownloadSimple as DownloadSimple,
  PhTrash as Trash,
  PhX as X,
} from '@phosphor-icons/vue'
import { t } from '../lib/i18n'

const props = defineProps({
  imageName: {
    type: String,
    default: '',
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['cancel', 'delete', 'save'])
const dialog = ref(null)
const cancelButton = ref(null)

async function open() {
  if (!dialog.value || dialog.value.open) return
  dialog.value.showModal()
  await nextTick()
  cancelButton.value?.focus()
}

function close() {
  dialog.value?.close()
}

function requestCancel() {
  if (props.saving) return
  emit('cancel')
}

function onBackdropClick(event) {
  if (event.target === event.currentTarget) requestCancel()
}

function onCancelEvent(event) {
  event.preventDefault()
  requestCancel()
}

defineExpose({ open, close })
</script>

<template>
  <dialog
    ref="dialog"
    class="delete-dialog"
    aria-labelledby="delete-title"
    @cancel="onCancelEvent"
    @click="onBackdropClick"
  >
    <div class="delete-card">
      <button
        class="delete-close"
        type="button"
        :aria-label="t('delete.closeAria')"
        :disabled="saving"
        @click="requestCancel"
      >
        <X :size="15" weight="bold" aria-hidden="true" />
      </button>

      <span class="delete-mark" aria-hidden="true">
        <Trash :size="20" weight="light" />
      </span>
      <h2 id="delete-title">{{ t('delete.title') }}</h2>
      <p class="delete-copy">{{ t('delete.body') }}</p>
      <p class="delete-file" :title="imageName">{{ imageName }}</p>

      <div class="delete-actions">
        <button
          ref="cancelButton"
          class="delete-button delete-button--ghost"
          type="button"
          :disabled="saving"
          @click="requestCancel"
        >
          {{ t('delete.cancel') }}
        </button>
        <button
          class="delete-button delete-button--danger"
          type="button"
          :disabled="saving"
          @click="emit('delete')"
        >
          {{ t('delete.skip') }}
        </button>
        <button
          class="delete-button delete-button--primary"
          type="button"
          :disabled="saving"
          @click="emit('save')"
        >
          <DownloadSimple :size="14" weight="bold" aria-hidden="true" />
          {{ saving ? t('delete.saving') : t('delete.save') }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.delete-dialog {
  width: min(500px, calc(100vw - 32px));
  max-height: calc(100dvh - 40px);
  padding: 0;
  color: var(--ink);
  background: transparent;
  border: 0;
  border-radius: 18px;
}

.delete-dialog::backdrop {
  background: rgba(18, 19, 16, 0.62);
  backdrop-filter: blur(7px);
}

.delete-card {
  position: relative;
  padding: 26px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: 0 30px 90px -30px rgba(15, 16, 13, 0.55);
}

.delete-close {
  position: absolute;
  top: 16px;
  right: 16px;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--ink-faint);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 50%;
  transition:
    color 150ms ease,
    background 150ms ease;
}

.delete-close:hover:not(:disabled) {
  color: var(--ink);
  background: var(--paper-deep);
}

.delete-close:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.delete-mark {
  display: grid;
  width: 42px;
  height: 42px;
  margin-bottom: 15px;
  place-items: center;
  color: #9a3b30;
  background: rgba(171, 54, 44, 0.08);
  border: 1px solid rgba(171, 54, 44, 0.16);
  border-radius: 11px;
}

.delete-card h2 {
  max-width: 33ch;
  margin: 0;
  font-size: 24px;
  font-weight: 610;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.delete-copy {
  max-width: 40ch;
  margin: 10px 0 0;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.7;
}

.delete-file {
  overflow: hidden;
  margin: 15px 0 0;
  padding: 8px 10px;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.46);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.delete-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 22px;
}

.delete-button {
  display: inline-flex;
  min-height: 37px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 8px;
  transition:
    background 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.delete-button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.delete-button--ghost {
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--line-strong);
}

.delete-button--ghost:hover:not(:disabled) {
  color: var(--ink);
  background: var(--paper-deep);
}

.delete-button--danger {
  color: #92362c;
  background: rgba(171, 54, 44, 0.06);
  border: 1px solid rgba(171, 54, 44, 0.2);
}

.delete-button--danger:hover:not(:disabled) {
  background: rgba(171, 54, 44, 0.11);
  border-color: rgba(171, 54, 44, 0.34);
}

.delete-button--primary {
  color: var(--paper);
  background: var(--ink);
  border: 1px solid var(--ink);
}

.delete-button--primary:hover:not(:disabled) {
  background: #2b2d27;
}

.delete-button--primary svg {
  flex: 0 0 auto;
}

@media (max-width: 520px) {
  .delete-card {
    padding: 20px;
    border-radius: 15px;
  }

  .delete-card h2 {
    font-size: 21px;
  }

  .delete-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .delete-button {
    width: 100%;
  }
}
</style>
