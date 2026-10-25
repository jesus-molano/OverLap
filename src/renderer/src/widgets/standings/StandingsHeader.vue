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
        <span v-if="head.irSwing" class="sd-m sd-swing">{{ head.irSwing }}</span>
        <span v-if="head.irNeutral" class="sd-m sd-neutral">· {{ head.irNeutral }}</span>
      </span>
      <span v-else-if="head.best" class="sd-group sd-best">{{ head.best }}</span>
      <span v-if="head.hasSr" class="sd-group sd-sr">
        <span class="sd-k">{{ t.widgets.standings.srKey }}</span>
        <span class="sd-from">{{ head.srFrom }} <span class="sd-m">→</span></span>
        <span class="sd-v" :class="`ov-tone-${head.srTone}`"
          >{{ head.srTo }}<Icon v-if="head.srArrow" :name="head.srArrow" class="sd-arrow"
        /></span>
        <span class="sd-m sd-inc">· {{ head.srIncidents }}</span>
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
.sd-head {
  flex: none;
  padding: var(--sd-head-pad) 0.7em;
  border-bottom: 1px solid var(--ov-border);
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

.sd-title {
  flex: none;
  font-size: var(--ov-t-caption);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

.sd-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-caption);
  color: var(--ov-fg-muted);
}

/* The one thing to read at a glance on the right: what is left. */
.sd-rem {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.3em;
  margin-left: auto;
  font-size: max(var(--ov-min-text), 0.9em);
  font-weight: 600;
  color: var(--ov-fg);
}

.sd-rem-icon {
  font-size: 0.9em;
  color: var(--ov-fg-muted);
}

.sd-group {
  display: flex;
  align-items: baseline;
  gap: 0.35em;
  min-width: 0;
  overflow: hidden;
  font-size: max(var(--ov-min-text), 0.8em);
}

.sd-sr {
  flex: none;
  margin-left: auto;
}

.sd-k {
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--ov-fg-muted);
}

.sd-v {
  display: inline-flex;
  align-items: center;
  gap: 0.1em;
  font-size: 1.1em;
  font-weight: 700;
}

.sd-arrow {
  font-size: 0.75em;
}

.sd-m {
  color: var(--ov-fg-muted);
}

.sd-swing,
.sd-neutral {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sd-best {
  font-weight: 600;
  color: var(--ov-fg);
}

.sd-budget {
  align-self: center;
  padding: 0 0.4em;
  line-height: 1.25;
}

.sd-budget-text.is-neutral,
.sd-budget-text.is-dim {
  color: var(--ov-fg-muted);
}

.sd-budget-text.is-warn {
  color: var(--ov-warn);
  font-weight: 600;
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
