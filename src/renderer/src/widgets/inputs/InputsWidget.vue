<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import { deepEqual } from '@shared/equal'
import { speedUnit } from '@shared/format'
import { colorOrAccent } from '@shared/colors'
import { ACCENT_PRESETS } from '@shared/settingsSchema'
import { SHIFT_LEDS, ledBand, shiftLit, shiftPhase } from '@shared/shiftLights'
import type { InputsData } from '@shared/types'
import { WIDGET_DEFS } from '@shared/widgets'
import { useAppearance } from '@renderer/composables/useAppearance'
import { useContentSize } from '@renderer/composables/useContentSize'
import { useElementSize } from '@renderer/composables/useElementSize'
import { useI18n } from '@renderer/composables/useI18n'
import { useWidgetPhase, type WidgetPhase } from '@renderer/composables/useWidgetPhase'
import {
  useAutoHeight,
  useOptions,
  useWidgetSettings
} from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { hexOr } from '@renderer/view/color'
import { reuseView } from '@renderer/view/reuse'
import type { InlineStyle } from '@renderer/view/styles'
import { orderStyle } from '../orderStyle'
import { pedalPalette, type PedalPalette } from './palette'
import {
  ClassSlot,
  NumberSlot,
  PREVIEW_READOUT,
  TextSlot,
  TransformSlot,
  barTransform,
  biasLabel,
  degreesLabel,
  ffbLabel,
  gearKind,
  gearLabel,
  pedalPercent,
  rpmLabel,
  speedLabel,
  steerTransform,
  tcLabel,
  wheelRotation
} from './readout'
import { inputsLayout, sameInputsLayout, type InputsLayout } from './sections'
import SteeringWheel from './SteeringWheel.vue'
import { clampTraceSeconds, clampTraceWidth } from './trace'
import { TraceController, type TraceSettings } from './traceController'
import { WHEEL_SIZE_EM, type WheelStyle } from './wheel'

/** No payload for this long while active fades the widget out (the SDK can go silent). */
const STALE_MS = 500
const HZ = WIDGET_DEFS.inputs.hz
/** A clipping moment stays lit at least this long, so a single tick still reads. */
const FFB_FLASH_MS = 300
/** Half a blink of the shift lights over the blink RPM (about 5 a second). */
const BLINK_HALF_MS = 90
const LEDS: readonly ('green' | 'yellow' | 'red')[] = Array.from({ length: SHIFT_LEDS }, (_, i) =>
  ledBand(i)
)

const options = useOptions('inputs')
const appearance = useAppearance()
const t = useI18n()
const { surfaceStyle, halo } = useWidgetSurface()
const { data, phase } = useWidgetPhase('inputs', {
  showsOffline: false,
  hasContent: (d) => d.active,
  staleMs: STALE_MS
})

const shown = computed(() => phase.value === 'live' || phase.value === 'preview')
const preview = computed(() => phase.value === 'preview')

