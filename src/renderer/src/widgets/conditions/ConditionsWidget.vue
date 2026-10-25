<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { WETNESS_MAX } from '@shared/conditions'
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
import { useWidgetTitle } from '@renderer/composables/useWidgetTitle'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import Badge from '@renderer/ui/Badge.vue'
import Icon from '@renderer/ui/Icon.vue'
import PanelHeader from '@renderer/ui/PanelHeader.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView } from '@renderer/view/reuse'
import type { InlineStyle } from '@renderer/view/styles'
import { PREVIEW_CONDITIONS } from './preview'
import {
  EMPTY_VIEW,
  conditionsView,
  layoutKey,
  linesOf,
  reuseParts,
  unwrapDeg,
  type ConditionsView,
  type ConditionsViewOptions,
  type LineId
} from './view'

const ID = 'conditions'
/** The wetness meter's cells, 1..WETNESS_MAX. */
const METER: readonly number[] = Object.freeze(Array.from({ length: WETNESS_MAX }, (_, i) => i + 1))

const options = useOptions(ID)
const prefs = useWidgetSettings(ID)
const appearance = useAppearance()
const autoHeight = useAutoHeight(ID)
const { surfaceStyle, halo } = useWidgetSurface(ID)
const t = useI18n()
const title = useWidgetTitle(ID)

/** The drawing options, one object while they are equal: a drag re-renders nothing. */
const viewOptions = computed<ConditionsViewOptions>((prev) =>
  reuseView(prev, {
    showTrackTemp: options.value.showTrackTemp,
    showTrend: options.value.showTrend,
    showAirTemp: options.value.showAirTemp,
    showWind: options.value.showWind,
    showWindDirection: options.value.showWindDirection,
    showWetness: options.value.showWetness,
    showPrecipitation: options.value.showPrecipitation,
    showDeclaredWet: options.value.showDeclaredWet,
    showSkies: options.value.showSkies,
    showRubber: options.value.showRubber
  })
)
const showHeader = computed(() => options.value.showHeader)
const units = computed(() => appearance.value.units)

// Payloads come only when something shown changes (SKIP_EMIT), so there is no freshness timer: a
// lost connection hides the widget through the phase.
const { data, phase } = useWidgetPhase(ID, {
  showsOffline: false,
  hasContent: (d) => linesOf(conditionsView(d, viewOptions.value, units.value, t.value)).length > 0
})

const preview = computed(() => phase.value === 'preview')
/** Live data, the sample in edit mode, or what was shown last (kept through the fade-out). */
const content = useShownContent(
  () => phase.value,
  () => data.value,
  () => PREVIEW_CONDITIONS
)

// Every part keeps its object while equal: a 1 Hz payload re-renders only the readings it moved.
const view = computed<ConditionsView>((prev) => {
  const d = content.value
  if (d === null) return prev ?? EMPTY_VIEW
  return reuseParts(prev, conditionsView(d, viewOptions.value, units.value, t.value))
})
const lines = computed<readonly LineId[]>(() => linesOf(view.value))
/** Without the header, the VISTA PREVIA tag goes at the end of the first line. */
const tagLine = computed<LineId | null>(() =>
  preview.value && !showHeader.value ? (lines.value[0] ?? null) : null
)

/**
 * The wind arrow's turn, unwrapped against the last one so it always turns the short way; kept
 * while there is no direction, so it comes back from where it was.
 */
const arrowDeg = computed<number | null>((prev) => {
  const from = view.value.wind?.fromDeg ?? null
  return from === null ? (prev ?? null) : unwrapDeg(prev ?? null, from)
})
const arrowStyle = computed<InlineStyle | undefined>(() =>
  arrowDeg.value === null ? undefined : { transform: `rotate(${arrowDeg.value}deg)` }
)

const wanted = computed(
  () => (phase.value === 'live' || phase.value === 'preview') && lines.value.length > 0
)
const shown = useReveal(
  () => wanted.value,
  () => layoutKey(view.value, showHeader.value),
  { fit: () => autoHeight.value }
)

// The panel is as tall as its lines, whatever the widget's height: its overlay panel fits to it.
// It only exists once there are lines (and then keeps the last ones while hidden), so the first
// height measured is the real one.
const panel = useTemplateRef('panel')
useContentSize(panel, { enabled: () => autoHeight.value && wanted.value })

/** The window grows upwards: the panel hugs the bottom edge while the window waits to shrink. */
const bottomAnchored = computed(() => autoHeight.value && prefs.value.anchor === 'bottom')
</script>

