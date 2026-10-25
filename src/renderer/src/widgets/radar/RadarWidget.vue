<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'
import { formatMetres } from '@shared/format'
import { OPTION_SCHEMA, clampOption } from '@shared/settingsSchema'
import { useElementSize } from '@renderer/composables/useElementSize'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import { useOption } from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import {
  BEZEL,
  BEZEL_TOP_PATH,
  BG_HALF,
  BG_RADIUS,
  BUCKET_CLASSES,
  CAR_ALONGSIDE_GLOW,
  CAR_BODY,
  CAR_GLASS,
  CAR_HALO_INNER,
  LABEL_FONT,
  LABEL_X,
  NO_MARKS,
  PLAYER_HALO_INNER,
  WIDGET_PRECISION,
  labelFontUnits,
  rangeGuides,
  sameMarks,
  sideAlertStyle,
  toCarMarks,
  type CarMark
} from './geometry'
import { previewRadar } from './preview'
import RadarSideAlert from './RadarSideAlert.vue'

/** No payload for this long hides the radar, though the status may still say connected. */
const STALE_MS = 300

const rangeOption = useOption('radar', 'rangeM')
const showRangeLabels = useOption('radar', 'showRangeLabels')
const { surfaceStyle, halo } = useWidgetSurface()
// The SDK can go silent for seconds before the connection is declared lost, and the provider
// sends nothing while the radar is hidden: freshness hides it without a ticking timer.
const { data, phase } = useWidgetPhase('radar', {
  showsOffline: false,
  hasContent: (d) => d.visible,
  staleMs: STALE_MS
})

const shown = computed(() => phase.value === 'live' || phase.value === 'preview')
const configuredRange = computed(() => clampOption(OPTION_SCHEMA.radar.rangeM, rangeOption.value))
/** Live data, the sample in edit mode, or the last frame (kept through the fade-out). */
const content = useShownContent(
  () => phase.value,
  () => data.value,
  () => previewRadar(configuredRange.value)
)

// Several SVGs could share a document: keep defs ids unique. The references are built once,
// not on every 60 Hz render.
const uid = useId()
const clipId = `${uid}-clip`
const washId = `${uid}-wash`
const barId = `${uid}-bar`
const glowId = `${uid}-glow`
const url = (id: string): string => `url(#${id})`
const clipUrl = url(clipId)
const washUrl = url(washId)
const barUrl = url(barId)
const glowUrl = url(glowId)

// The template reads only these computeds, and each keeps its previous value unless what it
// draws changed: a payload that moves nothing visible does not re-render, and while hidden
// the content is frozen, so no payload can repaint an invisible radar.
const cars = computed<readonly CarMark[]>((prev) => {
  const d = content.value
  const next = d !== null ? toCarMarks(d.cars, d.rangeM, WIDGET_PRECISION) : NO_MARKS
  return prev !== undefined && sameMarks(prev, next) ? prev : next
})
const left = computed(() => sideAlertStyle(content.value?.leftCount ?? 0))
const right = computed(() => sideAlertStyle(content.value?.rightCount ?? 0))

/** Range of the guides: the shown frame's, else the configured one. */
const range = computed(() => {
  const r = content.value?.rangeM
  return r !== undefined && r > 0 ? r : configuredRange.value
})
const trackKnown = computed(() => content.value?.trackLengthKnown === true)

// Labels never render under the 9 px text floor: their size follows the window (resize only).
const root = useTemplateRef<HTMLElement>('root')
const size = useElementSize(root)
const labelFont = computed(() => labelFontUnits(size.value.w, size.value.h))
const guides = computed(() => rangeGuides(range.value, labelFont.value ?? LABEL_FONT))
const rangeLabels = computed(() => {
  const font = labelFont.value
  if (!showRangeLabels.value || font === null || !trackKnown.value) return null
  return { half: formatMetres(range.value / 2), full: formatMetres(range.value), font }
})
</script>

