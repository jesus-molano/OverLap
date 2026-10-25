<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@renderer/composables/useI18n'
import Badge from '@renderer/ui/Badge.vue'
import DriverCell from '@renderer/ui/DriverCell.vue'
import Icon from '@renderer/ui/Icon.vue'
import LicenseChip from '@renderer/ui/LicenseChip.vue'
import PositionChip from '@renderer/ui/PositionChip.vue'
import type { Columns } from './columns'
import type { CarLineView } from './view'

/**
 * The cells of one car line, as direct grid items of the line (multi-root): position (or the
 * class tag of another class's leader), driver, then the right-hand columns in the user's
 * order. The parent memoises each line, so this only renders when its line or columns change.
 */
const props = defineProps<{ line: CarLineView; cols: Columns }>()
const t = useI18n()

const numberStyle = computed(() => (props.cols.numberStyle === 'chip' ? 'chip' : 'stripe'))
const number = computed(() => (props.cols.numberStyle === 'bare' ? '' : props.line.number))
/** Pit state next to the name when the pit column is not shown (stops alone are not worth it). */
const inlinePit = computed(() =>
  props.cols.pitInline && props.line.pit !== 'stops' && props.line.pit !== 'none'
    ? props.line.pit
    : null
)
</script>

<template>
  <span v-if="line.kind === 'leader'" class="c-lead">
    <span class="sd-tag">{{ line.classTag }}</span>
    <DriverCell class="c-driver" :number="number" :name="line.name" :number-style="numberStyle" />
  </span>
  <template v-else>
    <span class="c-pos"
      ><PositionChip :pos="line.pos" :player="line.player" :warn="line.posWarn"
    /></span>
    <DriverCell
      class="c-driver"
      :number="number"
      :name="line.name"
      :number-style="numberStyle"
      :player="line.player"
    >
      <span v-if="line.penalty || line.disconnected || inlinePit" class="sd-icons">
        <Icon v-if="line.penalty === 'black'" name="flag" class="sd-flag" />
        <Icon v-else-if="line.penalty === 'meatball'" name="meatball" />
        <Icon v-if="line.disconnected" name="plug" class="sd-plug" />
        <Icon v-if="inlinePit === 'finished'" name="chequered" />
        <Icon v-else-if="inlinePit === 'pit'" name="pit" class="sd-inline-pit" />
        <Icon v-else-if="inlinePit === 'out'" name="out" class="sd-inline-out" />
      </span>
    </DriverCell>
  </template>
  <template v-for="id in cols.cells" :key="id">
    <span v-if="id === 'gained'" class="c-gained" :class="`ov-tone-${line.gainedTone}`">{{
      line.gained
    }}</span>
    <span v-else-if="id === 'ir'" class="c-ir">{{ line.iRating }}</span>
    <span v-else-if="id === 'lic'" class="c-lic"
      ><LicenseChip v-if="line.lic" :text="line.lic" :colors="line.licStyle"
    /></span>
    <span v-else-if="id === 'delta'" class="c-delta" :class="`ov-tone-${line.deltaTone}`">{{
      line.delta
    }}</span>
    <span v-else-if="id === 'gap'" class="c-gap" :class="`is-${line.gapKind}`">{{ line.gap }}</span>
    <span v-else-if="id === 'gapLeader'" class="c-gapl" :class="`is-${line.gapLeaderKind}`">{{
      line.gapLeader
    }}</span>
    <span v-else-if="id === 'last'" class="c-lap"
      ><span class="sd-lap" :class="`is-${line.lapKind}`">{{ line.lap }}</span></span
    >
    <span v-else-if="id === 'pit'" class="c-pit">
      <Badge v-if="line.pit === 'pit'">{{ t.widgets.common.pit }}</Badge>
      <Badge v-else-if="line.pit === 'out'" variant="outline">{{ t.widgets.common.out }}</Badge>
      <Icon v-else-if="line.pit === 'finished'" name="chequered" class="sd-chequered" />
      <span v-else-if="line.pit === 'stops'" class="sd-stops"
        ><Icon name="pit" class="sd-stops-icon" />{{ line.pitStops }}</span
      >
    </span>
  </template>
