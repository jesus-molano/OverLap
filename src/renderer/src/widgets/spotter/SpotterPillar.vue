<script setup lang="ts">
import type { SpotterBarStyle, SpotterSide } from '@shared/types'
import { closeBucket, closeTransform, coverBucket, segmentTransform } from './view'

/**
 * One pillar of the spotter. «Cercanía» (the default): filled from the bottom as the nearest car
 * on that side gets closer, full alongside, amber to red. «Dónde te cubre»: your car from its nose
 * (top) to its tail (bottom), filled with what the cars alongside on that side cover. The fill
 * moves by transform only, the caps by opacity: a 60 Hz pass changes no layout.
 */
defineProps<{
  side: SpotterSide
  barStyle: SpotterBarStyle
  /** 'left' or 'right': its place, and the end of the window it sits at. */
  at: 'left' | 'right'
  showNear: boolean
  showTwo: boolean
}>()
</script>

<template>
  <div
    class="sp-pillar"
    :class="[
      `sp-pillar--${at}`,
      `sp-n${side.count}`,
      barStyle === 'closeness'
        ? { 'is-full': side.close >= 1 }
        : { 'is-full': side.cover >= 1 && !side.unknown, 'is-unknown': side.unknown }
    ]"
  >
    <div v-if="barStyle === 'closeness'" class="sp-track">
      <div
        class="sp-close"
        :class="`cl-${closeBucket(side.close)}`"
        :style="{ transform: closeTransform(side.close) }"
      />
    </div>
    <div v-else class="sp-track">
      <div class="sp-mid" />
      <template v-if="showNear">
        <div
          class="sp-near sp-near--front"
          :style="{ opacity: side.nearFront }"
          data-el="spotter.parts.nearCap"
        />
        <div
          class="sp-near sp-near--rear"
          :style="{ opacity: side.nearRear }"
          data-el="spotter.parts.nearCap"
        />
      </template>
      <div
        v-for="(s, i) in side.segs"
        :key="i"
        class="sp-fill"
        :class="`rc-${coverBucket(side.cover)}`"
        :style="{ transform: segmentTransform(s) }"
      />
      <div v-if="side.unknown" class="sp-unknown" />
    </div>
    <span v-if="showTwo && side.count === 2" class="sp-two" data-el="spotter.parts.twoMark">2</span>
  </div>
</template>

<style scoped>
.sp-pillar {
  position: relative;
  flex: none;
  width: var(--sp-w);
  height: 100%;
}

/*
 * The track: the same glass and two-tone bezel as every panel (a dark outer keyline over a
 * bright sky, a light inner ring over asphalt, a lit top edge), rounded as a pill. It clips the
 * fill to its shape.
 */
.sp-track {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: calc(var(--sp-w) / 2);
  background: var(--ov-bg);
  border: 1px solid var(--ov-edge-out);
  box-shadow:
    inset 0 0 0 1px var(--ov-edge-in),
    inset 0 1px 0 var(--ov-edge-top);
}

/* The middle of your car: a faint rule, so "half alongside" reads without counting. */
.sp-mid {
  position: absolute;
  left: 20%;
  right: 20%;
  top: 50%;
  height: 1px;
  background: var(--ov-fg);
  opacity: calc(0.18 * max(var(--ov-bg-alpha), 0.6));
}

/*
 * «Cercanía»: a full-height block scaled from the bottom (closeTransform), the same rule on both
 * bars. Its colour by how close (view.ts closeBucket): amber far, the alert red alongside, mixed
 * from the theme's own two (their colour-blind variants included).
 */
.sp-close {
  position: absolute;
  inset: 0;
  transform-origin: 50% 100%;
}
.cl-0 {
  background: var(--ov-warn);
}
.cl-1 {
  background: color-mix(in oklab, var(--ov-alert) 20%, var(--ov-warn));
}
.cl-2 {
  background: color-mix(in oklab, var(--ov-alert) 40%, var(--ov-warn));
}
.cl-3 {
  background: color-mix(in oklab, var(--ov-alert) 60%, var(--ov-warn));
}
.cl-4 {
  background: color-mix(in oklab, var(--ov-alert) 80%, var(--ov-warn));
}
.cl-5 {
  background: var(--ov-alert);
}

/* What a car alongside covers: a full-height block scaled from the top (segmentTransform). */
.sp-fill {
  position: absolute;
  inset: 0;
  transform-origin: 50% 0;
}

/*
 * The fill's colour by how much of you is covered (view.ts coverBucket): the radar's proximity
 * ramp, warming to the alert red when a car is completely beside you. The colours live in
 * theme.css with their colour-blind variant.
 */
.rc-4 {
  background: var(--ov-prox-4);
}
.rc-5 {
  background: var(--ov-prox-5);
}
.rc-6 {
  background: var(--ov-prox-6);
}
.rc-7 {
  background: var(--ov-prox-7);
}
.rc-8 {
  background: var(--ov-prox-8);
}
.rc-9 {
  background: var(--ov-prox-9);
}
.rc-10 {
  background: var(--ov-prox-10);
}
.rc-11 {
  background: var(--ov-prox-11);
}

/* Completely beside you (a car placed, not "somewhere here"; for «Cercanía», alongside): the
   outline turns alert red too, a cue that is not only the colour. */
.sp-pillar.is-full .sp-track {
  border-color: var(--ov-alert);
  box-shadow:
    inset 0 0 0 1px var(--ov-alert),
    inset 0 1px 0 var(--ov-edge-top);
}

/*
 * A car that was alongside, now just off your nose or tail: a faint cap at that end, fading in as
 * it gets closer (opacity only).
 */
.sp-near {
  position: absolute;
  left: 0;
  right: 0;
  height: 28%;
  transition: opacity 120ms linear;
}

.sp-near--front {
  top: 0;
  background: linear-gradient(to bottom, var(--ov-prox-6), transparent);
}

.sp-near--rear {
  bottom: 0;
  background: linear-gradient(to top, var(--ov-prox-6), transparent);
}

/* Alongside on this side, but where along your car is not known: dashed, "somewhere here". */
.sp-unknown {
  position: absolute;
  inset: 2px;
  border-radius: inherit;
  border: 1px dashed var(--ov-fg);
  background: var(--ov-prox-8);
  opacity: 0.45;
}

/* Two cars on this side: a «2» over the middle of the pillar, haloed over the fill. */
.sp-two {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--ov-font-small);
  font-weight: var(--ov-w-strong);
  font-size: max(var(--ov-min-text), calc(var(--sp-w) * 0.9));
  line-height: 1;
  color: var(--ov-fg);
  font-variant-numeric: tabular-nums;
  text-shadow: var(--ov-text-halo);
  pointer-events: none;
}
</style>
