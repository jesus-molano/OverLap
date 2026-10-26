<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useAppearance } from '@renderer/composables/useAppearance'
import { useContentSize } from '@renderer/composables/useContentSize'
import { useI18n } from '@renderer/composables/useI18n'
import { useReveal } from '@renderer/composables/useReveal'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import {
  useAutoHeight,
  useOptions,
  useWidgetSettings
} from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView, reuseViews } from '@renderer/view/reuse'
import LightTile from './LightTile.vue'
import { PREVIEW_LIGHTS } from './preview'
import {
  hasLights,
  layoutKey,
  lightsFilter,
  lightsView,
  previewFilter,
  type LightView,
  type LightsFilter
} from './view'

const ID = 'lights'

const options = useOptions(ID)
const prefs = useWidgetSettings(ID)
const appearance = useAppearance()
const autoHeight = useAutoHeight(ID)
const { surfaceStyle, halo } = useWidgetSurface(ID)
const t = useI18n()

/** The options the strip reads, one object while they are equal: a drag re-renders nothing. */
const filter = computed<LightsFilter>((prev) => reuseView(prev, lightsFilter(options.value)))
const column = computed(() => options.value.layout === 'column')

// Payloads come only when a light or a reading changes (SKIP_EMIT), so there is no freshness
// timer: a lost connection hides the strip through the phase.
const { data, phase } = useWidgetPhase(ID, {
  showsOffline: false,
  hasContent: (d) => hasLights(d, filter.value, t.value)
})

const preview = computed(() => phase.value === 'preview')
/** Live data, the sample in edit mode, or what was shown last (kept through the fade-out). */
const content = useShownContent(
  () => phase.value,
  () => data.value,
  () => PREVIEW_LIGHTS
)
/** Frozen with the content while hidden, so nothing re-renders behind the fade. */
const shownFilter = computed<LightsFilter>((prev) => {
  if (phase.value === 'preview') return previewFilter(PREVIEW_LIGHTS, filter.value, t.value)
  if (phase.value === 'live') return filter.value
  return prev ?? filter.value
})

// Each light keeps its object while equal: a repair second re-renders that light alone.
const lights = computed<readonly LightView[]>((prev) =>
  reuseViews(
    prev,
    lightsView(content.value ?? { lights: [] }, shownFilter.value, appearance.value.units, t.value)
  )
)

const wanted = computed(
  () => (phase.value === 'live' || phase.value === 'preview') && lights.value.length > 0
)
const shown = useReveal(
  () => wanted.value,
  () => layoutKey(lights.value, options.value.layout),
  { fit: () => autoHeight.value }
)

// The panel is as tall as its lights, whatever the window's height: its overlay panel fits to
// it. It only exists once there are lights (and keeps the last ones while hidden), so the first
// height measured is the real one.
const panel = useTemplateRef('panel')
useContentSize(panel, { enabled: () => autoHeight.value && wanted.value })

/** The window grows upwards: the panel hugs the bottom edge while the window waits to shrink. */
const bottomAnchored = computed(() => autoHeight.value && prefs.value.anchor === 'bottom')
</script>

<template>
  <div
    class="ov-root wl-root wl-tones ov-fade"
    :class="{ 'is-shown': shown, 'is-bottom': bottomAnchored }"
  >
    <WidgetPanel
      v-if="lights.length > 0"
      ref="panel"
      class="wl-panel"
      :surface="surfaceStyle"
      :halo="halo"
    >
      <div class="wl-strip" :class="{ 'wl-strip--column': column }">
        <span
          v-for="light in lights"
          :key="light.kind"
          v-memo="[light]"
          class="wl-light"
          :class="`wl-light--${light.level}`"
        >
          <LightTile :icon="light.icon" :level="light.level" :label="light.label" />
          <span v-if="light.text" class="wl-text">{{ light.text }}</span>
        </span>
        <PreviewTag v-if="preview" class="wl-tag" />
      </div>
    </WidgetPanel>
  </div>
</template>

<style scoped>
/*
 * The strip of lights (LightTile.vue draws each one and its looks), with the words of the lit
 * ones in their colour. Nothing depends on the window height (no cqh, no height: 100%, font from
 * the scale setting): the content-to-window loop of the auto height cannot exist. Static: no
 * blinking.
 */

/* With the bottom edge anchored the panel hugs it while the window waits to shrink. */
.wl-root.is-bottom {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

/*
 * As small as its lights, whatever the window (a row wraps inside it, never past it); with the
 * auto height off too, so the strip never grows an empty band.
 */
.wl-panel {
  flex: none;
  width: max-content;
  max-width: 100%;
  padding: 0.3em;
}

.wl-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3em;
  min-width: 0;
}

.wl-strip--column {
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: flex-start;
}

/* A reading sits close to its own light, so it never reads as the next one's. */
.wl-light {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.2em;
  min-width: 0;
  max-width: 100%;
}

/*
 * In a row, the next light starts further from a reading than the reading from its own light.
 * After it, so a row that wraps starts its next line flush.
 */
.wl-strip:not(.wl-strip--column) > .wl-light:has(> .wl-text):not(:last-child) {
  margin-right: 0.4em;
}

/* The letter spacing after the last letter is taken back: the room after it is the strip's. */
.wl-text {
  min-width: 0;
  margin-right: calc(-1 * var(--ov-track-tag));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-body);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
  color: var(--ov-fg-dim);
}

.wl-light--alarm .wl-text {
  color: var(--wl-alarm-text);
}

.wl-light--warn .wl-text {
  color: var(--wl-warn);
}

.wl-light--caution .wl-text {
  color: var(--wl-caution);
}

.wl-light--info .wl-text {
  color: var(--wl-info);
}

.wl-tag {
  align-self: center;
}
</style>