<template>
  <div class="ov-root cd-root ov-fade" :class="{ 'is-shown': shown, 'is-bottom': bottomAnchored }">
    <WidgetPanel
      v-if="lines.length > 0"
      ref="panel"
      class="cd-panel"
      :class="{ 'cd-panel--fixed': !autoHeight, 'cd-panel--head': showHeader }"
      :surface="surfaceStyle"
      :halo="halo"
      :fill="!autoHeight"
    >
      <template v-if="showHeader" #header>
        <PanelHeader :title="title">
          <PreviewTag v-if="preview" />
        </PanelHeader>
      </template>

      <!-- Temperatures: the track's with its trend, the air's at the end. -->
      <div v-if="view.track || view.air" class="cd-line">
        <span v-if="view.track" v-memo="[view.track]" class="cd-read">
          <span class="cd-label">{{ view.track.label }}</span>
          <span class="cd-num"
            >{{ view.track.value
            }}<span class="cd-unit ov-unit">&nbsp;{{ view.track.unit }}</span></span
          >
          <span
            v-if="view.track.trend"
            class="cd-trend"
            :class="{ 'cd-trend--steady': view.track.trend === 'minus' }"
            ><Icon :name="view.track.trend"
          /></span>
        </span>
        <span v-if="view.air" v-memo="[view.air]" class="cd-read cd-read--end">
          <span class="cd-label">{{ view.air.label }}</span>
          <span class="cd-num"
            >{{ view.air.value
            }}<span class="cd-unit ov-unit">&nbsp;{{ view.air.unit }}</span></span
          >
        </span>
        <PreviewTag v-if="tagLine === 'temps'" class="cd-tag" />
      </div>

      <!-- Wind: a dial with your car pointing up and an arrow on the side it blows from. -->
      <div v-if="view.wind" class="cd-line">
        <span class="cd-read">
          <span class="cd-label">{{ view.wind.label }}</span>
          <span
            v-if="view.wind.dial"
            class="cd-dial"
            :class="{ 'has-dir': view.wind.fromDeg !== null }"
            aria-hidden="true"
          >
            <svg class="cd-dial__face" viewBox="0 0 16 16" focusable="false">
              <circle class="cd-dial__ring" cx="8" cy="8" r="7.25" />
              <path
                class="cd-dial__car"
                d="M8 5.6c.7 0 1.1.5 1.1 1.15v3.6c0 .45-.35.8-.8.8h-.6c-.45 0-.8-.35-.8-.8v-3.6c0-.65.4-1.15 1.1-1.15z"
              />
            </svg>
            <span v-inline-style="arrowStyle" class="cd-dial__arrow">
              <svg viewBox="0 0 16 16" focusable="false">
                <path class="cd-dial__head" d="M8 5.3 4.7 1.2h6.6z" />
              </svg>
            </span>
          </span>
          <span class="cd-num"
            >{{ view.wind.value
            }}<span class="cd-unit ov-unit">&nbsp;{{ view.wind.unit }}</span></span
          >
          <span v-if="view.wind.side" class="cd-note">{{ view.wind.side }}</span>
        </span>
        <PreviewTag v-if="tagLine === 'wind'" class="cd-tag" />
      </div>

      <!-- The track surface: how wet (a 7-cell meter and its word), and the rain. -->
      <div v-if="view.wetness || view.rain" class="cd-line">
        <span v-if="view.wetness" v-memo="[view.wetness]" class="cd-read">
          <span class="cd-label">{{ view.wetness.label }}</span>
          <span v-if="view.wetness.level !== null" class="cd-meter" aria-hidden="true">
            <span
              v-for="i in METER"
              :key="i"
              class="cd-meter__cell"
              :class="{ 'is-on': i <= view.wetness.level }"
            />
          </span>
          <span class="cd-text" :class="{ 'cd-text--metered': view.wetness.level !== null }">{{
            view.wetness.value
          }}</span>
        </span>
        <span v-if="view.rain" v-memo="[view.rain]" class="cd-read cd-read--end">
          <span class="cd-label">{{ view.rain.label }}</span>
          <span class="cd-num">{{ view.rain.value }}</span>
        </span>
        <PreviewTag v-if="tagLine === 'surface'" class="cd-tag" />
      </div>

      <div v-if="view.sky || view.rubber" class="cd-line">
        <span v-if="view.sky" v-memo="[view.sky]" class="cd-read">
          <span class="cd-label">{{ view.sky.label }}</span>
          <span class="cd-text">{{ view.sky.value }}</span>
        </span>
        <span v-if="view.rubber" v-memo="[view.rubber]" class="cd-read cd-read--end">
          <span class="cd-label">{{ view.rubber.label }}</span>
          <span class="cd-text">{{ view.rubber.value }}</span>
        </span>
        <PreviewTag v-if="tagLine === 'sky'" class="cd-tag" />
      </div>

      <!-- The stewards allow rain tyres: a state, so a rail and a plate. -->
      <div v-if="view.declaredWet" v-memo="[view.declaredWet, tagLine]" class="cd-wet">
        <Badge tone="info">{{ view.declaredWet.label }}</Badge>
        <span class="cd-wet__note">{{ view.declaredWet.note }}</span>
        <PreviewTag v-if="tagLine === 'wet'" class="cd-tag" />
      </div>
    </WidgetPanel>
  </div>