// Each read keeps its value while equal: only a change of what it shows re-renders anything.
/** The blocks, bars and readouts shown, each with its place (inputs.sections, .bars, .info, .car). */
const layout = computed<InputsLayout>((prev) => {
  const next = inputsLayout(options.value)
  return prev !== undefined && sameInputsLayout(prev, next) ? prev : next
})
const hasTrace = computed(() => layout.value.trace)
const showClutch = computed(() => layout.value.clutch)
const showSteering = computed(() => layout.value.steering)
const showGear = computed(() => layout.value.gear)
const showSpeed = computed(() => layout.value.speed)
const showShift = computed(() => options.value.shiftLights)
const showDegrees = computed(() => showSteering.value && options.value.steeringDegrees)
/** The car's controls: a car without them (an empty var) shows no row; the preview shows all. */
const hasBias = computed(() => preview.value || (data.value?.brakeBias ?? null) !== null)
const hasTc = computed(() => preview.value || (data.value?.tc ?? null) !== null)
const hasFfb = computed(() => preview.value || (data.value?.ffb ?? null) !== null)
const autoHeight = useAutoHeight('inputs')
/** The wheel drawn, null for the bar. */
const wheel = computed<WheelStyle | null>(() => {
  const s = options.value.steeringStyle
  return s === 'bar' ? null : s
})
/** The wheel's accent and size (wheel.ts WHEEL_SIZE_EM), on its box. */
const wheelStyle = computed<InlineStyle>((prev) => {
  const own = colorOrAccent(options.value.wheelColor, appearance.value.accent)
  const accent = hexOr(own, hexOr(appearance.value.accent, ACCENT_PRESETS[0].value))
  const size = `${WHEEL_SIZE_EM[options.value.wheelSize] ?? WHEEL_SIZE_EM.medium}em`
  return prev?.['--wheel-accent'] === accent && prev['--wheel-size'] === size
    ? prev
    : Object.freeze({ '--wheel-accent': accent, '--wheel-size': size })
})
const units = computed(() => appearance.value.units)
const unitLabel = computed(() => speedUnit(units.value))
/** One source for the bars (CSS variables on the root) and the canvas. */
const palette = computed<PedalPalette>((prev) => {
  const next = pedalPalette(options.value.colors)
  return prev !== undefined && deepEqual(prev, next) ? prev : next
})
const traceSettings = computed<TraceSettings>((prev) =>
  reuseView(prev, {
    seconds: clampTraceSeconds(options.value.traceSeconds),
    lineCss: clampTraceWidth(options.value.traceWidth),
    clutch: options.value.clutchInTrace,
    // The dark underlay follows the text halo: over the bare game, or when forced on.
    outline: halo.value,
    colors: palette.value.trace
  })
)

// ---- Trace: plain state outside Vue reactivity ----------------------------

const trace = new TraceController(HZ, traceSettings.value)
const canvasEl = useTemplateRef<HTMLCanvasElement>('canvas')

// A v-if re-creates the canvas (layout change): the controller adopts it at its known size.
watch(canvasEl, (c) => trace.attach(c, c?.getContext('2d') ?? null), {
  immediate: true,
  flush: 'post'
})
// Exact device pixels (also fires when the window changes display); only on a resize.
useElementSize(canvasEl, {
  box: 'device-pixel-content-box',
  onResize: (s) => trace.resize(s.w, s.h, s.dpr)
})

// ---- Readouts: written straight to the DOM, only when the shown value changes ----

const throttlePctEl = useTemplateRef<HTMLElement>('throttlePct')
const throttleFillEl = useTemplateRef<HTMLElement>('throttleFill')
const brakePctEl = useTemplateRef<HTMLElement>('brakePct')
const brakeFillEl = useTemplateRef<HTMLElement>('brakeFill')
const brakeBarEl = useTemplateRef<HTMLElement>('brakeBar')
const clutchPctEl = useTemplateRef<HTMLElement>('clutchPct')
const clutchFillEl = useTemplateRef<HTMLElement>('clutchFill')
const gearEl = useTemplateRef<HTMLElement>('gear')
const speedEl = useTemplateRef<HTMLElement>('speed')
const steerFillEl = useTemplateRef<HTMLElement>('steerFill')
const wheelEl = useTemplateRef<HTMLElement>('steerWheel')
const degEl = useTemplateRef<HTMLElement>('deg')
const shiftEl = useTemplateRef<HTMLElement>('shift')
const rpmEl = useTemplateRef<HTMLElement>('rpm')
const biasEl = useTemplateRef<HTMLElement>('bias')
const tcEl = useTemplateRef<HTMLElement>('tc')
const ffbEl = useTemplateRef<HTMLElement>('ffb')
const ffbRowEl = useTemplateRef<HTMLElement>('ffbRow')

