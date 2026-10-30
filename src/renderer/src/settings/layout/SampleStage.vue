<script setup lang="ts">
/**
 * Backdrop of the live previews: a track scene behind the sample, so the panel's background
 * opacity and the text halo read as they would over the game; the preview rows straddle its sky
 * and its track. Two scenes (settings.settingsWindow.stageScene, switched on the stage itself):
 * 'dark', a night track under floodlights (the default), and 'light', a bright day over pale
 * concrete with sun glare, the hardest case for a translucent panel. Both are CSS-drawn, no image
 * files, in neutral greys only: a green verge or a red kerb behind a row would read as our
 * meaning colours. Painted once per scene.
 *
 * The stage stays above the page's scrolling options, so it never takes more than about 40 %
 * of the window height (--stage-max; a little more in a wide window, where the options have two
 * columns): a sample taller than that (it already fits the stage width on its own) is drawn
 * smaller as a whole, centred (stageFit). Only the window height and the sample's own layout
 * size decide it, never the scale, so nothing feeds back.
 */
import { computed, onBeforeUnmount, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { SettingsWindowOptions } from '@shared/types'
import { useElementSize } from '../../composables/useElementSize'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import type { InlineStyle } from '../../view/styles'
import { choiceOptions } from '../controls/choice'
import PreviewEditLayer from '../preview/PreviewEditLayer.vue'
import { injectPreviewEdit } from '../preview/usePreviewEdit'
import { optionSetter } from '../editor'
import { useDraft } from '../useDraft'
import { editingLimit, stageFit } from './stageFit'
import { injectPreviewFold, type PreviewFold } from './previewFold'

/** `caption`: the figure caption (default: the sample-data note in the current language). */
withDefaults(defineProps<{ caption?: string }>(), { caption: undefined })

type Scene = SettingsWindowOptions['stageScene']

const t = useI18n()
const windowOptions = useOptions('settingsWindow')
const scene = useDraft<Scene>(
  () => windowOptions.value.stageScene,
  optionSetter('settingsWindow')('stageScene')
)
const sceneNow = scene.value
const sceneChoices = computed(() =>
  choiceOptions(
    OPTION_SCHEMA.settingsWindow.stageScene.values,
    t.value.settings.sample.sceneChoices
  )
)
const sceneId = useId()
const sceneLabelId = `${sceneId}-label`
/** Folded into a strip while the options scroll (R14), and how it folds. */
const fold = injectPreviewFold()
const folded = fold.folded
const foldMode = useDraft<PreviewFold>(
  () => windowOptions.value.previewFold,
  optionSetter('settingsWindow')('previewFold')
)
const foldChoices = computed(() =>
  choiceOptions(
    OPTION_SCHEMA.settingsWindow.previewFold.values,
    t.value.settings.sample.foldChoices
  )
)
const foldId = useId()
const foldLabelId = `${foldId}-label`

/** Height the sample may take: the stage's cap less its padding and border (CSS decides it). */
const limitSize = useElementSize(useTemplateRef<HTMLElement>('limit'))
/** The sample's layout size (the scale below is a transform: it does not change it). */
const sampleEl = useTemplateRef<HTMLElement>('sample')
const sampleSize = useElementSize(sampleEl)
const stageEl = useTemplateRef<HTMLElement>('stage')
/** A widget page's preview is editable (usePreviewEdit): its pointer layer. */
const edit = injectPreviewEdit()
const editable = edit !== null

/**
 * While the sample draws ghosts (and until it is measured again without them), it keeps the
 * height it had at rest (`rest`): ghosts that add lines draw it a little smaller instead of
 * growing the stage, so the options under it never jump while you point (editingLimit).
 */
const ghosting = computed(() => (edit?.ghosts.value.length ?? 0) > 0)
const settling = shallowRef(false)
const rest = shallowRef(0)
let settleTimer: ReturnType<typeof setTimeout> | undefined
watch(ghosting, (on, was) => {
  clearTimeout(settleTimer)
  if (on || !was) return
  settling.value = true
  // The sample's next measure ends it; one that does not change ends it after a moment.
  settleTimer = setTimeout(() => (settling.value = false), 150)
})
watch(sampleSize, () => {
  if (settling.value && !ghosting.value) settling.value = false
})
onBeforeUnmount(() => clearTimeout(settleTimer))

const fit = computed(() => {
  const limit = Math.floor(limitSize.value.h)
  const frozen = ghosting.value || settling.value
  return stageFit(sampleSize.value, {
    w: sampleSize.value.w,
    h: frozen ? editingLimit(limit, rest.value) : limit
  })
})
watch(fit, (f) => {
  if (!ghosting.value && !settling.value && f.height > 0) rest.value = f.height
})
/** Until the sample is measured it takes its own height. */
const fitStyle = computed<InlineStyle | undefined>(() =>
  fit.value.height > 0 ? { height: `${fit.value.height}px` } : undefined
)
const sampleStyle = computed<InlineStyle | undefined>(() =>
  fit.value.scale < 1 ? { transform: `scale(${fit.value.scale})` } : undefined
)
</script>

<template>
  <figure ref="stage" class="stage" :data-scene="sceneNow" :data-folded="folded || undefined">
    <div class="scene" aria-hidden="true" />
    <div ref="limit" class="limit" aria-hidden="true" />
    <div class="content">
      <div class="fit" :style="fitStyle">
        <div ref="sample" class="sample" :style="sampleStyle">
          <slot />
        </div>
      </div>
    </div>
    <PreviewEditLayer v-if="editable" :sample="sampleEl" :stage="stageEl" />
    <button
      v-if="folded"
      type="button"
      class="st-btn st-btn-sm unfold"
      :title="t.settings.sample.foldChoices.auto.hint"
      @click="fold.unfold()"
    >
      {{ t.settings.sample.unfold }}
    </button>
    <div class="stage-foot">
      <div class="scene-switch">
        <span :id="sceneLabelId" class="scene-label">{{ t.settings.sample.scene }}</span>
        <div class="scene-seg" role="radiogroup" :aria-labelledby="sceneLabelId">
          <label v-for="o in sceneChoices" :key="o.value" class="st-seg-item" :title="o.hint">
            <input
              type="radio"
              class="st-seg-input"
              :name="sceneId"
              :value="o.value"
              :checked="sceneNow === o.value"
              @change="scene.commit(o.value)"
            />
            <span class="st-seg-text">{{ o.label }}</span>
          </label>
        </div>
      </div>
      <div class="scene-switch fold-switch">
        <span :id="foldLabelId" class="scene-label">{{ t.settings.sample.fold }}</span>
        <div class="scene-seg" role="radiogroup" :aria-labelledby="foldLabelId">
          <label v-for="o in foldChoices" :key="o.value" class="st-seg-item" :title="o.hint">
            <input
              type="radio"
              class="st-seg-input"
              :name="foldId"
              :value="o.value"
              :checked="foldMode.value.value === o.value"
              @change="foldMode.commit(o.value)"
            />
            <span class="st-seg-text">{{ o.label }}</span>
          </label>
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
  --stage-share: 40vh;
  --stage-max: max(160px, var(--stage-share));
  --scene-ink: rgba(255, 255, 255, 0.74);
  --scene-ink-shadow: 0 1px 0 rgba(0, 0, 0, 0.55);

  position: relative;
  /* Its width decides whether the caption still fits beside the foot controls. */
  container-type: inline-size;
  max-height: var(--stage-max);
  margin: 0;
  /* Clipped, never scrollable: the measuring .limit reaches past a short stage. */
  overflow: clip;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: #1b1f24;
  isolation: isolate;
}

