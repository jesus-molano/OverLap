<script setup lang="ts">
/**
 * Backdrop of the live previews: a static picture of bright sky over dark asphalt, so the
 * panel's background opacity and the text halo read as they would over the game; the preview
 * rows straddle both. Neutral greys only: a green verge or a red kerb behind a row would read
 * as our meaning colours. Painted once.
 *
 * The stage stays above the page's scrolling options, so it never takes more than about 40 %
 * of the window height (--stage-max): a sample taller than that (it already fits the stage
 * width on its own) is drawn smaller as a whole, centred (stageFit). Only the window height and
 * the sample's own layout size decide it, never the scale, so nothing feeds back.
 */
import { computed, useTemplateRef } from 'vue'
import { useElementSize } from '../../composables/useElementSize'
import { useI18n } from '../../composables/useI18n'
import type { InlineStyle } from '../../view/styles'
import { stageFit } from './stageFit'

/** `caption`: the figure caption (default: the sample-data note in the current language). */
withDefaults(defineProps<{ caption?: string }>(), { caption: undefined })

const t = useI18n()

/** Height the sample may take: the stage's cap less its padding and border (CSS decides it). */
const limitSize = useElementSize(useTemplateRef<HTMLElement>('limit'))
/** The sample's layout size (the scale below is a transform: it does not change it). */
const sampleSize = useElementSize(useTemplateRef<HTMLElement>('sample'))

const fit = computed(() =>
  stageFit(sampleSize.value, { w: sampleSize.value.w, h: Math.floor(limitSize.value.h) })
)
/** Until the sample is measured it takes its own height. */
const fitStyle = computed<InlineStyle | undefined>(() =>
  fit.value.height > 0 ? { height: `${fit.value.height}px` } : undefined
)
const sampleStyle = computed<InlineStyle | undefined>(() =>
  fit.value.scale < 1 ? { transform: `scale(${fit.value.scale})` } : undefined
)
</script>

<template>
  <figure class="stage">
    <div class="scene" aria-hidden="true" />
    <div ref="limit" class="limit" aria-hidden="true" />
    <div class="content">
      <div class="fit" :style="fitStyle">
        <div ref="sample" class="sample" :style="sampleStyle">
          <slot />
        </div>
      </div>
    </div>
    <figcaption class="caption">{{ caption ?? t.settings.sample.caption }}</figcaption>
  </figure>
</template>

<style scoped>
.stage {
  --pad-top: 22px;
  --pad-bottom: 30px;
  /* A share of the window, never below a usable minimum: the options keep the rest. */
  --stage-max: max(160px, 40vh);

  position: relative;
  max-height: var(--stage-max);
  margin: 0;
  /* Clipped, never scrollable: the measuring .limit reaches past a short stage. */
  overflow: clip;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: #30353c;
  isolation: isolate;
}

.scene {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(180deg, transparent 0 58%, rgba(0, 0, 0, 0.28) 100%),
    linear-gradient(180deg, transparent 0 41%, #d6dbe2 41% 42%, transparent 42% 100%),
    repeating-linear-gradient(90deg, #6d737b 0 18px, #e9ecef 18px 36px) 0 40% / 100% 6px no-repeat,
    linear-gradient(
      180deg,
      #9fb0c2 0%,
      #d5dde6 34%,
      #3a4048 34%,
      #343a42 40%,
      #30353c 42%,
      #1f2328 100%
    );
}

/* Measured, never seen: as tall as the sample may be (2 px: the stage's border). */
.limit {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: calc(var(--stage-max) - var(--pad-top) - var(--pad-bottom) - 2px);
  visibility: hidden;
  pointer-events: none;
}

.content {
  padding: var(--pad-top) 16px var(--pad-bottom);
}

/* The space the scaled sample takes; its unscaled layout box must not show past it. */
.fit {
  overflow: clip;
}

.sample {
  display: flex;
  justify-content: center;
  transform-origin: 50% 0;
}

.caption {
  position: absolute;
  right: 10px;
  bottom: 6px;
  color: rgba(255, 255, 255, 0.72);
  font-family: var(--ov-font-small);
  font-size: 11px;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
</style>
