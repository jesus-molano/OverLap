<script setup lang="ts">
import { useI18n } from '../../composables/useI18n'
import { useConfirm } from '../useConfirm'

/**
 * Destructive button with a second click to confirm: the first click turns it into
 * `confirmLabel` for a few seconds; leaving it (blur, Escape) disarms it.
 */
const props = defineProps<{
  label: string
  confirmLabel: string
  /** What it does, for screen readers and the tooltip. */
  description: string
  action: () => void
  /** Compact, for a button inside a list row. */
  small?: boolean
}>()

const { armed, trigger, cancel } = useConfirm(() => props.action())
const t = useI18n()
</script>

<template>
  <button
    type="button"
    class="st-btn"
    :class="{ 'st-btn-danger': armed, 'st-btn-sm': small }"
    :title="description"
    @click="trigger"
    @blur="cancel"
    @keydown.esc="cancel"
  >
    {{ armed ? confirmLabel : label }}
  </button>
  <span class="st-sr-only" aria-live="polite">{{
    armed ? t.settings.confirm.pressAgain(description) : ''
  }}</span>
</template>
