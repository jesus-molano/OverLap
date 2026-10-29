<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { arrayEqual } from '@shared/equal'
import { useContentSize } from '@renderer/composables/useContentSize'
import { useInfoBar } from '@renderer/composables/useInfoBar'
import { useI18n } from '@renderer/composables/useI18n'
import { useReveal } from '@renderer/composables/useReveal'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import {
  useAutoHeight,
  useOptions,
  useWidgetSettings
} from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import Badge from '@renderer/ui/Badge.vue'
import InfoBar from '@renderer/ui/InfoBar.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView } from '@renderer/view/reuse'
import type { InlineStyle } from '@renderer/view/styles'
import { orderStyle, placesOf } from '../orderStyle'
import { PREVIEW_FUEL } from './preview'
import {
  EMPTY_VIEW,
  LITRES,
  fuelView,
  fuelViewOptions,
  layoutKey,
  linesOf,
  reuseParts,
  type FuelView,
  type FuelViewOptions,
  type LineId
} from './view'

const ID = 'fuel'

const options = useOptions(ID)
const prefs = useWidgetSettings(ID)
const autoHeight = useAutoHeight(ID)
const { surfaceStyle, halo } = useWidgetSurface(ID)
const t = useI18n()

/** The drawing options, one object while they are equal: a drag re-renders nothing. */
const viewOptions = computed<FuelViewOptions>((prev) =>
  reuseView(prev, fuelViewOptions(options.value))
)

// Payloads come only when something shown changes (SKIP_EMIT), so there is no freshness timer: a
// lost connection hides the widget through the phase.
const { data, phase } = useWidgetPhase(ID, {
  showsOffline: false,
  hasContent: (d) => linesOf(fuelView(d, viewOptions.value, t.value)).length > 0
})

const preview = computed(() => phase.value === 'preview')
/** Live data, the sample in edit mode, or what was shown last (kept through the fade-out). */
const content = useShownContent(
  () => phase.value,
  () => data.value,
  () => PREVIEW_FUEL
)

/** The header: an info bar of any items (fuel.headerBar), off by default as the old band. */
const head = useInfoBar(ID, 'headerBar', () => content.value?.info ?? null)
const showHeader = computed(() => head.shown.value)

// Every line keeps its object while equal: a payload re-renders only the lines it moved.
const view = computed<FuelView>((prev) => {
  const d = content.value
  if (d === null) return prev ?? EMPTY_VIEW
  return reuseParts(prev, fuelView(d, viewOptions.value, t.value))
})
/** Each line's place in fuel.lines: CSS order, so a reorder re-creates no line. */
const place = computed(() => placesOf(viewOptions.value.order))
const lines = computed<readonly LineId[]>((prev) => {
  const next = linesOf(view.value, viewOptions.value.order)
  return prev !== undefined && arrayEqual(prev, next) ? prev : next
})
/** Without the header, the VISTA PREVIA tag goes at the end of the first line it fits on. */
const tagLine = computed<LineId | null>(() => {
  if (!preview.value || showHeader.value) return null
  // The hero's figures and the gauge have no room for it: the first line under them takes it.
  return lines.value.find((id) => id !== 'hero' && id !== 'gauge') ?? 'hero'
})

const fillStyle = computed<InlineStyle | undefined>(() => {
  const g = view.value.gauge
  return g === null ? undefined : { transform: `scaleX(${g.fill})` }
})
const needStyle = computed<InlineStyle | undefined>(() => {
  const need = view.value.gauge?.need ?? null
  return need === null ? undefined : { left: `${(need * 100).toFixed(1)}%` }
})