</template>

<style scoped>
/* With the bottom edge anchored the panel hugs it while the window waits to shrink. */
.cd-root.is-bottom {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

/*
 * As tall as its lines (never sized by the window: no cqh, no height: 100%), so the window can
 * follow it without feedback. Only with the auto height off does the panel fill the window. The
 * panel is the inline-size container (em of the widget font) for the narrow-width rules.
 */
.cd-panel {
  flex: none;
  padding: 0.3em 0;
  container: conditions / inline-size;
}

.cd-panel--head {
  padding-top: 0;
}

.cd-panel--fixed {
  justify-content: center;
}

/*
 * One reading per side: the left one gives way (its words end in an ellipsis), the right one
 * keeps its size against the right edge. Fixed heights, so contain: strict is safe: a new value
 * re-lays out its own line only.
 */
.cd-line {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.8em;
  min-width: 0;
  height: 1.75em;
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  overflow: hidden;
  white-space: nowrap;
  contain: strict;
}

.cd-read {
  display: flex;
  flex: 0 1 auto;
  align-items: baseline;
  gap: 0.4em;
  min-width: 0;
  overflow: hidden;
}

.cd-read--end {
  flex: none;
  margin-left: auto;
}

/* Alone on its line (the left reading is off), it starts where the others do. */
.cd-read--end:first-child {
  margin-left: 0;
}

.cd-label {
  flex: none;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

.cd-num {
  flex: none;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.cd-unit {
  font-size: max(var(--ov-min-text), var(--ov-t-unit));
}

.cd-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: var(--ov-w-strong);
}

/* Words after a number ('de cara'): context, so muted, and the first to give way. */
.cd-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-body);
  color: var(--ov-fg-muted);
}

/* The trend is a shape, not a judgement: warmer is neither good nor bad. */
.cd-trend {
  display: flex;
  flex: none;
  align-self: center;
  font-size: 0.85em;
  color: var(--ov-fg-muted);
}

.cd-trend--steady {
  color: var(--ov-fg-dim);
}

.cd-tag {
  flex: none;
  align-self: center;
  margin-left: auto;
}

.cd-read--end + .cd-tag {
  margin-left: 0;
}

/* ---- Wind dial -------------------------------------------------------------------- */

/* A recessed disc with your car (the accent: it is you) pointing up, the arrow on its rim. */
.cd-dial {
  position: relative;
  flex: none;
  align-self: center;
  width: 1.6em;
  height: 1.6em;
}

.cd-dial__face,
.cd-dial__arrow {
  position: absolute;
  inset: 0;
}

.cd-dial__face {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cd-dial__ring {
  fill: var(--ov-well);
  stroke: var(--ov-tick-major);
  stroke-width: 1;
}

.cd-dial__car {
  fill: var(--ov-accent);
}

/* Without a direction (out of the car, calm) the car steps back and the arrow goes. */
.cd-dial:not(.has-dir) .cd-dial__car {
  fill: var(--ov-fg-dim);
}

/* Turned by its inline transform; a second's eased turn between two 1 Hz readings. */
.cd-dial__arrow {
  display: block;
  opacity: 0;
  transition: transform 0.8s ease-out;
}

.cd-dial.has-dir .cd-dial__arrow {
  opacity: 1;
}

.cd-dial__arrow svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cd-dial__head {
  fill: var(--ov-fg);
}

/* ---- Wetness meter ------------------------------------------------------------------ */

/* Seven recessed cells, filled up to the level in the information blue (water, no verdict). */
.cd-meter {
  display: flex;
  flex: none;
  align-self: center;
  gap: 1px;
}

.cd-meter__cell {
  width: 0.3em;
  height: 0.75em;
  border-radius: 1px;
  background: var(--ov-well);
  box-shadow: inset 0 0 0 1px var(--ov-tick);
}

.cd-meter__cell.is-on {
  background: var(--ov-info);
  box-shadow: none;
}

/* ---- Declared wet ------------------------------------------------------------------- */

.cd-wet {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
  height: 1.9em;
  margin-top: 0.2em;
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  border-top: 1px solid var(--ov-sep);
  overflow: hidden;
  white-space: nowrap;
  contain: strict;
}

/* The rail is state: wet running declared. */
.cd-wet::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--ov-bar-w);
  background: var(--ov-info);
}

.cd-wet__note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-body);
  color: var(--ov-fg-muted);
}

@media (prefers-reduced-motion: reduce) {
  .cd-dial__arrow {
    transition: none;
  }
}

/* ---- Narrow windows: the figures keep their room, the words go first ------------------ */

@container conditions (max-width: 22em) {
  .cd-wet__note {
    display: none;
  }
}

/* The dial says where the wind comes from and the meter how wet it is: their words go. */
@container conditions (max-width: 19em) {
  .cd-note,
  .cd-text--metered {
    display: none;
  }
}
</style>