const slots = {
  throttlePct: new TextSlot(),
  throttleFill: new TransformSlot(),
  brakePct: new TextSlot(),
  brakeFill: new TransformSlot(),
  abs: new ClassSlot('bar--abs'),
  clutchPct: new TextSlot(),
  clutchFill: new TransformSlot(),
  gear: new TextSlot(),
  gearNeutral: new ClassSlot('gear--neutral'),
  gearReverse: new ClassSlot('gear--reverse'),
  speed: new TextSlot(),
  steer: new TransformSlot(),
  wheel: new TransformSlot(),
  deg: new TextSlot(),
  rpm: new TextSlot(),
  bias: new NumberSlot(biasLabel),
  tc: new NumberSlot(tcLabel),
  ffb: new TextSlot(),
  ffbClip: new ClassSlot('car-row--clip'),
  shiftOn: new ClassSlot('shift--on'),
  blinkOff: new ClassSlot('shift--blink-off'),
  leds: Array.from({ length: SHIFT_LEDS }, () => new ClassSlot('led--on'))
}

/** Last readout shown (live sample or preview), re-applied to elements a v-if re-creates. */
let readout: Readonly<InputsData> | null = null
/** performance.now() of the last clipping tick. */
let clipAtMs = -Infinity

/** The strip: lit up to the RPM, all of it from the shift point, blinking from the blink RPM. */
function writeShift(d: Readonly<InputsData>, nowMs: number): void {
  const strip = shiftEl.value
  const p = shiftPhase(d.rpm, d.slFirst, d.slShift, d.slBlink)
  const lit = p === 'fill' ? shiftLit(d.rpm, d.slFirst, d.slLast) : SHIFT_LEDS
  const leds = strip?.children
  for (let i = 0; i < SHIFT_LEDS; i++) {
    slots.leds[i]?.set((leds?.[i] as HTMLElement | undefined) ?? null, i < lit)
  }
  slots.shiftOn.set(strip, p !== 'fill')
  slots.blinkOff.set(strip, p === 'blink' && Math.floor(nowMs / BLINK_HALF_MS) % 2 === 1)
}

function writeReadout(d: Readonly<InputsData>): void {
  readout = d
  const nowMs = performance.now()
  slots.throttlePct.set(throttlePctEl.value, String(pedalPercent(d.throttle)))
  slots.throttleFill.set(throttleFillEl.value, barTransform(d.throttle))
  slots.brakePct.set(brakePctEl.value, String(pedalPercent(d.brake)))
  slots.brakeFill.set(brakeFillEl.value, barTransform(d.brake))
  slots.abs.set(brakeBarEl.value, d.abs)
  // Optional readouts: no string is built for an element that is not there (null lets go).
  const clutchPct = clutchPctEl.value
  slots.clutchPct.set(clutchPct, clutchPct === null ? '' : String(pedalPercent(d.clutch)))
  const clutchFill = clutchFillEl.value
  slots.clutchFill.set(clutchFill, clutchFill === null ? '' : barTransform(d.clutch))
  const gear = gearEl.value
  const kind = gearKind(d.gear)
  slots.gear.set(gear, gear === null ? '' : gearLabel(d.gear))
  slots.gearNeutral.set(gear, kind === 'neutral')
  slots.gearReverse.set(gear, kind === 'reverse')
  const speed = speedEl.value
  slots.speed.set(speed, speed === null ? '' : speedLabel(d.speedKmh, units.value))
  const steer = steerFillEl.value
  slots.steer.set(steer, steer === null ? '' : steerTransform(d.steering))
  // Cached strings (readout.ts): turning the wheel allocates nothing.
  slots.wheel.set(wheelEl.value, wheelRotation(d.steeringDeg))
  slots.deg.set(degEl.value, degreesLabel(d.steeringDeg))
  slots.rpm.set(rpmEl.value, rpmLabel(d.rpm))
  slots.bias.set(biasEl.value, d.brakeBias ?? Number.NaN)
  slots.tc.set(tcEl.value, d.tc ?? Number.NaN)
  slots.ffb.set(ffbEl.value, ffbLabel(d.ffb ?? 0))
  if (d.ffbClip) clipAtMs = nowMs
  slots.ffbClip.set(ffbRowEl.value, d.ffbClip || nowMs - clipAtMs < FFB_FLASH_MS)
  writeShift(d, nowMs)
}

