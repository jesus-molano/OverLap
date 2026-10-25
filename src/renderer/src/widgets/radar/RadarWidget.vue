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
  BG_HALF,
  BG_RADIUS,
  CAR_ALONGSIDE_GLOW,
  CAR_BODY,
  CAR_HALO_INNER,
  CAR_HALO_OUTER,
  LABEL_FONT,
  LABEL_X,
  NO_MARKS,
  PLAYER_HALO_INNER,
  PLAYER_HALO_OUTER,
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

// Several SVGs could share a document: keep defs ids unique.
const uid = useId()
const clipId = `${uid}-clip`
const washId = `${uid}-wash`
const barId = `${uid}-bar`
const glowId = `${uid}-glow`
const url = (id: string): string => `url(#${id})`

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
           filters anywhere: every glow is a static gradient or a faint shape behind its icon. -->
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
          <stop offset="0" stop-color="#ff3b30" stop-opacity="0.5" />
          <stop offset="0.5" stop-color="#ff3b30" stop-opacity="0.16" />
          <stop offset="1" stop-color="#ff3b30" stop-opacity="0" />
        </radialGradient>
        <linearGradient :id="barId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff3b30" stop-opacity="0" />
          <stop offset="0.3" stop-color="#ff453a" stop-opacity="1" />
          <stop offset="0.7" stop-color="#ff453a" stop-opacity="1" />
          <stop offset="1" stop-color="#ff3b30" stop-opacity="0" />
        </linearGradient>
        <!-- Strong glow of a car alongside, in its proximity colour (always red there). Elliptical
             over CAR_ALONGSIDE_GLOW and transparent before that rect's edges. -->
        <radialGradient :id="glowId">
          <stop offset="0.35" stop-color="#f42525" stop-opacity="0.55" />
          <stop offset="0.6" stop-color="#f42525" stop-opacity="0.28" />
          <stop offset="0.82" stop-color="#f42525" stop-opacity="0.1" />
          <stop offset="1" stop-color="#f42525" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect
        v-once
        class="radar__bg"
        :x="-BG_HALF"
        :y="-BG_HALF"
        :width="BG_HALF * 2"
        :height="BG_HALF * 2"
        :rx="BG_RADIUS"
      />

      <g :clip-path="url(clipId)">
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
          <line v-for="(y, i) in guides.ticksY" :key="i" x1="-1.4" :y1="y" x2="1.4" :y2="y" />
        </g>

        <RadarSideAlert
          v-memo="[left]"
          :alert="left"
          :mirrored="false"
          :wash-url="url(washId)"
          :bar-url="url(barId)"
        />
        <RadarSideAlert
          v-memo="[right]"
          :alert="right"
          :mirrored="true"
          :wash-url="url(washId)"
          :bar-url="url(barId)"
        />

        <!-- Positions follow the 60 Hz data directly: no transitions on transform. The shapes
             inherit the car's fill, so a frame changes at most transform, opacity and fill. -->
        <g
          v-for="car in cars"
          :key="car.key"
          v-memo="[car.transform, car.opacity, car.fill, car.stroke, car.overlapping]"
          :transform="car.transform"
          :opacity="car.opacity"
          :fill="car.fill"
        >
          <rect v-if="car.overlapping" v-bind="CAR_ALONGSIDE_GLOW" :fill="url(glowId)" />
          <rect class="radar__halo-outer" v-bind="CAR_HALO_OUTER" />
          <rect class="radar__halo-inner" v-bind="CAR_HALO_INNER" />
          <rect class="radar__car" v-bind="CAR_BODY" :stroke="car.stroke" />
        </g>

        <!-- You: the accent outline, the same colour that marks you in every widget. -->
        <g v-once class="radar__player">
          <rect class="radar__halo-outer" v-bind="PLAYER_HALO_OUTER" />
          <rect class="radar__halo-inner" v-bind="PLAYER_HALO_INNER" />
          <rect class="radar__player-body" v-bind="CAR_BODY" />
          <rect class="radar__windshield" x="-2.4" y="-4.6" width="4.8" height="2.6" rx="0.9" />
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

/* Background and guides scale with --ov-bg-alpha (.ov-surface); cars, player and alerts stay
   fully opaque. Pure CSS: an opacity change re-renders nothing. */
.radar__bg {
  fill: var(--ov-bg);
  stroke: var(--ov-border);
  stroke-width: 0.6;
}

.radar__guides line {
  stroke: var(--ov-fg-muted);
  /* 0.35 at the default 0.8. */
  stroke-opacity: calc(0.44 * var(--ov-bg-alpha));
  stroke-width: 0.35;
}

.radar__guides .radar__guide-half {
  stroke-dasharray: 1.5 1.5;
}

/* fill-opacity, not opacity: no compositing group per shape. Fill comes from the car's group. */
.radar__halo-outer {
  fill-opacity: 0.1;
}

.radar__halo-inner {
  fill-opacity: 0.26;
}

.radar__car {
  fill-opacity: 0.9;
  stroke-width: 1;
}

.radar__player {
  fill: var(--ov-fg);
}

.radar__player-body {
  stroke: var(--ov-accent);
  stroke-width: 0.8;
}

.radar__windshield {
  fill: rgba(0, 0, 0, 0.35);
}

.radar__labels text {
  fill: var(--ov-fg-dim);
  font-family: inherit;
  font-weight: 600;
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
