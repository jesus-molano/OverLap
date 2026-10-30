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
import Icon from '@renderer/ui/Icon.vue'
import InfoBar from '@renderer/ui/InfoBar.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView } from '@renderer/view/reuse'
import type { InlineStyle } from '@renderer/view/styles'
import { orderStyle, placesOf } from '../orderStyle'
import {
  CAR_AXLES,
  CAR_BODY,
  CAR_COCKPIT,
  CAR_VIEWBOX,
  TYRE_BANDS,
  TYRE_GROOVES,
  TYRE_OUTLINES
} from './carShape'
import { PREVIEW_FUEL } from './preview'
import {
  EMPTY_VIEW,
  LITRES,
  SPARK_H,
  SPARK_W,
  fuelView,
  fuelViewOptions,
  layoutKey,
  linesOf,
  reuseParts,
  type FuelView,
  type FuelViewOptions,
  type LineId,
  type SparkDot
} from './view'

const ID = 'fuel'
const SPARK_BOX = `0 0 ${SPARK_W} ${SPARK_H}`

const options = useOptions(ID)
const prefs = useWidgetSettings(ID)
const autoHeight = useAutoHeight(ID)
const { surfaceStyle, halo } = useWidgetSurface(ID)
const t = useI18n()

/**
 * The drawing options, one object while they are equal: a drag re-renders nothing. With the auto
 * height off the tyres line waits for a reading (the window is sized for the lines it has).
 */
const viewOptions = computed<FuelViewOptions>((prev) =>
  reuseView(prev, fuelViewOptions(options.value, autoHeight.value))
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

/**
 * The header and footer info bars (fuel.headerBar / footerBar): the header off by default as the
 * old band, the footer off.
 */
const head = useInfoBar(ID, 'headerBar', () => content.value?.info ?? null)
const foot = useInfoBar(ID, 'footerBar', () => content.value?.info ?? null)
const showHeader = computed(() => head.shown.value)
const showFooter = computed(() => foot.shown.value)

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
  // The hero's figures, the gauge and the car have no room for it: the first line under them.
  return lines.value.find((id) => id !== 'hero' && id !== 'gauge' && id !== 'tyres') ?? 'hero'
})