// ---- Data -------------------------------------------------------------------

/** Live samples are being traced; cleared whenever the widget leaves the live phase. */
let tracing = false

// 'sync': every payload is one sample, even two delivered in the same task. At most one draw
// per payload and no animation-frame loop: nothing runs while no payload arrives.
watch(
  data,
  (d) => {
    // Not in the car: the canvas keeps the last trace while the widget fades out.
    if (d === null || !d.active) return
    if (!tracing) {
      // Back in the car (or after the preview): a fresh trace.
      trace.reset()
      tracing = true
    }
    trace.push(d)
    writeReadout(d)
  },
  { flush: 'sync' }
)

function showPreview(): void {
  trace.preview()
  clipAtMs = -Infinity
  writeReadout(PREVIEW_READOUT)
}

function onPhase(p: WidgetPhase): void {
  if (p !== 'live') tracing = false
  if (p === 'preview') showPreview()
}

// 'post' (and on mount, not at setup): the readout elements of the preview exist by then.
watch(phase, onPhase, { flush: 'post' })
onMounted(() => onPhase(phase.value))

watch(traceSettings, (s) => {
  trace.configure(s)
  if (preview.value) trace.preview()
})

// Elements re-created by their v-if (and a new speed unit) get the current values.
watch(
  [layout, wheel, showShift, showDegrees, hasBias, hasTc, hasFfb, units],
  () => {
    if (readout !== null) writeReadout(readout)
  },
  { flush: 'post' }
)

// Auto height: the panel is as tall as its content (the bars' fixed height in em of the scale's
// font), whatever the window; its overlay panel fits to it.
const panel = useTemplateRef('panel')
useContentSize(panel, { enabled: () => autoHeight.value && shown.value })
/** The window grows upwards: the panel hugs the bottom edge while the window waits to shrink. */
const prefs = useWidgetSettings('inputs')
const bottomAnchored = computed(() => autoHeight.value && prefs.value.anchor === 'bottom')
</script>