/* A wide window has room to spare in height too: the preview gets a little more of it. */
@media (min-width: 1100px) {
  .stage {
    --stage-share: 46vh;
  }
}

.stage {
  transition: max-height 120ms ease-out;
}

/*
 * Folded (R14): a strip of about 120 px while the options scroll; the sample is drawn smaller
 * to fit it (stageFit), its foot controls give way to «Ver entera».
 */
.stage[data-folded] {
  --pad-top: 8px;
  --pad-bottom: 8px;
  --stage-max: 120px;
}

.stage[data-folded] .stage-foot,
.stage[data-folded] .caption {
  display: none;
}

/* A narrow stage: the foot controls keep the room, the caption gives way. */
@container (max-width: 760px) {
  .caption {
    display: none;
  }
}

.unfold {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 2;
}

@media (prefers-reduced-motion: reduce) {
  .stage {
    transition: none;
  }
}

.stage[data-scene='light'] {
  --scene-ink: rgba(16, 19, 24, 0.78);
  --scene-ink-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);

  background: #b9bdc2;
}

.scene {
  position: absolute;
  inset: 0;
  z-index: -1;
}

/*
 * Night: floodlit glows and a row of grandstand lights over a dark horizon, a grey kerb, then
 * asphalt lit in a pool where the sample sits, darker towards the foot.
 */
