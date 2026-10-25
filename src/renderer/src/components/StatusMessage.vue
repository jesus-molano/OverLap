<script setup lang="ts">
import { computed } from 'vue'
import { statusText } from '@shared/i18n'
import { useI18n } from '../composables/useI18n'
import { useOverlayState } from '../composables/useOverlay'

const { status } = useOverlayState()
const t = useI18n()

/** The status line in the window's language; null (render nothing) while data flows. */
const message = computed<string | null>(() => {
  const s = status.value
  if (!s) return t.value.core.status.unknown
  if (s.state === 'connected' || s.state === 'mock') return null
  return statusText(t.value, s)
})

const isError = computed(() => status.value?.state === 'error')

/**
 * A new key re-creates the dot, which restarts its (finite) pulse on every status change
 * (keyed by the codes, not the text: switching language is not a new status).
 */
const pulseKey = computed(() => {
  const s = status.value
  return s ? `${s.state}\n${s.note}\n${s.detail}` : 'starting'
})
</script>

<template>
  <div v-if="message !== null" class="status" :class="{ error: isError }" role="status">
    <span :key="pulseKey" class="dot" aria-hidden="true" />
    <span class="text">{{ message }}</span>
  </div>
</template>

<style scoped>
/*
 * Fills the cell it is given (min-height: an auto-height widget gives it no height, so
 * nothing here can depend on the window height). Text follows the widget's font, so it
 * scales with the widget, never below the 9 px floor.
 */
.status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55em;
  width: 100%;
  min-height: 100%;
  padding: 0.8em 1em;
  color: var(--ov-fg-muted);
  font-size: max(var(--ov-min-text), 0.9em);
  line-height: 1.3;
  text-align: center;
}

.text {
  min-width: 0;
  overflow-wrap: anywhere;
}

/*
 * A few pulses, then still: an infinite animation would keep the transparent
 * window repainting every frame for as long as iRacing is closed. The keyframes
 * start and end at the resting style, so no fill mode is needed. Information colour:
 * the accent means "you" and nothing else.
 */
.dot {
  flex: none;
  width: 0.5em;
  height: 0.5em;
  min-width: 5px;
  min-height: 5px;
  border-radius: 50%;
  background: var(--ov-info);
  animation: pulse 1.4s ease-in-out 4;
}

.error .dot {
  background: var(--ov-bad);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.8);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
  }
}
</style>