<template>
  <div
    v-inline-style="palette.vars"
    class="inputs ov-root ov-fade"
    :class="{
      'is-shown': shown,
      'inputs--trace': hasTrace,
      'inputs--car': layout.car,
      'inputs--shift': showShift,
      'inputs--auto': autoHeight,
      'is-bottom': bottomAnchored
    }"
  >
    <WidgetPanel
      ref="panel"
      class="inputs__panel"
      :surface="surfaceStyle"
      :halo="halo"
      :fill="!autoHeight"
    >
      <!-- The LEDs light by writeShift(), the template never binds them. -->
      <div v-if="showShift" ref="shift" class="shift" aria-hidden="true">
        <span v-for="(band, i) in LEDS" :key="i" class="led" :class="`led--${band}`" />
      </div>

      <!-- Blocks, bars and readouts take their place by CSS order (inputs.sections, .bars,
           .info, .car): a reorder never re-creates the canvas or a readout. -->
      <div class="inputs__row">
        <div
          v-if="hasTrace"
          v-inline-style="orderStyle(layout.order.trace)"
          data-el="inputs.sections.trace"
          class="plot"
        >
          <div class="grid" aria-hidden="true" />
          <canvas ref="canvas" class="trace" aria-hidden="true" />
          <PreviewTag v-if="preview" class="plot__tag" />
        </div>

        <!-- The numbers, fills, gear and the ABS state are written by writeReadout(): the
             template never binds them, so a 60 Hz sample re-renders nothing. -->
        <div
          v-inline-style="orderStyle(layout.order.bars)"
          data-el="inputs.sections.bars"
          class="bars"
        >
          <div
            v-if="showClutch"
            v-inline-style="orderStyle(layout.order.clutch)"
            data-el="inputs.bars.clutch"
            class="bar bar--clutch"
          >
            <span ref="clutchPct" class="pct" />
            <span class="track"><span ref="clutchFill" class="fill" /></span>
            <span class="key"
              ><span class="key-main">{{ t.widgets.inputs.clutch }}</span></span
            >
          </div>
          <div
            ref="brakeBar"
            v-inline-style="orderStyle(layout.order.brake)"
            data-el="inputs.bars.brake"
            class="bar bar--brake"
          >
            <span ref="brakePct" class="pct" />
            <span class="track"><span ref="brakeFill" class="fill" /></span>
            <span class="key">
              <span class="key-main">{{ t.widgets.inputs.brake }}</span>
              <span class="key-abs">{{ t.widgets.inputs.abs }}</span>
            </span>
          </div>
          <div
            v-inline-style="orderStyle(layout.order.throttle)"
            data-el="inputs.bars.throttle"
            class="bar bar--throttle"
          >
            <span ref="throttlePct" class="pct" />
            <span class="track"><span ref="throttleFill" class="fill" /></span>
            <span class="key"
              ><span class="key-main">{{ t.widgets.inputs.throttle }}</span></span
            >
          </div>
        </div>

        <div
          v-if="layout.info"
          v-inline-style="orderStyle(layout.order.info)"
          data-el="inputs.sections.info"
          class="info"
        >
          <span
            v-if="showGear"
            ref="gear"
            v-inline-style="orderStyle(layout.order.gear)"
            data-el="inputs.info.gear"
            class="gear ov-t-hero"
          />
          <span
            v-if="showSpeed"
            v-inline-style="orderStyle(layout.order.speed)"
            data-el="inputs.info.speed"
            class="speed"
          >
            <span ref="speed" class="speed-num" />
            <span class="unit">{{ unitLabel }}</span>
          </span>
          <span
            v-if="showSteering"
            v-inline-style="orderStyle(layout.order.steering)"
            data-el="inputs.info.steering"
            class="steering"
          >
            <!-- Static drawing turned as a whole on its own layer: a turn is a transform. -->
            <span
              v-if="wheel !== null"
              ref="steerWheel"
              v-inline-style="wheelStyle"
              class="wheel"
              aria-hidden="true"
            >
              <SteeringWheel :wheel="wheel" />
            </span>
            <span v-else class="steer" aria-hidden="true">
              <span ref="steerFill" class="steer-fill" />
            </span>
            <span v-if="showDegrees" ref="deg" class="deg" />
          </span>
        </div>

        <div
          v-if="layout.car"
          v-inline-style="orderStyle(layout.order.car)"
          data-el="inputs.sections.car"
          class="car"
        >
          <span
            v-if="layout.rpm"
            v-inline-style="orderStyle(layout.order.rpm)"
            data-el="inputs.car.rpm"
            class="car-row"
          >
            <span class="car-key">{{ t.widgets.inputs.car.rpm }}</span>
            <span ref="rpm" class="car-val car-val--rpm" />
          </span>
          <span
            v-if="layout.bias && hasBias"
            v-inline-style="orderStyle(layout.order.bias)"
            data-el="inputs.car.bias"
            class="car-row"
          >
            <span class="car-key">{{ t.widgets.inputs.car.bias }}</span>
            <span ref="bias" class="car-val" />
          </span>
          <span
            v-if="layout.tc && hasTc"
            v-inline-style="orderStyle(layout.order.tc)"
            data-el="inputs.car.tc"
            class="car-row"
          >
            <span class="car-key">{{ t.widgets.inputs.car.tc }}</span>
            <span ref="tc" class="car-val" />
          </span>
          <span
            v-if="layout.ffb && hasFfb"
            ref="ffbRow"
            v-inline-style="orderStyle(layout.order.ffb)"
            data-el="inputs.car.ffb"
            class="car-row car-row--ffb"
          >
            <span class="car-key">{{ t.widgets.inputs.car.ffb }}</span>
            <span ref="ffb" class="car-val" />
          </span>
        </div>
      </div>
    </WidgetPanel>
  </div>
