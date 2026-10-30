<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { brandMarksOn } from '@shared/carBrands'
import { isRaceSession } from '@shared/sessionInfo'
import type { InfoBarData, StandingsData } from '@shared/types'
import StatusMessage from '@renderer/components/StatusMessage.vue'
import { useAppearance } from '@renderer/composables/useAppearance'
import { useInfoBar } from '@renderer/composables/useInfoBar'
import { useContentHeight } from '@renderer/composables/useContentSize'
import { useElementSize } from '@renderer/composables/useElementSize'
import { useI18n } from '@renderer/composables/useI18n'
import { isLive, useAutoHidden, useOverlayState } from '@renderer/composables/useOverlay'
import { useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import {
  useAutoHeight,
  useDensity,
  useDriverBlock,
  useNameFormat,
  useOptions,
  useWidgetSettings
} from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { useWidgetTitle } from '@renderer/composables/useWidgetTitle'
import { injectPanelHost, useNoRoomReport } from '@renderer/composables/widgetContext'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import EmptyPreview from '@renderer/ui/EmptyPreview.vue'
import InfoBar from '@renderer/ui/InfoBar.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseViews } from '@renderer/view/reuse'
import { createDriverStyles, type InlineStyle } from '@renderer/view/styles'
import { barInfo } from './bars'
import { fitColumns, reuseColumns, withoutRoom, type ColumnPrefs, type Columns } from './columns'
import { reuseHeads, toHeadsView, type HeadsView } from './heads'
import {
  BOTTOM_PAD_EM,
  EMPTY_EM,
  HEADS_EM,
  STATUS_EM,
  TOP_PAD_EM,
  lineBudgetEm,
  lineMetrics,
  linesEm,
  panelHeightPx,
  planLines,
  type BarSize,
  type Chrome,
  type PlannedLine
} from './layout'
import { previewField, previewStandings } from './preview'
import StandingsCarCells from './StandingsCarCells.vue'
import StandingsClassCells from './StandingsClassCells.vue'
import StandingsHeads from './StandingsHeads.vue'
import { toLineViews, type LineContext, type LineView } from './view'

const ID = 'standings'
const NO_LINES: readonly LineView[] = Object.freeze([])
const NO_PLAN: readonly PlannedLine[] = Object.freeze([])
/** Fixed heights of layout.ts, so the CSS is exactly what the height maths assumes. */
const LAYOUT_VARS: InlineStyle = Object.freeze({
  '--sd-top-pad': `${TOP_PAD_EM}em`,
  '--sd-heads-h': `${HEADS_EM}em`,
  '--sd-bottom-pad': `${BOTTOM_PAD_EM}em`,
  '--sd-status-h': `${STATUS_EM}em`,
  '--sd-empty-h': `${EMPTY_EM}em`
})

const { data, phase } = useWidgetPhase(ID, {
  showsOffline: true,
  hasContent: (d) => d.classes.length > 0
})
const { status } = useOverlayState()
const autoHidden = useAutoHidden(ID)
const opts = useOptions(ID)
/** Makes, flags and penalty badges: the «Piloto» block (own or Apariencia's). */
const block = useDriverBlock(ID)
const prefs = useWidgetSettings(ID)
const appearance = useAppearance()
const nameFormat = useNameFormat(ID)
const density = useDensity(ID)
const autoHeight = useAutoHeight(ID)
const { halo, fontPx, surfaceStyle } = useWidgetSurface(ID)
const t = useI18n()
const title = useWidgetTitle(ID)
// Panel size: the width picks the columns, the height only trims rows when the content does
// not fit (auto height grows the panel first). A ResizeObserver: fires on resize only.
const root = useTemplateRef<HTMLElement>('root')
const size = useElementSize(root)

/** table: live or sample rows; status: offline; empty: connected, no rows yet; none: hidden. */
const body = computed<'table' | 'status' | 'empty' | 'none'>(() => {
  if (phase.value === 'live' || phase.value === 'preview') return 'table'
  if (phase.value === 'offline') return 'status'
  return isLive(status.value) && !autoHidden.value.hidden ? 'empty' : 'none'
})
const shown = computed(() => body.value !== 'none')

// Built only in edit mode without data, so the sample costs nothing while racing. The field is
// the one the settings page's last change needs (previewField; the default in the overlay).
const preview = computed(() => previewStandings(opts.value, previewField.value))
/** What is drawn; while hidden, what was drawn last (it stays put through the fade-out). */
const payload = computed<StandingsData | null>((prev) => {
  if (phase.value === 'live') return data.value
  if (phase.value === 'preview') return preview.value
  if (body.value === 'empty') return data.value
  return body.value === 'none' ? (prev ?? null) : null
})
const classes = computed(() => (body.value === 'status' ? null : (payload.value?.classes ?? null)))
const race = computed(() => isRaceSession(payload.value?.header.sessionType ?? null))

const isTable = computed(() => body.value === 'table' || body.value === 'none')

/**
 * The info bars' data (InfoFeed): the SoF and the car count left to the class lines while those
 * say them (bars.ts). One object per payload; each bar keeps its items while they read the same.
 */
const info = computed<InfoBarData | null>(() =>
  barInfo(payload.value?.info ?? null, classes.value, opts.value.classLine)
)
// The header (its session falls back to the widget's name, so it always has something) and its
// second line; the footer with the table only (not under the offline or waiting notes), and
// kept while hidden, like the lines.
const headBar = useInfoBar('standings', 'headerBar', () => info.value, {
  sessionFallback: () => title.value
})
const subBar = useInfoBar('standings', 'subheaderBar', () => info.value)
const footBar = useInfoBar('standings', 'footerBar', () => info.value)
const headShown = computed(() => headBar.shown.value)
const subShown = computed(() => subBar.shown.value)
const footed = computed(() => isTable.value && footBar.shown.value)
const isPreview = computed(() => phase.value === 'preview')
const headsShown = computed(() => opts.value.columnHeads && isTable.value)

/** What the height maths add around the lines; the same object while it is the same. */
const chrome = computed<Chrome>((prev) => {
  const head: BarSize[] = []
  if (headShown.value) head.push(headBar.size.value)
  if (subShown.value) head.push(subBar.size.value)
  const next: Chrome = {
    head,
    heads: headsShown.value,
    foot: footed.value ? footBar.size.value : null
  }
  return prev !== undefined &&
    prev.heads === next.heads &&
    prev.foot === next.foot &&
    prev.head.length === head.length &&
    prev.head.every((h, i) => h === head[i])
    ? prev
    : next
})

const metrics = computed(() => lineMetrics(density.value))
const planOpts = computed(() => ({ oneLineLeaders: opts.value.mode !== 'full' }))
/** Every line, untrimmed: what the content wants (the reported height). */
const fullPlan = computed<readonly PlannedLine[]>(() => {
  const c = classes.value
  return c === null || body.value === 'empty'
    ? NO_PLAN
    : planLines(c, planOpts.value, metrics.value)
})
const bodyEm = computed(() => {
  if (body.value === 'status') return STATUS_EM
  if (body.value === 'empty') return EMPTY_EM
  return linesEm(fullPlan.value, metrics.value)
})
const desiredPx = computed(() => panelHeightPx(bodyEm.value, chrome.value, fontPx.value))
useContentHeight(() => desiredPx.value, { enabled: () => autoHeight.value && shown.value })

/** The lines that fit the window: all of them unless the window is shorter than the content. */
const plan = computed<readonly PlannedLine[]>(() => {
  const full = fullPlan.value
  const budget = lineBudgetEm(size.value.h, fontPx.value, chrome.value)
  if (linesEm(full, metrics.value) <= budget + 1e-6 || classes.value === null) return full
  return planLines(classes.value, planOpts.value, metrics.value, budget)
})

// Before the first measurement: the panel's drawn width (the window is the whole display).
const panelHost = injectPanelHost()
const widthPx = computed(() =>
  size.value.w > 0 ? size.value.w : (panelHost?.size.value.width ?? 0)
)
/** The provider names no compound while the whole field runs the same one: no tyre column. */
const tyres = computed(() => (classes.value ?? []).some((c) => c.rows.some((r) => r.tyre !== null)))
const colPrefs = computed<ColumnPrefs>(() => ({
  columns: opts.value.columns,
  gapMode: opts.value.gapMode,
  iRatingDeltaAll: opts.value.iRatingDeltaAll,
  race: race.value,
  tyres: tyres.value,
  licenseStyle: appearance.value.licenseStyle,
  numberStyle: appearance.value.numberStyle,
  brand: brandMarksOn(block.value.brandMarks, payload.value?.multiBrand ?? false),
  flag: block.value.countryFlags
}))
const cols = computed<Columns>((prev) =>
  reuseColumns(prev, fitColumns(colPrefs.value, widthPx.value, fontPx.value))
)
// The settings preview's lists say which columns (and the mark, the flag) have no room here.
useNoRoomReport(() => {
  const out = withoutRoom(colPrefs.value, cols.value)
  return [
    ...out.columns.map((id) => `standings.columns.${id}`),
    ...(out.brand ? ['standings.driver.brandMarks'] : []),
    ...(out.flag ? ['standings.driver.countryFlags'] : [])
  ]
})
/** The column heads: one per drawn track, so they follow the order and the narrow fitting. */
const heads = computed<HeadsView>((prev) =>
  reuseHeads(
    prev,
    toHeadsView(
      cols.value,
      {
        gapMode: opts.value.gapMode,
        race: race.value,
        licenseStyle: appearance.value.licenseStyle
      },
      t.value
    )
  )
)

const styles = createDriverStyles()
const lineCtx = computed<LineContext>(() => ({
  gapMode: opts.value.gapMode,
  race: race.value,
  deltaAll: opts.value.iRatingDeltaAll,
  nameFormat: nameFormat.value,
  classLine: opts.value.classLine,
  showFlags: block.value.showFlags,
  gapLeaderShown: cols.value.cells.includes('gapLeader'),
  styles,
  m: t.value
}))
// Slots are keyed by index and an unchanged line keeps its object, so a 4 Hz payload that
// moves cars only rewrites the slots that changed: no DOM node is ever reordered.
const lines = computed<readonly LineView[]>((prev) =>
  isTable.value ? reuseViews(prev, toLineViews(plan.value, lineCtx.value)) : NO_LINES
)

const panelStyle = computed<InlineStyle>(() => ({
  ...surfaceStyle.value,
  ...LAYOUT_VARS,
  '--sd-cols': cols.value.template,
  '--sd-row-h': `${metrics.value.rowEm}em`,
  '--sd-cls-h': `${metrics.value.classEm}em`
}))
/** The window grows upwards: the panel hugs the bottom edge while the window waits to shrink. */
const bottomAnchored = computed(() => autoHeight.value && prefs.value.anchor === 'bottom')
</script>

<template>
  <div ref="root" class="ov-root sd-root" :class="{ 'is-bottom': bottomAnchored }">
    <WidgetPanel
      :surface="panelStyle"
      :halo="halo"
      class="sd-panel ov-fade"
      :class="{ 'is-shown': shown, 'has-foot': footed, 'no-head': chrome.head.length === 0 }"
    >
      <template #header>
        <InfoBar
          v-if="headShown"
          :view="headBar.view.value"
          :size="headBar.size.value"
          place="head"
          sim
          :preview="isPreview"
          zone="standings.headerBar"
        />
        <InfoBar
          v-if="subShown"
          :view="subBar.view.value"
          :size="subBar.size.value"
          place="head"
          :sim="!headShown"
          :preview="isPreview && !headShown"
          zone="standings.subheaderBar"
        />
        <StandingsHeads v-if="headsShown" :heads="heads" />
      </template>
      <div v-if="body === 'status'" class="sd-status"><StatusMessage /></div>
      <div v-else-if="body === 'empty'" class="sd-empty"><EmptyPreview :rows="3" /></div>
      <template v-else>
        <div
          v-for="(line, i) in lines"
          :key="i"
          v-memo="[line, cols.key]"
          v-inline-style="line.clsStyle"
          :class="line.css"
        >
          <StandingsClassCells v-if="line.kind === 'class'" :line="line" />
          <StandingsCarCells v-else :line="line" :cols="cols" />
        </div>
      </template>
      <InfoBar
        v-if="footed"
        :view="footBar.view.value"
        :size="footBar.size.value"
        place="foot"
        zone="standings.footerBar"
      />
    </WidgetPanel>
  </div>
</template>

<style scoped>
/* With the bottom edge anchored the panel hugs it while the window waits to shrink. */
.sd-root.is-bottom {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

/* As tall as its lines (never sized by the window), so the window can follow it. */
.sd-panel {
  flex: none;
  padding-bottom: var(--sd-bottom-pad);
}

/* The footer bar ends the panel: it takes the bottom padding's place (layout.ts). */
.sd-panel.has-foot {
  padding-bottom: 0;
}

/* Without a header bar the first line keeps a little room under the panel's top edge. */
.sd-panel.no-head {
  padding-top: var(--sd-top-pad);
}

.sd-status {
  flex: none;
  height: var(--sd-status-h);
  overflow: hidden;
}

.sd-empty {
  flex: none;
  height: var(--sd-empty-h);
  overflow: hidden;
}

/*
 * Fixed heights (layout.ts), never sized by content, so contain: strict is safe: a text change
 * re-lays out its own line only.
 */
.sd-line {
  position: relative;
  flex: none;
  contain: strict;
  overflow: hidden;
  white-space: nowrap;
}

/*
 * Car rows sit on the glass; alternate rows get the stripe band or, with stripes off, every row
 * a 1 px rule on top (--ov-row-rule). All of it is background paint, redrawn only with its row.
 */
.sd-car {
  display: grid;
  grid-template-columns: var(--sd-cols);
  align-items: center;
  column-gap: 0.4em;
  height: var(--sd-row-h);
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  background: var(--ov-bg-row);
}

.sd-car.is-alt {
  background: var(--ov-bg-row-alt);
}

.sd-car + .sd-car {
  box-shadow: inset 0 1px 0 var(--ov-row-rule);
}

/* Your bracket draws its own lines, and a skipped-rows line has its tick rule instead. */
.sd-car.ov-player,
.ov-player + .sd-car,
.sd-car.is-sep {
  box-shadow: none;
}

/* Rows were skipped above: a dotted tick rule along the top edge (inside the fixed height). */
.sd-car.is-sep {
  background:
    linear-gradient(90deg, var(--ov-tick-major) 0 2px, transparent 2px) left top / 5px 1px repeat-x,
    var(--ov-bg-row);
}

.sd-car.is-sep.is-alt {
  background:
    linear-gradient(90deg, var(--ov-tick-major) 0 2px, transparent 2px) left top / 5px 1px repeat-x,
    var(--ov-bg-row-alt);
}

/*
 * Class line: the header band with the class as a 2 px key along its bottom, fading to the right
 * (horizontal = identity; the class never goes on a rail). The key keeps its full colour at any
 * panel opacity, so the line still reads over a see-through panel.
 */
.sd-class {
  display: flex;
  align-items: center;
  gap: 0.5em;
  height: var(--sd-cls-h);
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  background:
    linear-gradient(90deg, var(--cls, var(--ov-fg-muted)), transparent 70%) left bottom / 100%
      var(--ov-key-w) no-repeat,
    var(--ov-bg-head);
}
</style>
