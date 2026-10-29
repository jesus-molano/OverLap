<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { isElementVisible } from '@shared/elements'
import { deepEqual } from '@shared/equal'
import { useContentSize } from '@renderer/composables/useContentSize'
import { useI18n } from '@renderer/composables/useI18n'
import { useReveal } from '@renderer/composables/useReveal'
import { useElementSize } from '@renderer/composables/useElementSize'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import { useAutoHeight, useNameFormat, useOptions } from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import Badge from '@renderer/ui/Badge.vue'
import Chip from '@renderer/ui/Chip.vue'
import DriverCell from '@renderer/ui/DriverCell.vue'
import Icon from '@renderer/ui/Icon.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView, reuseViews } from '@renderer/view/reuse'
import { createDriverStyles } from '@renderer/view/styles'
import { previewBattle } from './preview'
import {
  arrangement,
  hasOpponents,
  laneRows,
  toLaneViews,
  type LaneOptions,
  type LaneRows,
  type LaneView
} from './view'

const NO_LANES: readonly LaneView[] = Object.freeze([])

const options = useOptions('battle')
const nameFormat = useNameFormat('battle')
const autoHeight = useAutoHeight()
const { surfaceStyle, halo, fontPx } = useWidgetSurface()
// Finished race, holdS and the side options are the provider's: it simply stops sending opponents.
const { data, phase } = useWidgetPhase('battle', { showsOffline: false, hasContent: hasOpponents })
const styles = createDriverStyles()
const t = useI18n()

// Options are stable objects (useOptions); each view input keeps its identity while equal, so
// a threshold change or a drag re-renders nothing.
// Until the lanes draw their lists in order (package P3): the rows and parts they have today.
const laneOptions = computed<LaneOptions>((prev) => {
  const o = options.value
  const sectors = isElementVisible(o.rows, 'sectors')
  const laps = isElementVisible(o.rows, 'laps')
  return reuseView(prev, {
    detail: sectors && laps ? 'both' : sectors ? 'sectors' : laps ? 'laps' : 'none',
    showPrediction: isElementVisible(o.rows, 'prediction'),
    showStake: isElementVisible(o.parts, 'stake'),
    nameFormat: nameFormat.value
  })
})
const rows = computed<LaneRows>((prev) => reuseView(prev, laneRows(laneOptions.value)))

/** Live data, the sample in edit mode, or what was shown last (kept through the fade-out). */
const content = useShownContent(
  () => phase.value,
  () => data.value,
  () =>
    previewBattle(
      isElementVisible(options.value.lanes, 'ahead'),
      isElementVisible(options.value.lanes, 'behind')
    )
)

/** Lanes keep their objects while equal, so each lane's v-memo skips unchanged ones. */
const lanes = computed<readonly LaneView[]>((prev) => {
  const d = content.value
  if (d === null) return prev ?? NO_LANES
  return reuseViews(prev, toLaneViews(d, laneOptions.value, styles, t.value), deepEqual)
})

const preview = computed(() => phase.value === 'preview')
const wanted = computed(
  () => (phase.value === 'live' || phase.value === 'preview') && lanes.value.length > 0
)
// The widget's width (set by the user; it changes only in edit mode).
const root = useTemplateRef<HTMLElement>('root')
const rootSize = useElementSize(root)
const widthEm = computed(() => (rootSize.value.w > 0 ? rootSize.value.w / fontPx.value : Infinity))
const layout = computed(() => arrangement(options.value.layout, lanes.value.length, widthEm.value))
/** Everything the panel height depends on besides the width and the font. */
const layoutKey = computed(() => {
  const r = rows.value
  return `${lanes.value.length}|${layout.value}|${r.catch}|${r.sectors}|${r.laps}`
})
/** Where the VISTA PREVIA tag goes: the last lane's prediction row, else its trend row. */
const previewTag = computed(() => (preview.value ? (rows.value.catch ? 'catch' : 'trend') : null))