</template>

<style scoped>
.inputs {
  container: inputs / size;
}

/* Fixed height: the font follows the window (9 px floor), the plot takes the spare width. */
.inputs__panel {
  flex-direction: column;
  gap: 0.35em;
  padding: 0.4em 0.5em;
  font-size: clamp(9px, min(100cqh / 9, 100cqw / 26), 15px);
  line-height: 1.15;
}

/* The shift lights take a row of their own: a little less font for the same window. */
.inputs--shift .inputs__panel {
  font-size: clamp(9px, min(100cqh / 10, 100cqw / 26), 15px);
}

.inputs--car .inputs__panel {
  font-size: clamp(9px, min(100cqh / 9, 100cqw / 30), 15px);
}

.inputs--car.inputs--shift .inputs__panel {
  font-size: clamp(9px, min(100cqh / 10, 100cqw / 30), 15px);
}

/* The blocks side by side. */
.inputs__row {
  display: flex;
  flex: 1 1 auto;
  gap: 0.5em;
  min-height: 0;
}

/* No trace: bars and info centred, sized for a small square window. */
.inputs:not(.inputs--trace) .inputs__row {
  justify-content: center;
}

.inputs:not(.inputs--trace) .inputs__panel {
  font-size: clamp(9px, min(100cqh / 9, 100cqw / 12.5), 15px);
}

.inputs--shift:not(.inputs--trace) .inputs__panel {
  font-size: clamp(9px, min(100cqh / 10, 100cqw / 12.5), 15px);
}

.inputs--car:not(.inputs--trace) .inputs__panel {
  font-size: clamp(9px, min(100cqh / 9, 100cqw / 17), 15px);
}

.inputs--car.inputs--shift:not(.inputs--trace) .inputs__panel {
  font-size: clamp(9px, min(100cqh / 10, 100cqw / 17), 15px);
}

/*
 * Auto height (the default): the panel is its content, the font the scale's (--ov-fs), so
 * nothing depends on the window's height (no cqh) and the fitted height cannot feed back. The
 * bars set the row's height, the trace and the readouts take it: with the panel's 0.4 em paddings
 * and 1 px borders the panel is today's 120 px at the default 13 px (9.23 em), the shift lights
 * add their row. Only the width is a container then.
 */
.inputs--auto {
  container-type: inline-size;
}

/* With the bottom edge anchored the panel hugs it while the window waits to shrink. */
.inputs--auto.is-bottom {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.inputs--auto .inputs__panel {
  flex: none;
}

.inputs--auto .inputs__panel,
.inputs--auto:not(.inputs--trace) .inputs__panel {
  font-size: var(--ov-fs);
}

.inputs--auto .bars {
  height: calc(8.43em - 2px);
}

/* ---- Shift lights --------------------------------------------------------- */

/*
 * One LED per tenth of the band, green, yellow then red (shiftLights.ts). Off, each is a dim well
 * of its colour; lit, the colour itself. From the shift point every LED is lit in red; over the
 * blink RPM the strip goes dark every other moment (written per sample, no CSS animation).
 */
.shift {
  flex: none;
  display: flex;
  gap: 0.2em;
  height: 0.55em;
  contain: strict;
}

.led {
  flex: 1 1 0;
  border-radius: 1px;
  background: color-mix(in srgb, var(--led) 16%, var(--ov-well));
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.35);
}

.led--green {
  --led: var(--ov-good);
}

.led--yellow {
  --led: #ffd23f;
}

.led--red {
  --led: var(--ov-alert);
}

.led--on {
  background: var(--led);
  box-shadow: 0 0 2px var(--led);
}

.shift--on .led {
  --led: var(--ov-alert);
}

.shift--blink-off .led {
  background: color-mix(in srgb, var(--led) 16%, var(--ov-well));
  box-shadow: none;
}

/* ---- Trace ---------------------------------------------------------------- */

/* A recessed well, like every gauge of the set: its top edge in a 1 px inner shade (0 blur). */
.plot {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  contain: strict;
  border-radius: var(--ov-radius-inner);
  background: var(--ov-well);
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.35);
}

