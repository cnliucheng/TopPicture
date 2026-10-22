<script setup>
import { ref } from 'vue'
import {
  PhArrowUpRight as ArrowUpRight,
  PhCheck as Check,
  PhX as X,
} from '@phosphor-icons/vue'
import { TARGETS } from '../lib/constants'
import { t } from '../lib/i18n'

defineProps({
  target: {
    type: Object,
    required: true,
  },
})

const dialog = ref(null)

function open() {
  if (!dialog.value) return
  if (!dialog.value.open) dialog.value.showModal()
}

function close() {
  dialog.value?.close()
}

function onBackdropClick(event) {
  if (event.target === event.currentTarget) close()
}

defineExpose({ open, close })
</script>

<template>
  <dialog
    ref="dialog"
    class="spec-dialog"
    aria-labelledby="spec-title"
    @click="onBackdropClick"
  >
    <div class="spec-card">
      <header class="spec-header">
        <div>
          <p class="spec-eyebrow">{{ t('spec.eyebrow') }}</p>
          <h2 id="spec-title">{{ t('spec.title') }}</h2>
          <p class="spec-intro">{{ t('spec.intro') }}</p>
        </div>
        <button
          class="spec-close"
          type="button"
          :aria-label="t('spec.closeAria')"
          @click="close"
        >
          <X :size="17" weight="bold" aria-hidden="true" />
        </button>
      </header>

      <section class="spec-section" aria-labelledby="sizes-title">
        <div class="spec-section-head">
          <h3 id="sizes-title">{{ t('spec.resolutions') }}</h3>
          <span>{{ t('spec.pickOne') }}</span>
        </div>

        <div class="size-list">
          <div
            v-for="size in TARGETS"
            :key="size.label"
            class="size-row"
            :class="{ 'is-current': size.width === target.width }"
            :aria-current="size.width === target.width ? 'true' : undefined"
          >
            <span class="size-check">
              <Check :size="12" weight="bold" aria-hidden="true" />
            </span>
            <span class="size-label">{{ size.label }}</span>
            <span class="size-ratio">16:10</span>
            <span v-if="size.width === target.width" class="size-current">{{ t('spec.current') }}</span>
          </div>
        </div>
      </section>

      <section class="spec-section" aria-labelledby="rules-title">
        <div class="spec-section-head">
          <h3 id="rules-title">{{ t('spec.requirements') }}</h3>
          <span>{{ t('spec.preSubmit') }}</span>
        </div>

        <dl class="rule-list">
          <div class="rule-item">
            <dt>{{ t('spec.fixedRatioTitle') }}</dt>
            <dd>{{ t('spec.fixedRatioBody') }}</dd>
          </div>
          <div class="rule-item">
            <dt>{{ t('spec.noAlphaTitle') }}</dt>
            <dd>{{ t('spec.noAlphaBody') }}</dd>
          </div>
          <div class="rule-item">
            <dt>{{ t('spec.formatsTitle') }}</dt>
            <dd>{{ t('spec.formatsBody') }}</dd>
          </div>
          <div class="rule-item">
            <dt>{{ t('spec.sizeTitle') }}</dt>
            <dd>{{ t('spec.sizeBody') }}</dd>
          </div>
        </dl>
      </section>

      <footer class="spec-footer">
        <p>{{ t('spec.tip') }}</p>
        <a
          href="https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('spec.official') }}
          <ArrowUpRight :size="13" weight="bold" aria-hidden="true" />
        </a>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.spec-dialog {
  width: min(680px, calc(100vw - 32px));
  max-height: min(780px, calc(100dvh - 40px));
  padding: 0;
  overflow: visible;
  color: var(--ink);
  background: transparent;
  border: 0;
  border-radius: 20px;
}

.spec-dialog::backdrop {
  background: rgba(18, 19, 16, 0.62);
  backdrop-filter: blur(7px);
}

.spec-card {
  max-height: min(780px, calc(100dvh - 40px));
  overflow-y: auto;
  padding: 28px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: 0 30px 90px -30px rgba(15, 16, 13, 0.55);
}

.spec-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.spec-eyebrow {
  margin: 0 0 9px;
  color: var(--accent-strong);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.spec-header h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 590;
  letter-spacing: -0.04em;
  line-height: 1.08;
}

.spec-intro {
  max-width: 53ch;
  margin: 12px 0 0;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.72;
}

.spec-close {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 50%;
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
}

.spec-close:hover {
  color: var(--ink);
  background: var(--paper-deep);
  border-color: var(--line-strong);
}

.spec-section {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.spec-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 11px;
}

.spec-section-head h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 620;
  letter-spacing: 0.01em;
}

.spec-section-head > span {
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
}

.size-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.size-row {
  display: flex;
  min-height: 45px;
  align-items: center;
  gap: 9px;
  padding: 0 11px;
  background: rgba(255, 255, 255, 0.46);
  border: 1px solid var(--line);
  border-radius: 10px;
}

.size-row.is-current {
  background: rgba(255, 90, 47, 0.065);
  border-color: rgba(255, 90, 47, 0.28);
}

.size-check {
  display: grid;
  width: 18px;
  height: 18px;
  place-items: center;
  color: var(--ink-faint);
  background: rgba(25, 26, 23, 0.04);
  border-radius: 50%;
}

.is-current .size-check {
  color: var(--paper);
  background: var(--accent);
}

.size-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.size-ratio {
  margin-left: auto;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 9px;
}

.size-current {
  padding: 2px 6px;
  color: var(--accent-strong);
  font-size: 9px;
  font-weight: 600;
  background: rgba(255, 90, 47, 0.1);
  border-radius: 999px;
}

.rule-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 12px;
}

.rule-item {
  padding: 15px;
  background: var(--paper);
}

.rule-item dt {
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 620;
  letter-spacing: -0.005em;
}

.rule-item dd {
  margin: 0;
  color: var(--ink-soft);
  font-size: 11px;
  line-height: 1.65;
}

.spec-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 24px;
  padding-top: 17px;
  border-top: 1px solid var(--line);
}

.spec-footer p {
  margin: 0;
  color: var(--ink-faint);
  font-size: 10px;
  line-height: 1.5;
}

.spec-footer a {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  color: var(--ink);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  border-bottom: 1px solid var(--line-strong);
  transition: color 160ms ease, border-color 160ms ease;
}

.spec-footer a:hover {
  color: var(--accent-strong);
  border-color: var(--accent);
}

@media (max-width: 620px) {
  .spec-card {
    padding: 20px;
    border-radius: 16px;
  }

  .spec-header h2 {
    font-size: 23px;
  }

  .size-list,
  .rule-list {
    grid-template-columns: 1fr;
  }

  .spec-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