const shown = useReveal(
  () => wanted.value,
  () => layoutKey.value,
  { fit: () => autoHeight.value }
)

// The panel is as tall as its lanes, whatever the widget's height: its overlay panel fits to it.
// It only exists once there are lanes (and then keeps the last ones while hidden), so the first
// height measured is the real one, never that of an empty panel.
const panel = useTemplateRef('panel')
useContentSize(panel, { enabled: () => autoHeight.value && wanted.value })
</script>

<template>
  <div ref="root" class="battle ov-root ov-fade" :class="{ 'is-shown': shown }">
    <WidgetPanel
      v-if="lanes.length > 0"
      ref="panel"
      class="battle__panel"
      :class="[`battle__panel--${layout}`, { 'battle__panel--fixed': !autoHeight }]"
      :surface="surfaceStyle"
      :halo="halo"
      :fill="!autoHeight"
    >
      <section
        v-for="(lane, i) in lanes"
        :key="lane.side"
        v-memo="[lane, rows, layout, i === lanes.length - 1 ? previewTag : null, t]"
        class="lane"
        :class="[`lane--${lane.tone}`, { 'lane--pit': lane.inPits }]"
      >
        <span class="lane__tag"><Icon :name="lane.tagIcon" />{{ lane.tag }}</span>
        <DriverCell
          class="lane__who"
          v-bind="lane.driver"
          :with-rating="layout !== 'side'"
          with-license
        >
          <Badge v-if="lane.inPits">{{ t.widgets.common.pit }}</Badge>
        </DriverCell>

        <span class="lane__gap ov-t-hero"
          >{{ lane.gap.value
          }}<span v-if="lane.gap.unit" class="lane__unit ov-unit">{{ lane.gap.unit }}</span></span
        >
        <span class="lane__trend">
          <span class="lane__trend-value" :class="`ov-tone-${lane.trend.tone}`">
            <Icon v-if="lane.trend.icon" :name="lane.trend.icon" />{{ lane.trend.text }}
          </span>
          <span class="lane__note">{{ lane.trend.note }}</span>
          <span v-if="lane.stake" class="lane__stake"
            ><b>{{ lane.stake }}</b
            >&nbsp;{{ t.widgets.battle.stake }}</span
          >
          <PreviewTag
            v-if="previewTag === 'trend' && i === lanes.length - 1"
            class="lane__preview"
          />
        </span>

        <div v-if="rows.catch" class="lane__catch">
          <Badge v-if="lane.lastLap" tone="warn">{{ t.widgets.battle.lastLap }}</Badge>
          <template v-else-if="lane.catch">
            <span class="lane__verdict" :class="`ov-tone-${lane.catch.tone}`">
              <Icon :name="lane.catch.icon" />
              <span class="lane__verdict-text">{{ lane.catch.text }}</span>
            </span>
            <span v-if="lane.catch.note" class="lane__note">{{ lane.catch.note }}</span>
          </template>
          <PreviewTag
            v-if="previewTag === 'catch' && i === lanes.length - 1"
            class="lane__preview"
          />
        </div>

        <div v-if="lane.sectors" class="lane__chips">
          <Chip
            v-for="c in lane.sectors"
            :key="c.label"
            class="lane__chip"
            :label="c.label"
            :tone="c.tone"
            >{{ c.text }}</Chip
          >
        </div>
        <div v-if="lane.laps" class="lane__chips">
          <Chip
            v-for="c in lane.laps"
            :key="c.label"
            class="lane__chip"
            :label="c.label"
            :tone="c.tone"
            >{{ c.text }}</Chip
          >
        </div>
      </section>
    </WidgetPanel>
  </div>
</template>

<style scoped>
/*
 * Nothing in the panel depends on the window height (no cqh, no height: 100%, font from the
 * scale setting): the content-to-window loop of the auto height cannot exist. Only with the
 * auto height off does the panel fill the window. The panel is the inline-size container
 * (em of the widget font) for the narrow-width rules at the end.
 */
.battle__panel {
  container: battle / inline-size;
}