const wanted = computed(
  () => (phase.value === 'live' || phase.value === 'preview') && lines.value.length > 0
)
const shown = useReveal(
  () => wanted.value,
  () => layoutKey(view.value, showHeader.value, viewOptions.value.order),
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
  <div class="ov-root fu-root ov-fade" :class="{ 'is-shown': shown, 'is-bottom': bottomAnchored }">
    <WidgetPanel
      v-if="lines.length > 0"
      ref="panel"
      class="fu-panel"
      :class="{ 'fu-panel--fixed': !autoHeight, 'fu-panel--head': showHeader }"
      :surface="surfaceStyle"
      :halo="halo"
      :fill="!autoHeight"
    >
      <template v-if="showHeader" #header>
        <InfoBar
          :view="head.view.value"
          :size="head.size.value"
          place="head"
          sim
          :preview="preview"
          zone="fuel.headerBar"
        />
      </template>

      <!-- The fuel and the laps it lasts (in the tone of the plan), the laps to go at the end. -->
      <div
        v-if="view.hero"
        v-inline-style="orderStyle(place.hero ?? 0)"
        v-memo="[view.hero, tagLine, place.hero]"
        data-el="fuel.lines.hero"
        class="fu-hero"
      >
        <span class="fu-big">
          <span class="ov-t-hero">{{ view.hero.fuel }}</span>
          <span class="fu-unit-hero ov-unit">{{ LITRES }}</span>
        </span>
        <span class="fu-big" :class="`ov-tone-${view.hero.tone}`">
          <span class="ov-t-hero">{{ view.hero.laps }}</span>
          <span class="fu-unit-hero ov-unit">{{ view.hero.lapsUnit }}</span>
        </span>
        <span v-if="view.hero.note" class="fu-note">{{ view.hero.note }}</span>
        <span v-if="view.hero.left" class="fu-read fu-read--end">
          <span class="fu-label">{{ view.hero.left.label }}</span>
          <span class="fu-num"
            >{{ view.hero.left.value
            }}<span class="fu-unit ov-unit">&nbsp;{{ view.hero.left.unit }}</span></span
          >
        </span>
        <PreviewTag v-if="tagLine === 'hero'" class="fu-tag" />
      </div>

      <!-- The tank: the fuel against what it holds, a tick where the fuel to the flag reaches. -->
      <div
        v-if="view.gauge"
        v-inline-style="orderStyle(place.gauge ?? 0)"
        data-el="fuel.lines.gauge"
        class="fu-gauge"
        aria-hidden="true"
      >
        <span class="fu-gauge__track">
          <span
            v-inline-style="fillStyle"
            class="fu-gauge__fill"
            :class="`fu-gauge__fill--${view.gauge.tone}`"
          />
          <span v-if="view.gauge.need !== null" v-inline-style="needStyle" class="fu-gauge__need" />
        </span>
      </div>

      <div
        v-if="view.perLap"
        v-inline-style="orderStyle(place.perLap ?? 0)"
        v-memo="[view.perLap, tagLine, place.perLap]"
        data-el="fuel.lines.perLap"
        class="fu-line"
      >
        <span class="fu-read">
          <span class="fu-label">{{ view.perLap.label }}</span>
          <span v-if="view.perLap.measuring" class="fu-text fu-text--muted">{{
            view.perLap.value
          }}</span>
          <span v-else class="fu-num"
            >{{ view.perLap.value
            }}<span class="fu-unit ov-unit">&nbsp;{{ view.perLap.unit }}</span></span
          >
          <span v-if="view.perLap.note" class="fu-note">{{ view.perLap.note }}</span>
        </span>
        <PreviewTag v-if="tagLine === 'perLap'" class="fu-tag" />
      </div>

      <div
        v-if="view.finish"
        v-inline-style="orderStyle(place.finish ?? 0)"
        v-memo="[view.finish, tagLine, place.finish]"
        data-el="fuel.lines.finish"
        class="fu-line"
      >
        <span class="fu-read">
          <span class="fu-label">{{ view.finish.need.label }}</span>
          <span class="fu-num"
            >{{ view.finish.need.value
            }}<span class="fu-unit ov-unit">&nbsp;{{ view.finish.need.unit }}</span></span
          >
        </span>
        <span class="fu-read fu-read--end">
          <span class="fu-label">{{ view.finish.add.label }}</span>
          <span class="fu-num" :class="`ov-tone-${view.finish.addTone}`"
            >{{ view.finish.add.value
            }}<span v-if="view.finish.add.unit" class="fu-unit ov-unit"
              >&nbsp;{{ view.finish.add.unit }}</span
            ></span
          >
          <Badge
            v-if="view.finish.box"
            class="fu-box"
            :tone="view.finish.box.tone"
            variant="outline"
            >{{ view.finish.box.text }}</Badge
          >
        </span>
        <PreviewTag v-if="tagLine === 'finish'" class="fu-tag" />
      </div>

      <div
        v-if="view.window"
        v-inline-style="orderStyle(place.window ?? 0)"
        v-memo="[view.window, tagLine, place.window]"
        data-el="fuel.lines.window"
        class="fu-line"
      >
        <span class="fu-read">
          <span class="fu-label">{{ view.window.label }}</span>
          <span class="fu-num" :class="`ov-tone-${view.window.tone}`">{{ view.window.value }}</span>
        </span>
        <span class="fu-read fu-read--end">
          <span class="fu-text" :class="`ov-tone-${view.window.stopsTone}`">{{
            view.window.stops
          }}</span>
        </span>
        <PreviewTag v-if="tagLine === 'window'" class="fu-tag" />
      </div>

      <div
        v-if="view.save"
        v-inline-style="orderStyle(place.save ?? 0)"
        v-memo="[view.save, tagLine, place.save]"
        data-el="fuel.lines.save"
        class="fu-line"
      >
        <span class="fu-read">
          <span class="fu-label">{{ view.save.label }}</span>
          <span class="fu-num"
            >{{ view.save.value
            }}<span class="fu-unit ov-unit">&nbsp;{{ view.save.unit }}</span></span
          >
          <span class="fu-note">{{ view.save.note }}</span>
        </span>
        <PreviewTag v-if="tagLine === 'save'" class="fu-tag" />
      </div>

      <!-- The tread left at the last stop: one figure per tyre, front pair first. -->
      <div
        v-if="view.tyres"
        v-inline-style="orderStyle(place.tyres ?? 0)"
        v-memo="[view.tyres, tagLine, place.tyres]"
        data-el="fuel.lines.tyres"
        class="fu-line"
      >
        <span class="fu-read">
          <span class="fu-label">{{ view.tyres.label }}</span>
          <span class="fu-note fu-note--lap">{{ view.tyres.lap }}</span>
        </span>
        <span class="fu-tyres">
          <span v-for="c in view.tyres.corners" :key="c.name" class="fu-tyre">
            <span class="fu-label">{{ c.name }}</span>
            <span class="fu-num fu-num--small">{{ c.value }}</span>
          </span>
          <span class="fu-pct fu-unit ov-unit">%</span>
        </span>
        <PreviewTag v-if="tagLine === 'tyres'" class="fu-tag" />
      </div>

      <div
        v-if="view.limits"
        v-inline-style="orderStyle(place.limits ?? 0)"
        v-memo="[view.limits, tagLine, place.limits]"
        data-el="fuel.lines.limits"
        class="fu-line"
      >
        <span v-if="view.limits.repairs" class="fu-read">
          <span class="fu-label">{{ view.limits.repairs.label }}</span>
          <span class="fu-num">{{ view.limits.repairs.value }}</span>
        </span>
        <span v-if="view.limits.sets" class="fu-read fu-read--end">
          <span class="fu-label">{{ view.limits.sets.label }}</span>
          <span class="fu-num">{{ view.limits.sets.value }}</span>
        </span>
        <PreviewTag v-if="tagLine === 'limits'" class="fu-tag" />
      </div>
    </WidgetPanel>
  </div>
</template>

<style scoped>
/* With the bottom edge anchored the panel hugs it while the window waits to shrink. */
.fu-root.is-bottom {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

/*
 * As tall as its lines (never sized by the window: no cqh, no height: 100%), so the window can
 * follow it without feedback. Only with the auto height off does the panel fill the window. The
 * panel is the inline-size container (em of the widget font) for the narrow-width rules.
 */
.fu-panel {
  flex: none;
  padding: 0.3em 0;
  container: fuel / inline-size;
}

.fu-panel--head {
  padding-top: 0;
}

.fu-panel--fixed {
  justify-content: center;
}

/* ---- Hero: the fuel and its laps ------------------------------------------------- */

.fu-hero {
  display: flex;
  flex: none;
  align-items: baseline;
  gap: 0.7em;
  min-width: 0;
  height: 2.6em;
  padding: 0.25em 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  overflow: hidden;
  white-space: nowrap;
  contain: strict;
}

.fu-big {
  display: flex;
  flex: none;
  align-items: baseline;
}

.fu-unit-hero {
  margin-left: 0.15em;
  font-size: max(var(--ov-min-text), calc(var(--ov-t-hero) * var(--ov-t-unit-hero)));
}

/* ---- Lines --------------------------------------------------------------------- */

/*
 * One reading per side: the left one gives way (its words end in an ellipsis), the right one
 * keeps its size against the right edge. Fixed heights, so contain: strict is safe: a new value
 * re-lays out its own line only.
 */
.fu-line {
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

.fu-read {
  display: flex;
  flex: 0 1 auto;
  align-items: baseline;
  gap: 0.4em;
  min-width: 0;
  overflow: hidden;
}

.fu-read--end {
  flex: none;
  margin-left: auto;
}

/* Alone on its line (the left reading is off), it starts where the others do. */
.fu-read--end:first-child {
  margin-left: 0;
}

.fu-label {
  flex: none;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

.fu-num {
  flex: none;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.fu-num--small {
  font-size: var(--ov-t-body);
}

.fu-unit {
  font-size: max(var(--ov-min-text), var(--ov-t-unit));
}

.fu-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: var(--ov-w-strong);
}

.fu-text--muted {
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

/* Words after a number ('últ. 3.02 · máx. 3.10'): context, so muted, and the first to give way. */
.fu-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-body);
  color: var(--ov-fg-muted);
}

.fu-note--lap {
  flex: none;
}

.fu-box {
  align-self: center;
}

.fu-tyres {
  display: flex;
  flex: none;
  align-items: baseline;
  gap: 0.55em;
  margin-left: auto;
}

.fu-tyre {
  display: flex;
  align-items: baseline;
  gap: 0.25em;
}

.fu-tag {
  flex: none;
  align-self: center;
  margin-left: auto;
}

.fu-read--end + .fu-tag,
.fu-tyres + .fu-tag {
  margin-left: 0;
}

/* ---- Tank gauge --------------------------------------------------------------------- */

.fu-gauge {
  display: flex;
  flex: none;
  align-items: center;
  height: 0.75em;
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  contain: strict;
}

/* A recessed track; the fill grows from the left (a transform, eased between payloads). */
.fu-gauge__track {
  position: relative;
  flex: 1 1 auto;
  height: 0.35em;
  border-radius: 1px;
  background: var(--ov-well);
  box-shadow: inset 0 0 0 1px var(--ov-tick);
  overflow: hidden;
}

.fu-gauge__fill {
  position: absolute;
  inset: 0;
  transform-origin: 0 50%;
  background: var(--ov-fg-muted);
  transition: transform 0.8s ease-out;
}

.fu-gauge__fill--good {
  background: var(--ov-good);
}

.fu-gauge__fill--bad {
  background: var(--ov-bad);
}

/* Where the fuel to the flag reaches: a tick across the track. */
.fu-gauge__need {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--ov-fg);
}

@media (prefers-reduced-motion: reduce) {
  .fu-gauge__fill {
    transition: none;
  }
}

/* ---- Narrow windows: the figures keep their room, the words go first ------------------ */

@container fuel (max-width: 22em) {
  .fu-box,
  .fu-note {
    display: none;
  }

  .fu-note--lap {
    display: inline;
  }
}

/*
 * The hero's two figures and the four tyres keep their room: the laps to go, the reading's lap
 * and the % sign go.
 */
@container fuel (max-width: 21em) {
  .fu-hero .fu-read--end,
  .fu-note--lap,
  .fu-pct {
    display: none;
  }
}
</style>
