<script setup lang="ts">
import { computed } from 'vue'
import { vInlineStyle } from '../directives/inlineStyle'
import {
  FOOTER_EM,
  FOOTER_RULE_PX,
  WETNESS_CELLS,
  unwrapDeg,
  type FooterView
} from '../view/conditions'
import type { InlineStyle } from '../view/styles'
import Badge from './Badge.vue'
import Icon from './Icon.vue'

/**
 * The conditions footer of the relative and the standings: one line, FOOTER_EM high under a
 * 1 px rule (the height the tables' maths count), with the readings in FOOTER_ITEMS order. A
 * reading that does not fit the width wraps to a second line, which is clipped, so a narrow
 * table drops whole readings from the end (never a cut word); below 26 em the wetness keeps its
 * meter and swaps its word for a short caption ('AGUA') first. Rendered again only when `view`
 * changes (reuseFooter keeps it while every reading reads the same), each reading only when it
 * does.
 */
const props = defineProps<{ view: FooterView }>()

/** The wetness meter's cells, 1..WETNESS_CELLS. */
const METER: readonly number[] = Object.freeze(
  Array.from({ length: WETNESS_CELLS }, (_, i) => i + 1)
)
/** Fixed heights from view/conditions.ts, so the CSS is what the tables' maths assume. */
const BOX: InlineStyle = Object.freeze({
  '--cf-h': `${FOOTER_EM}em`,
  '--cf-rule': `${FOOTER_RULE_PX}px`
})

/**
 * The wind arrow's turn, unwrapped against the last one so it always turns the short way; kept
 * while there is no direction, so it comes back from where it was.
 */
const arrowDeg = computed<number | null>((prev) => {
  const from = props.view.wind?.fromDeg ?? null
  return from === null ? (prev ?? null) : unwrapDeg(prev ?? null, from)
})
const arrowStyle = computed<InlineStyle | undefined>(() =>
  arrowDeg.value === null ? undefined : { transform: `rotate(${arrowDeg.value}deg)` }
)
</script>

<template>
  <footer v-inline-style="BOX" class="ov-cfoot">
    <span v-if="view.track" v-memo="[view.track]" class="cf-item">
      <span class="cf-label">{{ view.track.label }}</span>
      <span class="cf-num"
        >{{ view.track.value }}<span class="cf-unit ov-unit">{{ view.track.unit }}</span></span
      >
      <span
        v-if="view.track.trend"
        class="cf-trend"
        :class="{ 'is-steady': view.track.trend === 'minus' }"
        ><Icon :name="view.track.trend"
      /></span>
    </span>

    <!-- Water: the stewards' call (a state, so a plate), how wet (a meter), the rain. -->
    <span v-if="view.declaredWet" v-memo="[view.declaredWet]" class="cf-item">
      <Badge tone="info" class="cf-plate">{{ view.declaredWet }}</Badge>
    </span>
    <span v-if="view.wetness" v-memo="[view.wetness]" class="cf-item">
      <span class="cf-label cf-wet-label">{{ view.wetness.label }}</span>
      <span class="cf-meter" aria-hidden="true">
        <span
          v-for="i in METER"
          :key="i"
          class="cf-meter__cell"
          :class="{ 'is-on': i <= view.wetness.cells }"
        />
      </span>
      <span class="cf-text cf-wet-word">{{ view.wetness.value }}</span>
    </span>
    <span v-if="view.rain" v-memo="[view.rain]" class="cf-item">
      <span class="cf-label">{{ view.rain.label }}</span>
      <span class="cf-num">{{ view.rain.value }}</span>
    </span>

    <!-- Wind: a dial with your car pointing up and an arrow on the side it blows from; without a
         direction (calm, out of the car) its caption instead. -->
    <span v-if="view.wind" class="cf-item">
      <span v-if="view.wind.dial" class="cf-dial" aria-hidden="true">
        <svg class="cf-dial__face" viewBox="0 0 16 16" focusable="false">
          <circle class="cf-dial__ring" cx="8" cy="8" r="7.25" />
          <path
            class="cf-dial__car"
            d="M8 5.6c.7 0 1.1.5 1.1 1.15v3.6c0 .45-.35.8-.8.8h-.6c-.45 0-.8-.35-.8-.8v-3.6c0-.65.4-1.15 1.1-1.15z"
          />
        </svg>
        <span v-inline-style="arrowStyle" class="cf-dial__arrow">
          <svg viewBox="0 0 16 16" focusable="false">
            <path class="cf-dial__head" d="M8 5.3 4.7 1.2h6.6z" />
          </svg>
        </span>
      </span>
      <span v-else class="cf-label">{{ view.wind.label }}</span>
      <span class="cf-num"
        >{{ view.wind.value
        }}<span class="cf-unit cf-unit--word ov-unit">{{ view.wind.unit }}</span></span
      >
    </span>

    <span v-if="view.air" v-memo="[view.air]" class="cf-item">
      <span class="cf-label">{{ view.air.label }}</span>
      <span class="cf-num"
        >{{ view.air.value }}<span class="cf-unit ov-unit">{{ view.air.unit }}</span></span
      >
    </span>
    <span v-if="view.rubber" v-memo="[view.rubber]" class="cf-item">
      <span class="cf-label">{{ view.rubber.label }}</span>
      <span class="cf-text">{{ view.rubber.value }}</span>
    </span>
  </footer>