.battle__panel--side {
  flex-direction: row;
}

.battle__panel--side .lane {
  flex: 1 1 0;
}

.battle__panel--stack .lane + .lane {
  border-top: 1px solid var(--ov-sep);
}

.battle__panel--side .lane + .lane {
  border-left: 1px solid var(--ov-sep);
}

.battle__panel--fixed .lane {
  flex: 1 1 0;
  align-content: center;
}

/* ---- Lane ------------------------------------------------------------------- */

.lane {
  position: relative;
  display: grid;
  /* The tag column also holds 'DELANTE' when the caption is floored at 9 px (80 % text). */
  grid-template-columns: max(5em, calc(var(--ov-min-text) * 6.6)) minmax(0, 1fr);
  column-gap: 0.6em;
  row-gap: 0.25em;
  align-items: center;
  min-width: 0;
  padding: 0.5em 0.7em 0.55em calc(0.7em + var(--ov-bar-w));
  contain: layout paint style;
}

/*
 * The rail: the trend's state on the lane's left edge, full height, square and flush (always with
 * the chevron and the words, never colour alone). A rail means state, so a lane with no direction
 * yet (neutral, unknown) has none. Changes with the trend's sign only: no transition.
 */
.lane--good::before,
.lane--bad::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--ov-bar-w);
  background: var(--lane-tone);
}

.lane--good {
  --lane-tone: var(--ov-good);
}

.lane--bad {
  --lane-tone: var(--ov-bad);
}

/* Opponent in the pits: still there, but not the fight right now. */
.lane--pit {
  opacity: var(--ov-o-soft);
}

.lane__tag {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 0.3em;
  min-width: 0;
  overflow: hidden;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  line-height: 1.3;
  letter-spacing: var(--ov-track-caps);
  white-space: nowrap;
  color: var(--ov-fg-muted);
}

.lane__who {
  grid-column: 2;
  grid-row: 1;
}

.lane__who :deep(.ov-driver__name) {
  font-weight: var(--ov-w-strong);
}

/* ---- Headline: hero gap and trend --------------------------------------------- */

/* Face, size, weight and tracking from .ov-t-hero; the unit from .ov-unit (small and dim). */
.lane__gap {
  grid-column: 1;
  grid-row: 2;
  white-space: nowrap;
}

.lane__unit {
  margin-left: 0.08em;
  font-size: max(var(--ov-min-text), var(--ov-t-unit-hero));
}

.lane__trend {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  align-items: baseline;
  gap: 0.45em;
  min-width: 0;
  font-size: var(--ov-t-body);
  line-height: 1.3;
  white-space: nowrap;
}

.lane__trend-value {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.25em;
  font-weight: var(--ov-w-strong);
}

.lane__note {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-body);
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

.lane__stake {
  flex: none;
  margin-left: auto;
  font-size: var(--ov-t-body);
  color: var(--ov-fg-muted);
}

.lane__stake b {
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

.lane__preview {
  margin-left: auto;
}

.lane__stake + .lane__preview {
  margin-left: 0;
}

/* ---- Prediction ------------------------------------------------------------------ */

/* Always as tall as one line, also when blank: the lane never changes height. */
.lane__catch {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.45em;
  min-width: 0;
  min-height: 1.3em;
  font-size: var(--ov-t-body);
  line-height: 1.3;
  white-space: nowrap;
}

.lane__verdict {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 0.35em;
  min-width: 0;
  font-weight: var(--ov-w-strong);
}

.lane__verdict-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- Detail: delta chips ------------------------------------------------------------ */

.lane__chips {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.3em;
  min-width: 0;
}

.lane__chip {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
}

/* ---- Narrow windows: the name keeps its room ------------------------------------------ */

@container battle (max-width: 24em) {
  .lane__who :deep(.ov-driver__ir) {
    display: none;
  }
}

@container battle (max-width: 20em) {
  .lane__who :deep(.ov-lic),
  .lane__trend > .lane__note {
    display: none;
  }
}
</style>