/*
 * Graduations at the trace's own inset (TRACE_PAD_CSS): 0 and 100 %, the quarters, and a
 * brighter 50 % line, the scale the pedal tracks share. Static, never repainted.
 */
.grid {
  position: absolute;
  inset: 3px 0;
  background: linear-gradient(
    to bottom,
    var(--ov-tick) 0 1px,
    transparent 1px calc(25% - 0.5px),
    var(--ov-tick) calc(25% - 0.5px) calc(25% + 0.5px),
    transparent calc(25% + 0.5px) calc(50% - 0.5px),
    var(--ov-tick-major) calc(50% - 0.5px) calc(50% + 0.5px),
    transparent calc(50% + 0.5px) calc(75% - 0.5px),
    var(--ov-tick) calc(75% - 0.5px) calc(75% + 0.5px),
    transparent calc(75% + 0.5px) calc(100% - 1px),
    var(--ov-tick) calc(100% - 1px)
  );
}

/*
 * Own compositor layer: the controller translates it left by the sub-pixel scroll phase
 * (under 1 device px) after each draw, a transform change with no repaint. The strip that
 * slides past the left edge is clipped by the plot (contain: strict); the one it uncovers on
 * the right is inside the canvas's empty right margin (traceGeometry `right`), so no line is
 * cut and no edge shows a gap.
 */
.trace {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  will-change: transform;
}

.plot__tag {
  position: absolute;
  top: 0.35em;
  left: 0.45em;
}

/* ---- Bars ----------------------------------------------------------------- */

.bars {
  flex: none;
  display: flex;
  gap: 0.3em;
  min-height: 0;
}

.bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2em;
  width: 2.2em;
  min-height: 0;
}

/* Fixed boxes: a changing number re-lays out only itself. */
.pct {
  flex: none;
  width: 100%;
  height: 1.4em;
  contain: strict;
  font-size: var(--ov-t-plate);
  font-weight: var(--ov-w-strong);
  line-height: 1.4;
  text-align: center;
  color: var(--ov-fg-muted);
}

/* A recessed well graduated in quarters (brighter at half travel); the fill paints over it. */
.track {
  position: relative;
  flex: 1 1 auto;
  width: 1em;
  min-height: 0;
  contain: strict;
  border-radius: 1px;
  background:
    linear-gradient(
      to top,
      transparent calc(25% - 0.5px),
      var(--ov-tick) calc(25% - 0.5px) calc(25% + 0.5px),
      transparent calc(25% + 0.5px) calc(50% - 0.5px),
      var(--ov-tick-major) calc(50% - 0.5px) calc(50% + 0.5px),
      transparent calc(50% + 0.5px) calc(75% - 0.5px),
      var(--ov-tick) calc(75% - 0.5px) calc(75% + 0.5px),
      transparent calc(75% + 0.5px)
    ),
    var(--ov-well);
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.35);
}

/* Own compositor layer: a new value is a transform change, no layout and no repaint. */
.fill {
  position: absolute;
  inset: 0;
  border-radius: 1px;
  background: var(--bar);
  transform: scaleY(0);
  transform-origin: bottom;
  will-change: transform;
}

.bar--throttle {
  --bar: var(--ov-throttle);
}

.bar--brake {
  --bar: var(--ov-brake);
}

.bar--clutch {
  --bar: var(--ov-clutch);
}

/* ABS active: the fill turns orange and the key reads ABS (colour plus text). */
.bar--brake.bar--abs {
  --bar: var(--ov-abs);
}

/* The legend: each pedal's letter in its colour. */
.key {
  position: relative;
  flex: none;
  width: 100%;
  height: 1.5em;
  contain: strict;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  line-height: 1.5;
  letter-spacing: var(--ov-track-tag);
  text-align: center;
  color: var(--bar);
}

.key-main,
.key-abs {
  position: absolute;
  inset: 0;
}

