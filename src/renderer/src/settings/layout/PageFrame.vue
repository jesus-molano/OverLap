<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useOptions } from '../../composables/useWidgetSettings'
import { optionSetter } from '../editor'
import { providePreviewFold, scrolledFold, type PreviewFold } from './previewFold'

/**
 * Frame of a settings page. `top` (the page header and its live preview) stays put; the
 * default slot (the options) is the only part of the window that scrolls, with its own
 * scrollbar, and `foot` closes it at the bottom. The scroller is a focusable region named by
 * the page title (`labelledby`), so Tab reaches it and the wheel, PageUp / PageDown and the
 * arrow keys scroll it. Both parts are bands (settings.css): the same width whether or not
 * the options scroll.
 *
 * Scrolling the options down folds the page's preview into a strip, and back at the top it
 * unfolds (R14; settingsWindow.previewFold: 'auto', or always whole, or always a strip): the
 * options get the room the preview took.
 */
defineProps<{ labelledby: string }>()

const scroller = useTemplateRef<HTMLElement>('scroller')
const windowOptions = useOptions('settingsWindow')
const setFold = optionSetter('settingsWindow')('previewFold')
const { scrolled } = providePreviewFold(
  () => windowOptions.value.previewFold,
  (m: PreviewFold) => void setFold(m),
  () => scroller.value?.scrollTo({ top: 0 })
)

function onScroll(): void {
  const el = scroller.value
  if (!el) return
  scrolled.value = scrolledFold(
    scrolled.value,
    { top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight },
    window.innerHeight
  )
}
</script>

<template>
  <article class="frame">
    <div class="st-band">
      <slot name="top" />
    </div>
    <div
      ref="scroller"
      class="st-band st-scroll"
      role="region"
      tabindex="0"
      :aria-labelledby="labelledby"
      @scroll.passive="onScroll"
    >
      <div class="frame-body">
        <div class="frame-main">
          <slot />
        </div>
        <slot name="foot" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.frame {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

/* At least as tall as the scroller, so a short page still keeps its foot at the bottom. */
.frame-body {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.frame-main {
  flex: 1 0 auto;
}
</style>