// ---- Geometry to inline styles (fractions of a track; each line its own, so a payload that
// moves one bar rewrites one element) ----

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`
const at = (v: number): InlineStyle => ({ left: pct(v) })
const span = (from: number, to: number): InlineStyle => ({
  left: pct(from),
  width: pct(Math.max(0, to - from))
})
const grow = (v: number): InlineStyle => ({ transform: `scaleX(${v})` })

const tank = computed(() => {
  const g = view.value.gauge
  if (g === null) return null
  return {
    fill: grow(g.fill),
    short: g.short && g.need !== null ? span(g.fill, g.need) : undefined,
    need: g.need === null ? undefined : at(g.need),
    laps: g.lapStep === null ? undefined : { '--fu-step': pct(g.lapStep) },
    five: g.fiveStep === null ? undefined : { '--fu-step': pct(g.fiveStep) }
  }
})

const box = computed(() => {
  const b = view.value.finish?.box ?? null
  return b === null ? null : { fill: grow(b.fill), mark: at(b.mark) }
})

const race = computed(() => {
  const w = view.value.window
  if (w === null) return null
  const tr = w.track
  return {
    past: grow(tr.now),
    win: tr.from !== null && tr.to !== null ? span(tr.from, Math.max(tr.to, tr.from)) : undefined,
    now: at(tr.now)
  }
})

const save = computed(() => {
  const s = view.value.save
  return s === null ? null : { keep: grow(s.target), cut: span(s.target, 1) }
})

/** A sparkline dot: a zero-length round-capped stroke, round whatever the box's stretch. */
const dot = (p: SparkDot): string => `M${p.x} ${p.y}h0`
const join = (a: SparkDot, b: SparkDot): string => `M${a.x} ${a.y}L${b.x} ${b.y}`

const wanted = computed(
  () => (phase.value === 'live' || phase.value === 'preview') && lines.value.length > 0
)
const shown = useReveal(
  () => wanted.value,
  () =>
    `${layoutKey(view.value, showHeader.value, viewOptions.value.order)}${showFooter.value ? '|f' : ''}`,
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
      :class="{
        'fu-panel--fixed': !autoHeight,
        'fu-panel--head': showHeader,
        'fu-panel--foot': showFooter
      }"
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

      <!-- The laps the fuel lasts (big, in the tone of the plan), the litres, the laps to go. -->
      <div
        v-if="view.hero"
        v-inline-style="orderStyle(place.hero ?? 0)"
        data-el="fuel.lines.hero"
        class="fu-hero"
      >
        <span class="fu-big" :class="`ov-tone-${view.hero.tone}`">
          <span class="ov-t-hero">{{ view.hero.laps }}</span>
          <span class="fu-unit-hero ov-unit">&nbsp;{{ view.hero.lapsUnit }}</span>
        </span>
        <span class="fu-num fu-litres"
          >{{ view.hero.fuel }}<span class="fu-unit ov-unit">&nbsp;{{ LITRES }}</span></span
        >
        <span v-if="view.hero.note" class="fu-note">{{ view.hero.note }}</span>
        <span v-if="view.hero.left" class="fu-flagged fu-hero__left">
          <Icon name="chequered" class="fu-ico" />
          <span class="fu-label fu-flag-label">{{ view.hero.left.label }}</span>
          <span class="fu-num"
            >{{ view.hero.left.value
            }}<span class="fu-unit ov-unit">&nbsp;{{ view.hero.left.unit }}</span></span
          >
        </span>
        <PreviewTag v-if="tagLine === 'hero'" class="fu-tag" />
      </div>

      <!--
        The tank: the fuel against what it holds, graduated in laps of fuel (every lap, stronger
        every five); the flag mark where the fuel to the flag reaches, the gap to it shaded.
      -->
      <div
        v-if="view.gauge && tank"
        v-inline-style="orderStyle(place.gauge ?? 0)"
        data-el="fuel.lines.gauge"
        class="fu-gauge"
        aria-hidden="true"
      >
        <span class="fu-tank">
          <span
            v-inline-style="tank.fill"
            class="fu-tank__fill"
            :class="`fu-tank__fill--${view.gauge.tone}`"
          />
          <span v-if="tank.short" v-inline-style="tank.short" class="fu-tank__short" />
          <span v-if="tank.laps" v-inline-style="tank.laps" class="fu-tank__ticks" />
          <span
            v-if="tank.five"
            v-inline-style="tank.five"
            class="fu-tank__ticks fu-tank__ticks--five"
          />
          <span v-if="tank.need" v-inline-style="tank.need" class="fu-tank__need" />
        </span>
      </div>

      <!-- Litres per lap, and the laps behind it as a line: the average dashed, max and last. -->
      <div
        v-if="view.perLap"
        v-inline-style="orderStyle(place.perLap ?? 0)"
        data-el="fuel.lines.perLap"
        class="fu-line"
      >
        <span class="fu-label">{{ view.perLap.label }}</span>
        <span v-if="view.perLap.measuring" class="fu-text fu-text--muted">{{
          view.perLap.value
        }}</span>
        <span v-else class="fu-num"
          >{{ view.perLap.value
          }}<span class="fu-unit ov-unit">&nbsp;{{ view.perLap.unit }}</span></span
        >
        <svg
          v-if="view.perLap.spark"
          class="fu-spark"
          :viewBox="SPARK_BOX"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            class="fu-spark__avg"
            x1="0"
            :x2="SPARK_W"
            :y1="view.perLap.spark.avgY"
            :y2="view.perLap.spark.avgY"
          />
          <polyline class="fu-spark__line" :points="view.perLap.spark.points" />
          <path
            v-if="view.perLap.spark.tail && view.perLap.spark.last"
            class="fu-spark__tail"
            :d="join(view.perLap.spark.tail, view.perLap.spark.last)"
          />
          <path
            v-if="view.perLap.spark.max"
            class="fu-spark__dot fu-spark__dot--max"
            :d="dot(view.perLap.spark.max)"
          />
          <path
            v-if="view.perLap.spark.last"
            class="fu-spark__dot"
            :d="dot(view.perLap.spark.last)"
          />
        </svg>
        <span v-if="view.perLap.note" class="fu-note">{{ view.perLap.note }}</span>
        <PreviewTag v-if="tagLine === 'perLap'" class="fu-tag" />
      </div>

      <!-- What to add (or spare, or short), the pit menu as a bar marked where you need it. -->
      <div
        v-if="view.finish"
        v-inline-style="orderStyle(place.finish ?? 0)"
        data-el="fuel.lines.finish"
        class="fu-line"
      >
        <span class="fu-label">{{ view.finish.add.label }}</span>
        <span class="fu-num" :class="`ov-tone-${view.finish.addTone}`"
          >{{ view.finish.add.value
          }}<span v-if="view.finish.add.unit" class="fu-unit ov-unit"
            >&nbsp;{{ view.finish.add.unit }}</span
          ></span
        >
        <span
          v-if="view.finish.box && box"
          class="fu-menu"
          :class="`ov-tone-${view.finish.box.tone}`"
        >
          <span class="fu-label fu-menu__label">{{ view.finish.box.label }}</span>
          <span class="fu-bar fu-menu__bar" aria-hidden="true">
            <span v-inline-style="box.fill" class="fu-bar__fill" />
            <span v-inline-style="box.mark" class="fu-bar__mark" />
          </span>
          <span class="fu-num fu-num--small"
            >{{ view.finish.box.value
            }}<span class="fu-unit ov-unit">&nbsp;{{ LITRES }}</span></span
          >
        </span>
        <!-- Its caption in words (PARA META): no flag here, it would be the third in a few rows. -->
        <span class="fu-flagged fu-end">
          <span class="fu-label">{{ view.finish.need.label }}</span>
          <span class="fu-num fu-num--small"
            >{{ view.finish.need.value
            }}<span class="fu-unit ov-unit">&nbsp;{{ view.finish.need.unit }}</span></span
          >
        </span>
        <PreviewTag v-if="tagLine === 'finish'" class="fu-tag" />
      </div>

      <!-- The race as a line to the flag: you, and the laps you can stop at the end of. -->
      <div
        v-if="view.window && race"
        v-inline-style="orderStyle(place.window ?? 0)"
        data-el="fuel.lines.window"
        class="fu-line"
      >
        <span class="fu-label">{{ view.window.label }}</span>
        <span class="fu-race" aria-hidden="true">
          <span class="fu-race__track">
            <span v-inline-style="race.past" class="fu-race__past" />
            <span
              v-if="race.win"
              v-inline-style="race.win"
              class="fu-race__win"
              :class="`fu-race__win--${view.window.tone}`"
            />
          </span>
          <span v-inline-style="race.now" class="fu-race__now" />
          <Icon name="chequered" class="fu-race__flag" />
        </span>
        <span
          v-if="view.window.value"
          class="fu-num fu-num--small"
          :class="`ov-tone-${view.window.tone}`"
          >{{ view.window.value }}</span
        >
        <!-- In words, '1 parada': a pit sign and a count read as a position (P1). -->
        <span class="fu-text fu-stops" :class="`ov-tone-${view.window.stopsTone}`">{{
          view.window.stopsText
        }}</span>
        <PreviewTag v-if="tagLine === 'window'" class="fu-tag" />
      </div>

      <!-- The target per lap on a bar that ends at your average: the stripes are the cut. -->
      <div
        v-if="view.save && save"
        v-inline-style="orderStyle(place.save ?? 0)"
        data-el="fuel.lines.save"
        class="fu-line"
      >
        <span class="fu-label">{{ view.save.label }}</span>
        <span class="fu-num"
          >{{ view.save.value
          }}<span class="fu-unit ov-unit">&nbsp;{{ view.save.unit }}</span></span
        >
        <span class="fu-bar fu-save" aria-hidden="true">
          <span v-inline-style="save.keep" class="fu-bar__fill fu-save__keep" />
          <span v-inline-style="save.cut" class="fu-save__cut" />
        </span>
        <span class="fu-num fu-num--small ov-tone-warn">{{ view.save.cut }}</span>
        <span class="fu-note fu-end">{{ view.save.note }}</span>
        <PreviewTag v-if="tagLine === 'save'" class="fu-tag" />
      </div>

      <!--
        The car from above: each tyre's three tread bands on the wear ramp and its most worn %,
        as the crew measured them at the last stop; dim until a stop does.
      -->
      <div
        v-if="view.tyres"
        v-inline-style="orderStyle(place.tyres ?? 0)"
        data-el="fuel.lines.tyres"
        class="fu-tyres"
        :class="{ 'is-dim': !view.tyres.measured }"
      >
        <!-- One name for the car and its figures ('Neumáticos: DI 78 %, …'): an image's label. -->
        <span class="fu-car" role="img" :aria-label="view.tyres.a11y">
          <span class="fu-car__num fu-car__num--l fu-num">{{ view.tyres.tyres[0].value }}</span>
          <svg class="fu-car__svg" :viewBox="CAR_VIEWBOX" aria-hidden="true">
            <path class="fu-car__axle" :d="CAR_AXLES" />
            <path class="fu-car__body" :d="CAR_BODY" />
            <path class="fu-car__cockpit" :d="CAR_COCKPIT" />
            <template v-for="(tyre, i) in view.tyres.tyres" :key="tyre.name">
              <path
                v-for="(level, j) in tyre.bands"
                :key="j"
                :d="TYRE_BANDS[i]?.[j]"
                :class="level === null ? 'fu-w' : `fu-w fu-w${level}`"
              />
              <path class="fu-car__tyre" :d="TYRE_OUTLINES[i]" />
            </template>
            <path class="fu-car__grooves" :d="TYRE_GROOVES" />
          </svg>
          <span class="fu-car__num fu-car__num--r fu-num">{{ view.tyres.tyres[1].value }}</span>
          <span class="fu-car__num fu-car__num--l fu-num">{{ view.tyres.tyres[2].value }}</span>
          <span class="fu-car__num fu-car__num--r fu-num">{{ view.tyres.tyres[3].value }}</span>
        </span>
        <span class="fu-tyres__meta">
          <span class="fu-label">{{ view.tyres.label }}</span>
          <span class="fu-note fu-tyres__when">{{ view.tyres.note }}</span>
          <span class="fu-note fu-tyres__short">{{ view.tyres.shortNote }}</span>
          <span v-if="view.tyres.sets" class="fu-tyres__sets" :title="view.tyres.sets.label">
            <span class="fu-num fu-num--small">{{ view.tyres.sets.value }}</span>
            <span class="fu-unit ov-unit">{{ view.tyres.sets.unit }}</span>
          </span>
        </span>
      </div>

      <div
        v-if="view.limits"
        v-inline-style="orderStyle(place.limits ?? 0)"
        data-el="fuel.lines.limits"
        class="fu-line"
      >
        <span v-if="view.limits.repairs" class="fu-count">
          <span class="fu-label">{{ view.limits.repairs.label }}</span>
          <span class="fu-num">{{ view.limits.repairs.value }}</span>
          <span v-if="view.limits.repairs.pips > 0" class="fu-pips" aria-hidden="true">
            <span v-for="k in view.limits.repairs.pips" :key="k" class="fu-pip" />
          </span>
        </span>
        <span v-if="view.limits.sets" class="fu-count fu-end">
          <span class="fu-label">{{ view.limits.sets.label }}</span>
          <span class="fu-num">{{ view.limits.sets.value }}</span>
          <span v-if="view.limits.sets.pips > 0" class="fu-pips" aria-hidden="true">
            <span v-for="k in view.limits.sets.pips" :key="k" class="fu-pip" />
          </span>
        </span>
        <PreviewTag v-if="tagLine === 'limits'" class="fu-tag" />
      </div>

      <InfoBar
        v-if="showFooter"
        class="fu-foot"
        :view="foot.view.value"
        :size="foot.size.value"
        place="foot"
        zone="fuel.footerBar"
      />
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

.fu-panel--foot {
  padding-bottom: 0;
}

/* After every line, whatever their order (CSS order); at the bottom of a fixed-size panel. */
.fu-foot {
  order: 1000;
  margin-top: auto;
}

.fu-panel--fixed {
  justify-content: center;
}

/* ---- Hero: the laps of fuel, the litres, the laps to go ----------------------------- */

.fu-hero {
  display: flex;
  flex: none;
  align-items: baseline;
  gap: 0.6em;
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

/* The space before it is a no-break one in the text, as every unit's ('17.6 laps'). */
.fu-unit-hero {
  font-size: max(var(--ov-min-text), calc(var(--ov-t-hero) * var(--ov-t-unit-hero)));
}

.fu-hero__left {
  margin-left: auto;
}

/* ---- Lines --------------------------------------------------------------------- */

/*
 * A caption, one figure and its graphic; whatever is at the end keeps its size against the
 * right edge. Fixed heights, so contain: strict is safe: a new value re-lays out its own line.
 */
.fu-line {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
  height: 1.75em;
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  overflow: hidden;
  white-space: nowrap;
  contain: strict;
}

.fu-end {
  margin-left: auto;
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
  font-variant-numeric: tabular-nums;
}

.fu-num--small {
  font-size: var(--ov-t-body);
}

.fu-unit {
  font-size: max(var(--ov-min-text), var(--ov-t-unit));
}

.fu-text {
  flex: none;
  font-weight: var(--ov-w-strong);
}

.fu-text--muted {
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

/* Words after a figure: context, so muted, and the first to give way. */
.fu-note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-body);
  color: var(--ov-fg-muted);
}

/* A figure after its caption (PARA META), or the flag and its caption (QUEDAN); stops in words. */
.fu-flagged,
.fu-stops {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.3em;
}

.fu-ico {
  font-size: 0.85em;
  color: var(--ov-fg-muted);
}

.fu-stops {
  margin-left: auto;
}

.fu-tag {
  flex: none;
  align-self: center;
  margin-left: auto;
}

.fu-end + .fu-tag,
.fu-stops + .fu-tag {
  margin-left: 0;
}

/* ---- Bars: a recessed track, a fill growing from the left (a transform) ----------- */

.fu-bar {
  position: relative;
  flex: 1 1 auto;
  height: 0.4em;
  border-radius: 1px;
  background: var(--ov-well);
  box-shadow: inset 0 0 0 1px var(--ov-tick);
}

.fu-bar__fill {
  position: absolute;
  inset: 0;
  border-radius: 1px;
  transform-origin: 0 50%;
  background: currentColor;
  opacity: 0.75;
}

/* A mark across a bar: where you need it to reach. */
.fu-bar__mark {
  position: absolute;
  top: -0.2em;
  bottom: -0.2em;
  width: 2px;
  margin-left: -1px;
  background: var(--ov-fg);
}

/* ---- Tank gauge --------------------------------------------------------------------- */

.fu-gauge {
  display: flex;
  flex: none;
  align-items: center;
  height: 1.1em;
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  contain: strict;
}

.fu-tank {
  position: relative;
  flex: 1 1 auto;
  height: 0.6em;
  border-radius: 2px;
  background: var(--ov-well);
  box-shadow: inset 0 0 0 1px var(--ov-tick);
}

.fu-tank__fill {
  position: absolute;
  inset: 0;
  border-radius: 2px;
  transform-origin: 0 50%;
  background: var(--ov-fg-muted);
  transition: transform 0.8s ease-out;
}

.fu-tank__fill--good {
  background: var(--ov-good);
}

.fu-tank__fill--bad {
  background: var(--ov-bad);
}

/* What is missing to the flag: the stretch between the fuel and the mark, striped. */
.fu-tank__short {
  position: absolute;
  top: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--ov-bad) 55%, transparent) 0 2px,
    transparent 2px 4px
  );
}

/* One lap of fuel per graduation: a cut across the fill, stronger every five laps. */
.fu-tank__ticks {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to right,
    transparent 0 calc(var(--fu-step) - 1px),
    rgba(12, 14, 18, 0.45) calc(var(--fu-step) - 1px) var(--fu-step)
  );
}

.fu-tank__ticks--five {
  background: repeating-linear-gradient(
    to right,
    transparent 0 calc(var(--fu-step) - 1.5px),
    rgba(12, 14, 18, 0.85) calc(var(--fu-step) - 1.5px) var(--fu-step)
  );
}

/* Where the fuel to the flag reaches: a mark standing out of the tank. */
.fu-tank__need {
  position: absolute;
  top: -0.25em;
  bottom: -0.25em;
  width: 2px;
  margin-left: -1px;
  background: var(--ov-fg);
}

@media (prefers-reduced-motion: reduce) {
  .fu-tank__fill {
    transition: none;
  }
}

/* ---- Consumption sparkline ------------------------------------------------------------ */

.fu-spark {
  flex: 1 1 auto;
  min-width: 3em;
  max-width: 10em;
  height: 1.15em;
  overflow: visible;
}

.fu-spark__avg {
  stroke: var(--ov-tick-major);
  stroke-width: 1px;
  stroke-dasharray: 2 2;
  vector-effect: non-scaling-stroke;
}

.fu-spark__line,
.fu-spark__tail {
  fill: none;
  stroke: var(--ov-fg-muted);
  stroke-width: 1.4px;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

/* The last lap was not a clean one: off the line, joined dashed. */
.fu-spark__tail {
  stroke-dasharray: 2 2;
}

.fu-spark__dot {
  stroke: var(--ov-fg);
  stroke-width: 5px;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.fu-spark__dot--max {
  stroke: var(--ov-warn);
  stroke-width: 4px;
}

/* ---- Pit menu against what to add ------------------------------------------------------- */

.fu-menu {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 0.35em;
  min-width: 0;
}

.fu-menu__label {
  color: inherit;
}

.fu-menu__bar {
  flex: 0 1 3.2em;
  min-width: 1.6em;
}

/* ---- The race: past, window, you, the flag ------------------------------------------- */

.fu-race {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 4em;
  height: 100%;
  padding-right: 0.95em;
}

.fu-race__track {
  position: relative;
  flex: 1 1 auto;
  height: 0.3em;
  border-radius: 1px;
  background: var(--ov-well);
  box-shadow: inset 0 0 0 1px var(--ov-tick);
}

.fu-race__past {
  position: absolute;
  inset: 0;
  transform-origin: 0 50%;
  background: var(--ov-tick-major);
}

.fu-race__win {
  position: absolute;
  top: -0.2em;
  bottom: -0.2em;
  border-radius: 1px;
  background: color-mix(in srgb, var(--ov-fg-muted) 22%, transparent);
  box-shadow: inset 0 0 0 1px var(--ov-fg-muted);
}

.fu-race__win--good {
  background: color-mix(in srgb, var(--ov-good) 30%, transparent);
  box-shadow: inset 0 0 0 1px var(--ov-good);
}

.fu-race__win--bad {
  background: color-mix(in srgb, var(--ov-bad) 35%, transparent);
  box-shadow: inset 0 0 0 1px var(--ov-bad);
}

/* You: a needle across the line (inside the track's own width, the flag after it). */
.fu-race__now {
  position: absolute;
  top: 0.3em;
  bottom: 0.3em;
  width: 2px;
  margin-left: -1px;
  background: var(--ov-fg);
}

.fu-race__flag {
  position: absolute;
  right: 0;
  font-size: 0.8em;
  color: var(--ov-fg-muted);
}

/* ---- Saving: what you keep, what to cut --------------------------------------------- */

.fu-save {
  flex: 0 1 5em;
  min-width: 2.5em;
}

.fu-save__keep {
  color: var(--ov-good);
}

.fu-save__cut {
  position: absolute;
  top: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--ov-warn) 75%, transparent) 0 2px,
    transparent 2px 4px
  );
}

/* ---- Tyres: the car from above ------------------------------------------------------- */

.fu-tyres {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.8em;
  min-width: 0;
  height: 4.8em;
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  overflow: hidden;
  white-space: nowrap;
  contain: strict;
}

/* The figures beside their tyres: front pair on the first row, rear on the second. */
.fu-car {
  display: grid;
  flex: none;
  grid-template-columns: 2.1em auto 2.1em;
  grid-template-rows: 1fr 1fr;
  align-items: center;
  column-gap: 0.4em;
}

.fu-car__svg {
  grid-row: 1 / span 2;
  grid-column: 2;
  width: 3.15em;
  height: 4.3em;
  overflow: visible;
}

.fu-car__num--l {
  grid-column: 1;
  justify-self: end;
}

.fu-car__num--r {
  grid-column: 3;
  justify-self: start;
}

.fu-car__axle {
  fill: none;
  stroke: var(--ov-tick-major);
  stroke-width: 1.2;
}

.fu-car__body {
  fill: var(--ov-chip-faint);
  stroke: var(--ov-tick-major);
  stroke-width: 0.8;
}

.fu-car__cockpit {
  fill: var(--ov-well);
}

.fu-car__tyre {
  fill: none;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 0.8;
}

.fu-car__grooves {
  fill: none;
  stroke: rgba(0, 0, 0, 0.35);
  stroke-width: 0.6;
}

/* The wear ramp, fresh to spent; no reading: an empty well. */
.fu-w {
  fill: var(--ov-well);
}

/* Green when new, yellow by the middle (78 %), orange and then red when spent; blue to orange
 * through grey in the colour-blind palette (theme.css --ov-wear-N). */
.fu-w8 {
  fill: var(--ov-wear-8);
}

.fu-w7 {
  fill: var(--ov-wear-7);
}

.fu-w6 {
  fill: var(--ov-wear-6);
}

.fu-w5 {
  fill: var(--ov-wear-5);
}

.fu-w4 {
  fill: var(--ov-wear-4);
}

.fu-w3 {
  fill: var(--ov-wear-3);
}

.fu-w2 {
  fill: var(--ov-wear-2);
}

.fu-w1 {
  fill: var(--ov-wear-1);
}

.fu-w0 {
  fill: var(--ov-wear-0);
}

.fu-tyres__meta {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15em;
  min-width: 0;
  text-align: right;
}

.fu-tyres__when {
  max-width: 100%;
}

/* The note in a word or two, for when the sentence has no room ('V13', 'sin lectura'). */
.fu-tyres__short {
  display: none;
}

.fu-tyres__sets {
  display: flex;
  align-items: baseline;
  gap: 0.25em;
}

/* Nothing measured yet: the car stays, quiet. */
.fu-tyres.is-dim .fu-car {
  opacity: var(--ov-o-dim);
}

.fu-tyres.is-dim .fu-car__num {
  color: var(--ov-fg-dim);
}

/* ---- Counts left: a figure and a pip each ------------------------------------------- */

.fu-count {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.4em;
}

.fu-pips {
  display: flex;
  gap: 0.18em;
}

.fu-pip {
  width: 0.4em;
  height: 0.4em;
  border-radius: 1px;
  background: var(--ov-fg-muted);
}

/* ---- Narrow windows: the figures and graphics keep their room, the words go first ------ */

@container fuel (max-width: 23em) {
  .fu-note,
  .fu-menu__label {
    display: none;
  }

  .fu-tyres__when {
    display: block;
  }
}

@container fuel (max-width: 20em) {
  .fu-hero__left,
  .fu-menu,
  .fu-pips,
  .fu-flag-label,
  .fu-tyres__when {
    display: none;
  }

  /* The dim car still says why: 'sin lectura'. */
  .fu-tyres__short {
    display: block;
  }
}
</style>