</template>

<style scoped>
/*
 * A band like the header's: a faint lift and a rule above it. Its left edge is the rows' content
 * line (after the rail). Every reading is a whole flex item of the line's height: the ones that
 * do not fit wrap to the second line, outside the clip. Fixed size, so contain: strict is safe:
 * a new reading re-lays out the footer only. The footer is the inline-size container of its
 * narrow rule.
 */
.ov-cfoot {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: center;
  column-gap: 0.85em;
  height: calc(var(--cf-h) + var(--cf-rule));
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  border-top: var(--cf-rule) solid var(--ov-rule);
  background: var(--ov-bg-head);
  overflow: hidden;
  white-space: nowrap;
  line-height: 1.2;
  contain: strict;
  container: cfoot / inline-size;
}

.cf-item {
  display: flex;
  flex: none;
  align-items: baseline;
  gap: 0.35em;
  height: var(--cf-h);
  line-height: var(--cf-h);
}

/* Captions as the header's: small caps, muted. */
.cf-label {
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

.cf-num {
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-body);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

/* '°C' tucked in after the degrees; a word unit ('km/h') a little apart. */
.cf-unit {
  font-size: max(var(--ov-min-text), var(--ov-t-unit));
}

.cf-unit--word {
  margin-left: 0.2em;
}

.cf-text {
  font-size: var(--ov-t-body);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

/* The trend is a shape, not a judgement: warmer is neither good nor bad. */
.cf-trend {
  display: flex;
  align-self: center;
  font-size: 0.75em;
  color: var(--ov-fg-muted);
}

.cf-trend.is-steady {
  color: var(--ov-fg-dim);
}

.cf-plate {
  align-self: center;
}

/* ---- Wetness meter: six recessed cells, one per level past dry, in the information blue --- */

.cf-meter {
  display: flex;
  align-self: center;
  gap: 1px;
}

.cf-meter__cell {
  width: 0.28em;
  height: 0.7em;
  border-radius: 1px;
  background: var(--ov-well);
  box-shadow: inset 0 0 0 1px var(--ov-tick);
}

.cf-meter__cell.is-on {
  background: var(--ov-info);
  box-shadow: none;
}

/* ---- Wind dial: your car (the accent: it is you) pointing up, the arrow on its rim -------- */

.cf-dial {
  position: relative;
  flex: none;
  align-self: center;
  width: 1.15em;
  height: 1.15em;
}

.cf-dial__face,
.cf-dial__arrow {
  position: absolute;
  inset: 0;
}

.cf-dial__face {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cf-dial__ring {
  fill: var(--ov-well);
  stroke: var(--ov-tick-major);
  stroke-width: 1;
}

.cf-dial__car {
  fill: var(--ov-accent);
}

/* Turned by its inline transform; a second's eased turn between two 1 Hz readings. */
.cf-dial__arrow {
  display: block;
  transition: transform 0.8s ease-out;
}

.cf-dial__arrow svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.cf-dial__head {
  fill: var(--ov-fg);
}

@media (prefers-reduced-motion: reduce) {
  .cf-dial__arrow {
    transition: none;
  }
}

/*
 * Narrow tables: the meter says how wet it is, so its word goes before any reading does, and a
 * short caption says what the meter is (a blue bar alone could be any gauge).
 */
.cf-wet-label {
  display: none;
}

@container cfoot (max-width: 26em) {
  .cf-wet-word {
    display: none;
  }

  .cf-wet-label {
    display: inline;
  }
}
</style>
