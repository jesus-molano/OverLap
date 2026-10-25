<script setup lang="ts">
import { useI18n } from '@renderer/composables/useI18n'
import Chip from '@renderer/ui/Chip.vue'
import Icon from '@renderer/ui/Icon.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import SimPill from '@renderer/ui/SimPill.vue'
import type { HeaderTier, HeaderView } from './headerView'

/**
 * Line 1: session caption, SIM / preview tags, single-class SoF, and what is left on the right.
 * Line 2: your iRating (or the session best lap) on the left, your SR and margin on the right.
 * Both lines have fixed heights (layout.ts), so the header never changes the panel height by
 * its content.
 */
defineProps<{ head: HeaderView; tier: HeaderTier }>()

const t = useI18n()
</script>

<template>
  <header class="sd-head" :class="tier !== '' ? `tier-${tier}` : ''">
    <div class="sd-l1">
      <span class="sd-title">{{ head.title }}</span>
      <SimPill />
      <PreviewTag v-if="head.preview" class="sd-ptag" />
      <span v-if="head.meta" class="sd-meta">{{ head.meta }}</span>
      <span v-if="head.finished" class="sd-rem">
        <Icon name="chequered" class="sd-rem-icon" />
        {{ t.widgets.standings.finished }}
      </span>
      <span v-else-if="head.remaining" class="sd-rem">
        <Icon name="clock" class="sd-rem-icon" />
        {{ head.remaining }}
      </span>
    </div>
    <div v-if="head.lines === 2" class="sd-l2">
      <span v-if="head.hasIr" class="sd-group">
        <span class="sd-k">{{ t.widgets.standings.irKey }}</span>
        <span class="sd-v" :class="`ov-tone-${head.irTone}`"
          >{{ head.irValue }}<Icon v-if="head.irArrow" :name="head.irArrow" class="sd-arrow"
        /></span>
        <span v-if="head.irSwingUp" class="sd-m sd-swing">{{ head.irSwingUp }}</span>
        <span v-if="head.irSwingDown" class="sd-m sd-swing">{{ head.irSwingDown }}</span>
        <span v-if="head.irNeutral" class="sd-m sd-neutral">{{ head.irNeutral }}</span>
      </span>
      <span v-else-if="head.best" class="sd-group sd-best">{{ head.best }}</span>
      <span v-if="head.hasSr" class="sd-group sd-sr">
        <span class="sd-k">{{ t.widgets.standings.srKey }}</span>
        <span class="sd-from">{{ head.srFrom }} <span class="sd-m">→</span></span>
        <span class="sd-v" :class="`ov-tone-${head.srTone}`"
          >{{ head.srTo }}<Icon v-if="head.srArrow" :name="head.srArrow" class="sd-arrow"
        /></span>
        <span class="sd-m sd-inc">{{ head.srIncidents }}</span>
        <Chip v-if="head.srBudgetTone === 'bad'" tone="bad" variant="solid" class="sd-budget">{{
          head.srBudget
        }}</Chip>
        <span v-else class="sd-budget-text" :class="`is-${head.srBudgetTone}`">{{
          head.srBudget
        }}</span>
      </span>
    </div>
  </header>
</template>

<style scoped>
/*
 * The header band: a faint lift over the glass and a rule under it. Its left edge is the rows'
 * content line (after the rail), so titles, plates and names share one vertical.
 */
.sd-head {
  flex: none;
  padding: var(--sd-head-pad) 0.6em var(--sd-head-pad) calc(var(--ov-bar-w) + 0.35em);
  background: var(--ov-bg-head);
  border-bottom: 1px solid var(--ov-rule);
  white-space: nowrap;
}

/* Heights from layout.ts; fonts are set on the items, so the lines' em stays the panel's. */
.sd-l1,
.sd-l2 {
  display: flex;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
  overflow: hidden;
  line-height: 1.2;
}

.sd-l1 {
  height: var(--sd-head-l1);
}

.sd-l2 {
  height: var(--sd-head-l2);
  justify-content: space-between;
}

/* Same caption as PanelHeader's title and meta. */
.sd-title {
  flex: none;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

.sd-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

/* The one thing to read at a glance on the right: what is left, in the numeral face. */
.sd-rem {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.3em;
  margin-left: auto;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

.sd-rem-icon {
  font-size: 0.9em;
  color: var(--ov-fg-muted);
}

/* Groups are spaced by the gap alone: no separator characters. */
.sd-group {
  display: flex;
  align-items: baseline;
  gap: 0.45em;
  min-width: 0;
  overflow: hidden;
  font-size: max(var(--ov-min-text), 0.8em);
}

.sd-sr {
  flex: none;
  margin-left: auto;
}

/* Known labels ('iR', 'SR'): small caps, dim. */
.sd-k {
  font-family: var(--ov-font-small);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
  color: var(--ov-fg-dim);
}

.sd-v {
  display: inline-flex;
  align-items: center;
  gap: 0.1em;
  font-family: var(--ov-font-num);
  font-size: 1.1em;
  font-weight: var(--ov-w-strong);
}

/* The direction as a shape too, big enough to read without its colour. */
.sd-arrow {
  font-size: 0.9em;
}

.sd-m {
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

.sd-swing,
.sd-neutral {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Each piece after the value is its own group, set off by a 0-blur hairline (the edit chip's
   divider), so 'P3 +46' and 'P5 +13' never run together. A hidden piece takes its rule along. */
.sd-swing,
.sd-neutral,
.sd-inc,
.sd-budget-text {
  padding-left: 0.5em;
  box-shadow: inset 1px 0 0 var(--ov-rule);
}

.sd-best {
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

/* A solid plate (Chip's own geometry), centred on the baseline-aligned line. */
.sd-budget {
  align-self: center;
}

.sd-budget-text.is-neutral,
.sd-budget-text.is-dim {
  color: var(--ov-fg-muted);
}

.sd-budget-text.is-warn {
  color: var(--ov-warn);
  font-weight: var(--ov-w-strong);
}

/* Narrower panels drop the secondary pieces first (headerTier). */
.tier-m .sd-swing,
.tier-s .sd-swing,
.tier-s .sd-neutral,
.tier-s .sd-from,
.tier-xs .sd-swing,
.tier-xs .sd-neutral,
.tier-xs .sd-from,
.tier-xs .sd-inc,
.tier-xs .sd-meta,
.tier-s .sd-ptag,
.tier-xs .sd-ptag {
  display: none;
}
</style>
