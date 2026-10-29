<script setup lang="ts">
import { useId } from 'vue'
import Icon from '../../ui/Icon.vue'

/**
 * A collapsible block of "Personalizar" (one per zone: ElementEditor). The header is one button
 * (Enter and Space, aria-expanded and aria-controls): the title, a short summary ('7 de 17
 * visibles', 'Normal · 4 elementos') and a chevron. The body opens and closes with a short
 * height animation (none with reduced motion); while closed it is inert, so nothing inside
 * takes focus. Several can be open at once; the open state is the caller's (zonesOpen.ts).
 */
defineProps<{
  title: string
  summary?: string
  open: boolean
}>()

const emit = defineEmits<{ toggle: [open: boolean] }>()

const id = useId()
const buttonId = `${id}-button`
const bodyId = `${id}-body`
</script>

<template>
  <section class="acc" :class="{ 'is-open': open }">
    <h2 class="acc-h">
      <button
        :id="buttonId"
        type="button"
        class="acc-btn"
        :aria-expanded="open"
        :aria-controls="bodyId"
        @click="emit('toggle', !open)"
      >
        <span class="acc-title">{{ title }}</span>
        <span v-if="summary" class="acc-summary">{{ summary }}</span>
        <span class="acc-chev" aria-hidden="true"><Icon name="chevron" /></span>
      </button>
    </h2>
    <div :id="bodyId" class="acc-body" role="region" :aria-labelledby="buttonId" :inert="!open">
      <div class="acc-inner">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* One card per zone: the header row, then the body under a hairline while open. */
.acc {
  min-width: 0;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  box-shadow: var(--st-lit);
}

.acc + .acc {
  margin-top: 8px;
}

.acc-h {
  margin: 0;
  font: inherit;
}

.acc-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px 8px 14px;
  border: 0;
  border-radius: calc(var(--st-radius) - 1px);
  background: transparent;
  color: var(--ov-fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.acc.is-open .acc-btn {
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}

.acc-btn:hover {
  background: var(--st-hover);
}

.acc-btn:focus-visible {
  outline: 2px solid var(--st-focus);
  outline-offset: -2px;
}

.acc-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13.5px;
  font-weight: var(--ov-w-strong);
}

.acc-summary {
  flex: none;
  color: var(--ov-fg-dim);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.acc-chev {
  display: inline-flex;
  flex: none;
  color: var(--ov-fg-muted);
  font-size: 16px;
  transition: transform 160ms ease;
}

.acc.is-open .acc-chev {
  transform: rotate(180deg);
}

/*
 * The height animates through the grid's single row (0fr closed, 1fr open); hidden once
 * closed (visibility waits for the animation), so a closed body is never read or focused.
 */
.acc-body {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  transition:
    grid-template-rows 160ms ease,
    visibility 0s linear 160ms;
}

.acc.is-open .acc-body {
  grid-template-rows: 1fr;
  visibility: visible;
  transition:
    grid-template-rows 160ms ease,
    visibility 0s linear 0s;
}

/* Clipped while it grows, with room for the focus rings of what it holds. */
.acc-inner {
  min-height: 0;
  overflow: clip;
  overflow-clip-margin: 4px;
}

.acc.is-open .acc-inner {
  border-top: 1px solid var(--st-border);
}

@media (prefers-reduced-motion: reduce) {
  .acc-chev,
  .acc-body,
  .acc.is-open .acc-body {
    transition: none;
  }
}
</style>