.stage[data-scene='dark'] .scene {
  background:
    radial-gradient(ellipse 34% 26% at 16% 36%, rgba(255, 246, 228, 0.2), transparent 70%),
    radial-gradient(ellipse 30% 24% at 84% 34%, rgba(232, 240, 255, 0.17), transparent 70%),
    radial-gradient(ellipse 70% 42% at 50% 62%, rgba(255, 255, 255, 0.07), transparent 72%),
    repeating-linear-gradient(90deg, rgba(255, 238, 205, 0.55) 0 2px, transparent 2px 29px) 0
      calc(41% - 5px) / 100% 2px no-repeat,
    linear-gradient(
      180deg,
      transparent 0 43.5%,
      rgba(205, 210, 216, 0.55) 43.5% 44%,
      transparent 44%
    ),
    repeating-linear-gradient(90deg, #565c64 0 18px, #c3c8ce 18px 36px) 0 41% / 100% 6px no-repeat,
    linear-gradient(180deg, transparent 0 62%, rgba(0, 0, 0, 0.32) 100%),
    linear-gradient(
      180deg,
      #06090e 0%,
      #0e1521 18%,
      #1a2333 34%,
      #2a3343 40.5%,
      #2c3037 40.5%,
      #25292f 52%,
      #1d2025 74%,
      #121417 100%
    );
}

/*
 * Day: a pale sky with the sun's glare at the top right and haze on the horizon, a light kerb,
 * then bright concrete with a glare streak: a translucent panel shows its worst over it.
 */
.stage[data-scene='light'] .scene {
  background:
    radial-gradient(
      circle at 82% 4%,
      rgba(255, 255, 255, 0.95) 0 2.5%,
      rgba(255, 251, 238, 0.6) 8%,
      transparent 32%
    ),
    radial-gradient(ellipse 55% 30% at 68% 64%, rgba(255, 255, 255, 0.32), transparent 72%),
    linear-gradient(
      180deg,
      transparent 0 43.5%,
      rgba(255, 255, 255, 0.85) 43.5% 44%,
      transparent 44%
    ),
    repeating-linear-gradient(90deg, #8a9097 0 18px, #f3f4f5 18px 36px) 0 41% / 100% 6px no-repeat,
    linear-gradient(180deg, transparent 0 66%, rgba(60, 66, 74, 0.16) 100%),
    linear-gradient(
      180deg,
      #86aed4 0%,
      #b2cde6 16%,
      #d9e6f1 32%,
      #eef3f7 40.5%,
      #cdd0d4 40.5%,
      #c3c7cb 56%,
      #b4b8bd 78%,
      #a5aab0 100%
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

/* The stage's foot, left of the caption: the scene and the fold, side by side. */
.stage-foot {
  position: absolute;
  left: 8px;
  bottom: 4px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* A dark pill that reads on either scene. */
.scene-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 1px 1px 1px 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--st-radius);
  background: rgba(11, 13, 16, 0.84);
}

.scene-label {
  color: var(--ov-fg-muted);
  font-family: var(--ov-font-small);
  font-size: var(--st-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.scene-seg {
  display: inline-flex;
  gap: 1px;
}

/* The settings segments, at the size of the caption beside them. */
.scene-seg .st-seg-text {
  min-height: 18px;
  padding: 1px 8px;
  font-size: var(--st-t-help);
}

.caption {
  position: absolute;
  right: 10px;
  bottom: 6px;
  color: var(--scene-ink);
  font-family: var(--ov-font-small);
  font-size: var(--st-t-caption);
  letter-spacing: 0.02em;
  text-shadow: var(--scene-ink-shadow);
  pointer-events: none;
}
</style>