<template>
  <div
    ref="root"
    v-inline-style="surfaceStyle"
    class="radar ov-root ov-fade ov-surface"
    :class="{ 'is-shown': shown, 'radar--halo': halo }"
  >
    <svg
      class="radar__svg"
      viewBox="-50 -50 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <!-- Fixed parts are built once (v-once) or when their inputs change (v-memo), so a 60 Hz
           re-render diffs only the cars, and skips every car whose mark did not change. No
           filters anywhere: every glow is a static gradient or a faint shape behind its icon.
           Every red is --ov-alert (.radar-stop), so the colour-blind palette is CSS only. -->
      <defs v-once>
        <clipPath :id="clipId">
          <rect
            :x="-BG_HALF"
            :y="-BG_HALF"
            :width="BG_HALF * 2"
            :height="BG_HALF * 2"
            :rx="BG_RADIUS"
          />
        </clipPath>
        <!-- Wash centred on the outer edge: reaches the player's flank horizontally and
             fades out exactly at the top and bottom of its rect (vertical radius halved). -->
        <radialGradient
          :id="washId"
          cx="0"
          cy="0.5"
          r="1"
          gradientTransform="translate(0 0.5) scale(1 0.5) translate(0 -0.5)"
        >
          <stop class="radar-stop" offset="0" stop-opacity="0.5" />
          <stop class="radar-stop" offset="0.5" stop-opacity="0.16" />
          <stop class="radar-stop" offset="1" stop-opacity="0" />
        </radialGradient>
        <linearGradient :id="barId" x1="0" y1="0" x2="0" y2="1">
          <stop class="radar-stop" offset="0" stop-opacity="0" />
          <stop class="radar-stop" offset="0.3" stop-opacity="1" />
          <stop class="radar-stop" offset="0.7" stop-opacity="1" />
          <stop class="radar-stop" offset="1" stop-opacity="0" />
        </linearGradient>
        <!-- Strong glow of a car alongside, in the alert colour (its proximity colour there).
             Elliptical over CAR_ALONGSIDE_GLOW and transparent before that rect's edges. -->
        <radialGradient :id="glowId">
          <stop class="radar-stop" offset="0.35" stop-opacity="0.55" />
          <stop class="radar-stop" offset="0.6" stop-opacity="0.28" />
          <stop class="radar-stop" offset="0.82" stop-opacity="0.1" />
          <stop class="radar-stop" offset="1" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- The glass in a two-tone bezel, like every panel: a dark outer keyline (it holds over a
           bright sky), a light inner ring (over dark asphalt) and the lit top edge. -->
      <rect
        v-once
        class="radar__bg"
        :x="-BG_HALF"
        :y="-BG_HALF"
        :width="BG_HALF * 2"
        :height="BG_HALF * 2"
        :rx="BG_RADIUS"
      />
      <rect v-once class="radar__bezel" v-bind="BEZEL" />
      <path v-once class="radar__bezel-top" :d="BEZEL_TOP_PATH" />

      <g :clip-path="clipUrl">
        <g v-memo="[guides]" class="radar__guides">
          <line x1="0" :y1="-BG_HALF" x2="0" :y2="BG_HALF" />
          <line :x1="-BG_HALF" y1="0" :x2="BG_HALF" y2="0" />
          <line
            class="radar__guide-half"
            :x1="-BG_HALF"
            :y1="guides.halfY"
            :x2="BG_HALF"
            :y2="guides.halfY"
          />
          <line
            class="radar__guide-half"
            :x1="-BG_HALF"
            :y1="-guides.halfY"
            :x2="BG_HALF"
            :y2="-guides.halfY"
          />
          <line
            v-for="(y, i) in guides.ticksY"
            :key="i"
            class="radar__tick"
            x1="-1.4"
            :y1="y"
            x2="1.4"
            :y2="y"
          />
        </g>

        <RadarSideAlert
          v-memo="[left]"
          :alert="left"
          :mirrored="false"
          :wash-url="washUrl"
          :bar-url="barUrl"
        />
        <RadarSideAlert
          v-memo="[right]"
          :alert="right"
          :mirrored="true"
          :wash-url="washUrl"
          :bar-url="barUrl"
        />

        <!-- Positions follow the 60 Hz data directly: no transitions on transform. Halo and body
             inherit the fill of the car's proximity class (.rc-N) and the body has the same dark
             keyline as yours, so a frame changes at most transform, opacity and that class. The
             class colour is only the windshield (a mark, not the silhouette): a yellow class
             never turns a car into a copy of yours. -->
        <g
          v-for="car in cars"
          :key="car.key"
          v-memo="[car.transform, car.opacity, car.bucket, car.classColor, car.overlapping]"
          :class="BUCKET_CLASSES[car.bucket]"
          :transform="car.transform"
          :opacity="car.opacity"
        >
          <rect v-if="car.overlapping" v-bind="CAR_ALONGSIDE_GLOW" :fill="glowUrl" />
          <rect class="radar__halo-inner" v-bind="CAR_HALO_INNER" />
          <rect class="radar__car" v-bind="CAR_BODY" />
          <rect class="radar__cls" v-bind="CAR_GLASS" :fill="car.classColor" />
        </g>

        <!-- You: filled with the accent, the colour that marks you in every widget. -->
        <g v-once class="radar__player">
          <rect class="radar__halo-inner" v-bind="PLAYER_HALO_INNER" />
          <rect class="radar__player-body" v-bind="CAR_BODY" />
          <rect class="radar__windshield" v-bind="CAR_GLASS" />
        </g>
      </g>

      <g v-memo="[rangeLabels, guides]" class="radar__labels">
        <template v-if="rangeLabels">
          <text :x="LABEL_X" :y="guides.halfLabelY" :font-size="rangeLabels.font" text-anchor="end">
            {{ rangeLabels.half }}
          </text>
          <text :x="LABEL_X" :y="guides.fullLabelY" :font-size="rangeLabels.font" text-anchor="end">
            {{ rangeLabels.full }}
          </text>
        </template>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.radar__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

