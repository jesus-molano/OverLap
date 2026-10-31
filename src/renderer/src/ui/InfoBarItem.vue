<script setup lang="ts">
import { computed } from 'vue'
import { vInlineStyle } from '../directives/inlineStyle'
import { WETNESS_CELLS, unwrapDeg } from '../view/conditions'
import type { InfoItemView } from '../view/infoBar'
import type { InlineStyle } from '../view/styles'
import Badge from './Badge.vue'
import Chip from './Chip.vue'
import Icon from './Icon.vue'
import IncidentCount from './IncidentCount.vue'
import FitWords from './FitWords.vue'

/**
 * One item of an info bar (InfoBar.vue), drawn as the headers and the conditions footer drew it:
 * captions in small caps, figures in the numeral face, states as plates. `lead`: the bar's first
 * item, a step stronger (the header's title). Rendered again only when its view changes.
 */
const props = defineProps<{ item: InfoItemView; lead?: boolean }>()

/** The wetness meter's cells, 1..WETNESS_CELLS. */
const METER: readonly number[] = Object.freeze(
  Array.from({ length: WETNESS_CELLS }, (_, i) => i + 1)
)

/** The wind arrow's turn, unwrapped against the last one so it always turns the short way. */
const arrowDeg = computed<number | null>((prev) => {
  const from = props.item.id === 'wind' ? props.item.reading.fromDeg : null
  return from === null ? (prev ?? null) : unwrapDeg(prev ?? null, from)
})
const arrowStyle = computed<InlineStyle | undefined>(() =>
  arrowDeg.value === null ? undefined : { transform: `rotate(${arrowDeg.value}deg)` }
)
</script>

<template>
  <span class="ib-item" :class="[`ib-${item.id}`, { 'is-lead': lead }]">
    <template v-if="item.id === 'title' || item.id === 'session'">
      <span class="ib-caption">{{ item.text }}</span>
    </template>
    <template v-else-if="item.id === 'sof' || item.id === 'carCount'">
      <span class="ib-meta">{{ item.text }}</span>
    </template>
    <template v-else-if="item.id === 'remaining'">
      <Icon :name="item.finished ? 'chequered' : 'clock'" class="ib-rem-icon" />
      <FitWords text-class="ib-lead-num" :short="item.text" :long="item.textLong" />
    </template>
    <template v-else-if="item.id === 'clock'">
      <span class="ib-num">{{ item.text }}</span>
    </template>
    <template v-else-if="item.id === 'simClock'">
      <Icon :name="item.night ? 'moon' : 'sun'" class="ib-rem-icon" />
      <span class="ib-num">{{ item.text }}</span>
    </template>
    <template v-else-if="item.id === 'incidents'">
      <IncidentCount v-bind="item.count" />
    </template>
    <template v-else-if="item.id === 'iRating'">
      <span class="ib-key">{{ item.key }}</span>
      <span class="ib-value" :class="`ov-tone-${item.tone}`"
        >{{ item.value }}<Icon v-if="item.arrow" :name="item.arrow" class="ib-arrow"
      /></span>
      <span v-if="item.swingUp" class="ib-more">{{ item.swingUp }}</span>
      <span v-if="item.swingDown" class="ib-more">{{ item.swingDown }}</span>
      <span v-if="item.neutral" class="ib-more">{{ item.neutral }}</span>
    </template>
    <template v-else-if="item.id === 'safetyRating'">
      <span class="ib-key">{{ item.key }}</span>
      <span class="ib-from">{{ item.from }} <span class="ib-dim">→</span></span>
      <span class="ib-value" :class="`ov-tone-${item.tone}`"
        >{{ item.to }}<Icon v-if="item.arrow" :name="item.arrow" class="ib-arrow"
      /></span>
      <Chip v-if="item.budgetTone === 'bad'" tone="bad" variant="solid" class="ib-chip">{{
        item.budget
      }}</Chip>
      <span v-else class="ib-more ib-budget" :class="`is-${item.budgetTone}`">{{
        item.budget
      }}</span>
    </template>
    <template v-else-if="item.id === 'fastestLap'">
      <span class="ib-best-tag" :class="{ 'is-mine': item.mine }">{{ item.tag }}</span>
      <span class="ib-num">{{ item.text }}</span>
    </template>
    <template v-else-if="item.id === 'fuelLaps'">
      <span class="ib-label">{{ item.label }}</span>
      <span class="ib-num">{{ item.value }}</span>
    </template>
    <template v-else-if="item.id === 'trackTemp'">
      <span class="ib-label">{{ item.reading.label }}</span>
      <span class="ib-num"
        >{{ item.reading.value }}<span class="ib-unit ov-unit">{{ item.reading.unit }}</span></span
      >
      <span
        v-if="item.reading.trend"
        class="ib-trend"
        :class="{ 'is-steady': item.reading.trend === 'minus' }"
        ><Icon :name="item.reading.trend"
      /></span>
    </template>
    <template v-else-if="item.id === 'airTemp'">
      <span class="ib-label">{{ item.reading.label }}</span>
      <span class="ib-num"
        >{{ item.reading.value }}<span class="ib-unit ov-unit">{{ item.reading.unit }}</span></span
      >
    </template>
    <template v-else-if="item.id === 'wind'">
      <span v-if="item.reading.dial" class="ib-dial" aria-hidden="true">
        <svg class="ib-dial__face" viewBox="0 0 16 16" focusable="false">
          <circle class="ib-dial__ring" cx="8" cy="8" r="7.25" />
          <path
            class="ib-dial__car"
            d="M8 5.6c.7 0 1.1.5 1.1 1.15v3.6c0 .45-.35.8-.8.8h-.6c-.45 0-.8-.35-.8-.8v-3.6c0-.65.4-1.15 1.1-1.15z"
          />
        </svg>
        <span v-inline-style="arrowStyle" class="ib-dial__arrow">
          <svg viewBox="0 0 16 16" focusable="false">
            <path class="ib-dial__head" d="M8 5.3 4.7 1.2h6.6z" />
          </svg>
        </span>
      </span>
      <span v-else class="ib-label">{{ item.reading.label }}</span>
      <span class="ib-num"
        >{{ item.reading.value
        }}<span class="ib-unit ib-unit--word ov-unit">{{ item.reading.unit }}</span></span
      >
    </template>
    <template v-else-if="item.id === 'wet'">
      <Badge v-if="item.declared" tone="info" class="ib-plate">{{ item.declared }}</Badge>
      <template v-if="item.wetness">
        <span class="ib-meter" aria-hidden="true">
          <span
            v-for="i in METER"
            :key="i"
            class="ib-meter__cell"
            :class="{ 'is-on': i <= item.wetness.cells }"
          />
        </span>
        <span class="ib-text">{{ item.wetness.value }}</span>
      </template>
      <template v-if="item.rain">
        <span class="ib-label">{{ item.rain.label }}</span>
        <span class="ib-num">{{ item.rain.value }}</span>
      </template>
    </template>
    <template v-else-if="item.id === 'rubber'">
      <span class="ib-label">{{ item.reading.label }}</span>
      <span class="ib-text">{{ item.reading.value }}</span>
    </template>
  </span>