/* ABS: a solid plate (act now). */
.key-abs {
  border-radius: var(--ov-radius-chip);
  background: var(--ov-abs);
  color: var(--ov-on-solid);
  font-weight: var(--ov-w-solid);
  text-shadow: none;
  opacity: 0;
}

.bar--abs .key-abs {
  opacity: 1;
}

.bar--abs .key-main {
  opacity: 0;
}

/* ---- Gear, speed, steering ------------------------------------------------ */

.info {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25em;
  width: 3.4em;
  min-height: 0;
}

/* Hero numeral (.ov-t-hero: face, weight, tracking), larger than the other heroes. */
.gear {
  width: 100%;
  height: 1.05em;
  contain: strict;
  font-size: 2.6em;
  line-height: 1.05;
  text-align: center;
}

.gear--neutral {
  color: var(--ov-fg-muted);
}

.gear--reverse {
  color: var(--ov-warn);
}

.speed {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.speed-num {
  width: 100%;
  height: 1.2em;
  contain: strict;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
  text-align: center;
}

.unit {
  font-family: var(--ov-font-small);
  font-size: max(var(--ov-min-text), 0.62em);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
  text-transform: uppercase;
  color: var(--ov-fg-dim);
}

/* The bar or the wheel, and the degrees under it. */
.steering {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15em;
  width: 100%;
}

/* Steering: a recessed well with a graduated centre. */
.steer {
  position: relative;
  flex: none;
  width: 100%;
  height: 0.45em;
  margin-top: 0.15em;
  overflow: hidden;
  contain: strict;
  border-radius: 1px;
  background: var(--ov-well);
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.35);
}

/* Centre mark. */
.steer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(50% - 0.5px);
  width: 1px;
  background: var(--ov-tick-major);
}

/* Grows from the centre towards the turn: scaleX(-1) full left, scaleX(1) full right. */
.steer-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 50%;
  background: color-mix(in srgb, var(--ov-fg) 85%, transparent);
  transform: scaleX(0);
  transform-origin: left center;
  will-change: transform;
}

/* A static drawing rotated as a whole on its own layer (wheel.ts WHEEL_SIZE_EM). */
.wheel {
  flex: none;
  width: var(--wheel-size);
  height: var(--wheel-size);
  contain: strict;
  transform: rotate(0deg);
  will-change: transform;
}

/* Fixed box: a changing angle re-lays out only itself. */
.deg {
  flex: none;
  width: 100%;
  height: 1.3em;
  contain: strict;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  color: var(--ov-fg-muted);
}

/* ---- Car block: revs, bias, TC, force feedback ---------------------------- */

.car {
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3em;
  width: 5.2em;
  min-height: 0;
}

/* A key and its value on one line, the value's box fixed (it changes every sample). Centred, not
   on the baseline: a contained box has none, so its bottom edge would sit on the key's. */
.car-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3em;
  padding: 0 0.25em;
  border-radius: var(--ov-radius-chip);
}

.car-key {
  flex: none;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
  color: var(--ov-fg-dim);
}

.car-val {
  flex: 1 1 auto;
  min-width: 0;
  height: 1.25em;
  contain: strict;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-plate);
  font-weight: var(--ov-w-strong);
  line-height: 1.25;
  text-align: right;
}

.car-val--rpm {
  font-size: var(--ov-t-lead);
}

/* Clipping: a solid plate for a moment (act now: the wheel gives no more). */
.car-row--clip {
  background: var(--ov-alert);
  color: var(--ov-on-solid);
  text-shadow: none;
}

.car-row--clip .car-key {
  color: inherit;
}

/* ---- Small windows -------------------------------------------------------- */

@container inputs (max-width: 250px) {
  .inputs--trace .info,
  .inputs--trace .car {
    display: none;
  }
}

@container inputs (max-height: 85px) {
  .key,
  .unit,
  .deg {
    display: none;
  }

  .wheel {
    width: 1.6em;
    height: 1.6em;
  }
}
</style>