/*
 * The panel parts scale with --ov-bg-alpha (.ov-surface); cars, player and alerts stay fully
 * opaque. Pure CSS: an opacity change re-renders nothing. Rings and guides are 1 px hairlines
 * at any window size: non-scaling strokes, only on static or memoised shapes, never on a car.
 */
.radar__bg {
  fill: var(--ov-bg);
  stroke: var(--ov-edge-out);
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
}

.radar__bezel,
.radar__bezel-top {
  fill: none;
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
}

.radar__bezel {
  stroke: var(--ov-edge-in);
}

.radar__bezel-top {
  stroke: var(--ov-edge-top);
}

/* Graduations: faint axes and half-range lines, brighter quarter ticks on the centre line.
   Straight hairlines, drawn pixel-snapped rather than smeared over two pixels. */
.radar__guides line {
  stroke: var(--ov-fg);
  stroke-opacity: calc(0.16 * var(--ov-bg-alpha));
  stroke-width: 1px;
  vector-effect: non-scaling-stroke;
  shape-rendering: crispEdges;
}

/* A non-scaling stroke is dashed in px. */
.radar__guides .radar__guide-half {
  stroke-dasharray: 3 3;
}

.radar__guides .radar__tick {
  stroke-opacity: calc(0.3 * var(--ov-bg-alpha));
}

/*
 * Proximity ramp (geometry.ts BUCKET_CLASSES): grey at the edge of the range, warming to the
 * alert red as a car closes in, never through yellow (yellow is you). The colours live in
 * theme.css with their colour-blind variant (grey to orange): no JS involved.
 */
.rc-0 {
  fill: var(--ov-prox-0);
}
.rc-1 {
  fill: var(--ov-prox-1);
}
.rc-2 {
  fill: var(--ov-prox-2);
}
.rc-3 {
  fill: var(--ov-prox-3);
}
.rc-4 {
  fill: var(--ov-prox-4);
}
.rc-5 {
  fill: var(--ov-prox-5);
}
.rc-6 {
  fill: var(--ov-prox-6);
}
.rc-7 {
  fill: var(--ov-prox-7);
}
.rc-8 {
  fill: var(--ov-prox-8);
}
.rc-9 {
  fill: var(--ov-prox-9);
}
.rc-10 {
  fill: var(--ov-prox-10);
}
.rc-11 {
  fill: var(--ov-prox-11);
}

/* fill-opacity, not opacity: no compositing group per shape. The fill comes from the car's
   group; the outline is the same neutral dark keyline as yours (a class-coloured ring made
   every GT3 car a yellow-ringed copy of you), and the class colour is the windshield. */
.radar__halo-inner {
  fill-opacity: 0.22;
}

.radar__car {
  fill-opacity: 1;
  stroke: rgba(0, 0, 0, 0.6);
  stroke-width: 0.5;
}

/* You: the accent car on a neutral lift (like your row's bracket: a faint accent halo reads
   olive on the dark glass), with a dark keyline and a dark windshield. */
.radar__player {
  fill: var(--ov-accent);
}

.radar__player .radar__halo-inner {
  fill: var(--ov-fg);
  fill-opacity: 0.16;
}

.radar__player-body {
  stroke: rgba(0, 0, 0, 0.6);
  stroke-width: 0.5;
}

.radar__windshield {
  fill: rgba(0, 0, 0, 0.4);
}

/* Side alerts and the alongside glow: --ov-alert follows the colour-blind palette. */
.radar-stop {
  stop-color: var(--ov-alert);
}

.radar__labels text {
  fill: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-weight: var(--ov-w-strong);
  font-variant-numeric: tabular-nums;
  /* Dark halo: readable over the alert wash and the cars. */
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 0.8px;
  stroke-linejoin: round;
}

/* Straight over the game: a solid outline instead of the faint halo. */
.radar--halo .radar__labels text {
  stroke: rgba(0, 0, 0, 0.9);
  stroke-width: 1px;
}
</style>