</template>

<style scoped>
.ib-item {
  display: inline-flex;
  flex: none;
  align-items: baseline;
  gap: 0.35em;
  min-width: 0;
  white-space: nowrap;
}

/* Plates and the dial centre themselves on the line. */
.ib-incidents,
.ib-fastestLap {
  align-items: center;
}

/* The header's caption: small caps, muted; the bar's first item a step stronger (its title). */
.ib-caption,
.ib-meta {
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

.ib-caption {
  text-transform: uppercase;
}

.is-lead .ib-caption {
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
}

.ib-label,
.ib-key {
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

.ib-key {
  letter-spacing: var(--ov-track-tag);
  text-transform: none;
  color: var(--ov-fg-dim);
}

.ib-num {
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-body);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

/* What is left: the one thing to read at a glance on a header (its words drawn by FitWords). */
.ib-remaining :deep(.ib-lead-num) {
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

.ib-rem-icon {
  align-self: center;
  font-size: 0.9em;
  color: var(--ov-fg-muted);
}

.ib-text {
  font-size: var(--ov-t-body);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

.ib-unit {
  font-size: max(var(--ov-min-text), var(--ov-t-unit));
}

.ib-unit--word {
  margin-left: 0.2em;
}

.ib-value {
  display: inline-flex;
  align-items: center;
  gap: 0.1em;
  font-family: var(--ov-font-num);
  font-size: 1.1em;
  font-weight: var(--ov-w-strong);
}

.ib-arrow {
  font-size: 0.9em;
}

.ib-from,
.ib-more {
  font-size: max(var(--ov-min-text), 0.8em);
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

.ib-dim {
  color: var(--ov-fg-dim);
}

/* Each piece after a value is its own group, set off by a 0-blur hairline. */
.ib-more {
  padding-left: 0.5em;
  box-shadow: inset 1px 0 0 var(--ov-rule);
}

.ib-budget.is-warn {
  color: var(--ov-warn);
  font-weight: var(--ov-w-strong);
}

.ib-chip,
.ib-plate {
  align-self: center;
}

/* The fastest lap: the racing convention's purple plate; yours ringed in the accent too. */
.ib-best-tag {
  display: inline-flex;
  align-items: center;
  height: var(--ov-plate-h);
  padding: 0 0.4em;
  border-radius: var(--ov-radius-chip);
  background: var(--ov-best-fill);
  color: #fff;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
}

.ib-best-tag.is-mine {
  box-shadow: inset 0 0 0 1px var(--ov-accent);
}

/* The trend is a shape, not a judgement: warmer is neither good nor bad. */
.ib-trend {
  display: flex;
  align-self: center;
  font-size: 0.75em;
  color: var(--ov-fg-muted);
}

.ib-trend.is-steady {
  color: var(--ov-fg-dim);
}

.ib-meter {
  display: flex;
  align-self: center;
  gap: 1px;
}

.ib-meter__cell {
  width: 0.28em;
  height: 0.7em;
  border-radius: 1px;
  background: var(--ov-well);
  box-shadow: inset 0 0 0 1px var(--ov-tick);
}

.ib-meter__cell.is-on {
  background: var(--ov-info);
  box-shadow: none;
}

.ib-dial {
  position: relative;
  flex: none;
  align-self: center;
  width: 1.15em;
  height: 1.15em;
}

.ib-dial__face,
.ib-dial__arrow {
  position: absolute;
  inset: 0;
}

.ib-dial__face {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ib-dial__ring {
  fill: var(--ov-well);
  stroke: var(--ov-tick-major);
  stroke-width: 1;
}

.ib-dial__car {
  fill: var(--ov-accent);
}

.ib-dial__arrow {
  display: block;
  transition: transform 0.8s ease-out;
}

.ib-dial__arrow svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ib-dial__head {
  fill: var(--ov-fg);
}

@media (prefers-reduced-motion: reduce) {
  .ib-dial__arrow {
    transition: none;
  }
}
</style>
