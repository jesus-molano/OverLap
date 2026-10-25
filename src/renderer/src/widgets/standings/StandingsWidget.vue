<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { isRaceSession } from '@shared/sessionInfo'
import type { StandingsData } from '@shared/types'
import StatusMessage from '@renderer/components/StatusMessage.vue'
import { useAppearance } from '@renderer/composables/useAppearance'
import { useContentHeight } from '@renderer/composables/useContentSize'
import { useElementSize } from '@renderer/composables/useElementSize'
import { useI18n } from '@renderer/composables/useI18n'
import { isLive, useOverlayState } from '@renderer/composables/useOverlay'
import { useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import {
  useAutoHeight,
  useDensity,
  useNameFormat,
  useOptions,
  useWidgetSettings
} from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { useWidgetTitle } from '@renderer/composables/useWidgetTitle'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import EmptyPreview from '@renderer/ui/EmptyPreview.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView, reuseViews } from '@renderer/view/reuse'
import { createDriverStyles, type InlineStyle } from '@renderer/view/styles'
import { fitColumns, reuseColumns, rowWidthEm, type Columns } from './columns'
import { headerTier, toHeaderView, type HeaderView } from './headerView'
import {
  BOTTOM_PAD_EM,
  EMPTY_EM,
  HEAD_LINE1_EM,
  HEAD_LINE2_EM,
  HEAD_PAD_EM,
  STATUS_EM,
  lineBudgetEm,
  lineMetrics,
  linesEm,
  panelHeightPx,
  planLines,
  type PlannedLine
} from './layout'
import { previewStandings } from './preview'
import StandingsCarCells from './StandingsCarCells.vue'
import StandingsClassCells from './StandingsClassCells.vue'
import StandingsHeader from './StandingsHeader.vue'
import { toLineViews, type LineContext, type LineView } from './view'

const ID = 'standings'
const NO_LINES: readonly LineView[] = Object.freeze([])
const NO_PLAN: readonly PlannedLine[] = Object.freeze([])
/** Fixed heights of layout.ts, so the CSS is exactly what the height maths assumes. */
const LAYOUT_VARS: InlineStyle = Object.freeze({
  '--sd-head-pad': `${HEAD_PAD_EM}em`,
  '--sd-head-l1': `${HEAD_LINE1_EM}em`,
  '--sd-head-l2': `${HEAD_LINE2_EM}em`,
  '--sd-bottom-pad': `${BOTTOM_PAD_EM}em`,
  '--sd-status-h': `${STATUS_EM}em`,
  '--sd-empty-h': `${EMPTY_EM}em`
})

const { data, phase } = useWidgetPhase(ID, {
  showsOffline: true,
  hasContent: (d) => d.classes.length > 0
})
const { status, autoHidden } = useOverlayState()
const opts = useOptions(ID)
const prefs = useWidgetSettings(ID)
const appearance = useAppearance()
const nameFormat = useNameFormat(ID)
const density = useDensity(ID)
const autoHeight = useAutoHeight(ID)
const { halo, fontPx, surfaceStyle } = useWidgetSurface(ID)
const t = useI18n()
const title = useWidgetTitle(ID)
// Window size: the width picks the columns, the height only trims rows when the content does
// not fit (auto height grows the window first). A ResizeObserver: fires on resize only.
const root = useTemplateRef<HTMLElement>('root')
const size = useElementSize(root)

/** table: live or sample rows; status: offline; empty: connected, no rows yet; none: hidden. */
const body = computed<'table' | 'status' | 'empty' | 'none'>(() => {
  if (phase.value === 'live' || phase.value === 'preview') return 'table'
  if (phase.value === 'offline') return 'status'
  return isLive(status.value) && !autoHidden.value.hidden ? 'empty' : 'none'
})
const shown = computed(() => body.value !== 'none')

// Built only in edit mode without data, so the sample costs nothing while racing.
const preview = computed(() => previewStandings(opts.value))
/** What is drawn; while hidden, what was drawn last (it stays put through the fade-out). */
const payload = computed<StandingsData | null>((prev) => {
  if (phase.value === 'live') return data.value
  if (phase.value === 'preview') return preview.value
  if (body.value === 'empty') return data.value
  return body.value === 'none' ? (prev ?? null) : null
})
const classes = computed(() => (body.value === 'status' ? null : (payload.value?.classes ?? null)))
const race = computed(() => isRaceSession(payload.value?.header.sessionType ?? null))

const head = computed<HeaderView>((prev) =>
  reuseView(
    prev,
    toHeaderView({
      header: payload.value?.header ?? null,
      classes: classes.value,
      race: race.value,
      showIRating: opts.value.headerIRating,
      showSafetyRating: opts.value.headerSafetyRating,
      showSof: opts.value.showSof,
      showCarCount: opts.value.showCarCount,
      preview: phase.value === 'preview',
      title: title.value,
      m: t.value
    })
  )
)
const headLines = computed(() => head.value.lines)

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
const desiredPx = computed(() => panelHeightPx(bodyEm.value, headLines.value, fontPx.value))
useContentHeight(() => desiredPx.value, { enabled: () => autoHeight.value && shown.value })

/** The lines that fit the window: all of them unless the window is shorter than the content. */
const plan = computed<readonly PlannedLine[]>(() => {
  const full = fullPlan.value
  const budget = lineBudgetEm(size.value.h, fontPx.value, headLines.value)
  if (linesEm(full, metrics.value) <= budget + 1e-6 || classes.value === null) return full
  return planLines(classes.value, planOpts.value, metrics.value, budget)
})

const widthPx = computed(() => (size.value.w > 0 ? size.value.w : window.innerWidth))
const cols = computed<Columns>((prev) =>
  reuseColumns(
    prev,
    fitColumns(
      {
        columns: opts.value.columns,
        gapMode: opts.value.gapMode,
        iRatingDeltaAll: opts.value.iRatingDeltaAll,
        race: race.value,
        licenseStyle: appearance.value.licenseStyle,
        numberStyle: appearance.value.numberStyle
      },
      widthPx.value,
      fontPx.value
    )
  )
)
// From the live width: cols keeps its previous object while the columns stay the same.
const tier = computed(() => headerTier(rowWidthEm(widthPx.value, fontPx.value)))

const styles = createDriverStyles()
const lineCtx = computed<LineContext>(() => ({
  gapMode: opts.value.gapMode,
  race: race.value,
  deltaAll: opts.value.iRatingDeltaAll,
  nameFormat: nameFormat.value,
  showSof: opts.value.showSof,
  showCarCount: opts.value.showCarCount,
  styles,
  m: t.value
}))
// Slots are keyed by index and an unchanged line keeps its object, so a 4 Hz payload that
// moves cars only rewrites the slots that changed: no DOM node is ever reordered.
const lines = computed<readonly LineView[]>((prev) =>
  body.value === 'table' || body.value === 'none'
    ? reuseViews(prev, toLineViews(plan.value, lineCtx.value))
    : NO_LINES
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
      :class="{ 'is-shown': shown }"
    >
      <template #header>
        <StandingsHeader :head="head" :tier="tier" />
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

/* Rows were skipped above. */
.sd-car.is-sep {
  border-top: 1px dashed var(--ov-sep);
}

.sd-class {
  display: flex;
  align-items: center;
  gap: 0.5em;
  height: var(--sd-cls-h);
  padding: 0 0.7em 0 0.35em;
}

/*
 * Static class tint that fades with the panel, behind the cells (the line is a stacking context:
 * contain: strict), so the multi-root cells need no positioning of their own.
 */
.sd-class::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--cls, #ffffff) 22%, transparent),
    transparent 70%
  );
  opacity: var(--ov-bg-alpha);
}
</style>
