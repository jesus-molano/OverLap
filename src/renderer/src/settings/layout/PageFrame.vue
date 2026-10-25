<script setup lang="ts">
/**
 * Frame of a settings page. `top` (the page header and its live preview) stays put; the
 * default slot (the options) is the only part of the window that scrolls, with its own
 * scrollbar, and `foot` closes it at the bottom. The scroller is a focusable region named by
 * the page title (`labelledby`), so Tab reaches it and the wheel, PageUp / PageDown and the
 * arrow keys scroll it. Both parts are bands (settings.css): the same width whether or not
 * the options scroll.
 */
defineProps<{ labelledby: string }>()
</script>

<template>
  <article class="frame">
    <div class="st-band">
      <slot name="top" />
    </div>
    <div class="st-band st-scroll" role="region" tabindex="0" :aria-labelledby="labelledby">
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