</template>

<style scoped>
.c-pos,
.c-lic,
.c-pit {
  display: flex;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
}

.c-driver {
  min-width: 0;
  overflow: hidden;
}

/* Another class's leader: its class tag where the position goes, the name after it. */
.c-lead {
  grid-column: 1 / span 2;
  display: flex;
  align-items: center;
  gap: 0.4em;
  min-width: 0;
  overflow: hidden;
}

.sd-tag {
  flex: none;
  min-width: 2.4em;
  max-width: 6em;
  overflow: hidden;
  padding: 0 0.35em;
  border-radius: var(--ov-radius-chip);
  background: var(--cls);
  color: var(--cls-fg);
  font-size: max(var(--ov-min-text), 0.68em);
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: 0.06em;
  text-align: center;
  text-overflow: ellipsis;
  text-transform: uppercase;
  text-shadow: none;
}

.sd-icons {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.25em;
  font-size: 0.85em;
}

.sd-flag {
  color: #0b0c0e;
  stroke: var(--ov-fg);
  stroke-width: 0.6;
}

.sd-plug {
  color: var(--ov-fg-muted);
}

.sd-inline-pit {
  color: var(--ov-fg);
}

.sd-inline-out {
  color: var(--ov-fg-muted);
}

.c-gained,
.c-ir,
.c-delta,
.c-gap,
.c-gapl {
  min-width: 0;
  overflow: hidden;
  text-align: right;
}

.c-gained {
  font-size: max(var(--ov-min-text), 0.75em);
  font-weight: 600;
}

.c-ir {
  font-size: var(--ov-t-secondary);
  color: var(--ov-fg-muted);
}

.c-delta {
  font-size: var(--ov-t-secondary);
  font-weight: 600;
}

.c-gap {
  font-weight: 600;
}

.c-gapl {
  font-size: max(var(--ov-min-text), 0.9em);
  color: var(--ov-fg-muted);
}

.c-gap.is-laps,
.c-gapl.is-laps {
  color: var(--ov-info);
}

.c-gap.is-leader {
  font-size: max(var(--ov-min-text), 0.68em);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ov-fg-muted);
}

.c-gap.is-none,
.c-gapl.is-none {
  color: var(--ov-fg-dim);
}

.c-lap {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
  overflow: hidden;
}

.sd-lap {
  padding: 0 0.25em;
  border-radius: var(--ov-radius-chip);
  font-size: max(var(--ov-min-text), 0.85em);
  line-height: 1.3;
}

/* Fastest lap of the class: filled. */
.sd-lap.is-best {
  background: var(--ov-best);
  color: #ffffff;
  font-weight: 700;
  text-shadow: none;
}

/* The driver's own best: a ring and green text. */
.sd-lap.is-pb {
  box-shadow: inset 0 0 0 1px var(--ov-good);
  color: var(--ov-good);
  font-weight: 600;
}

.sd-lap.is-none {
  color: var(--ov-fg-dim);
}

.sd-chequered {
  font-size: 0.95em;
}

.sd-stops {
  display: inline-flex;
  align-items: center;
  gap: 0.2em;
  font-size: var(--ov-t-caption);
  color: var(--ov-fg-muted);
}

.sd-stops-icon {
  font-size: 1.1em;
}

/* Row states (classes on the line, see view.ts): pits dim everything but the pit state. */
.is-pits > :not(.c-pit, .c-driver),
.is-pits > .c-driver > :deep(:not(.sd-icons)) {
  opacity: var(--ov-pit-opacity);
}

.is-disconnected > * {
  opacity: 0.4;
}

.is-disconnected > .c-driver :deep(.ov-driver__name) {
  color: var(--ov-fg-muted);
}
</style>
