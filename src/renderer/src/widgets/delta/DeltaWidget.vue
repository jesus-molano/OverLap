<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { arrayEqual } from '@shared/equal'
import { OPTION_SCHEMA, clampOption, type NumericSpec } from '@shared/settingsSchema'
import type { DeltaReference, DeltaRowId } from '@shared/types'
import { useI18n } from '@renderer/composables/useI18n'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import { useOptions } from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import Chip from '@renderer/ui/Chip.vue'
import Icon from '@renderer/ui/Icon.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import type { Tone } from '@renderer/ui/tones'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView, reuseViews } from '@renderer/view/reuse'
import { orderStyle, placesOf } from '../orderStyle'
import { DELTA_REFERENCE_FIELD } from '@shared/delta/choice'
import { previewDelta, previewSession } from './preview'
import {
  REFERENCE_NOTE_MS,
  deltaRows,
  deltaTopParts,
  lapTimesView,
  refBarsView,
  referenceNote,
  type DeltaTopParts,
  type LapTimeView,
  type RefBarView,
  type ReferenceChoice
} from './rows'
import {
  barOverflow,
  barStep,
  createBarStyles,
  currentSector,
  deltaSign,
  deltaTone,
  formatDelta,
  lapCounts,
  liveSectorDelta,
  predictedText,
  refView,
  sectorChips,
  sectorDensity,
  stateView,
  trendKind,
  type RefView,
  type SectorChipView,
  type TrendKind
} from './view'

const ID = 'delta'
const RANGE: NumericSpec = OPTION_SCHEMA.delta.rangeS
const NO_SECTORS: readonly (number | null)[] = Object.freeze([])
const NO_REF: RefView = Object.freeze({ kind: 'pb', label: '', time: '' })

const options = useOptions(ID)
const t = useI18n()
const { surfaceStyle, halo } = useWidgetSurface(ID)

// Payloads come only when they change (SKIP_EMIT), so there is no freshness timer: a lost
// connection hides the bar through the phase, `visible: false` fades it out.
const { data, phase } = useWidgetPhase(ID, { showsOffline: false, hasContent: (d) => d.visible })

const preview = computed(() => phase.value === 'preview')
const shown = computed(() => phase.value === 'live' || phase.value === 'preview')
/** Live data, the sample in edit mode, or the last frame (frozen through the fade-out). */
const content = useShownContent(
  () => phase.value,
  () => data.value,
  // The race's reference, or the session's the settings page changed last (previewSession).
  () => previewDelta(options.value[DELTA_REFERENCE_FIELD[previewSession.value]])
)

// Display options, each kept while equal: another option or a drag re-renders nothing.
/** The rows in the user's order (delta.rows), the top line always. */
const rows = computed<readonly DeltaRowId[]>((prev) => {
  const next = deltaRows(options.value.rows)
  return prev !== undefined && arrayEqual(prev, next) ? prev : next
})
const top = computed<DeltaTopParts>((prev) => reuseView(prev, deltaTopParts(options.value.top)))
const showPredicted = computed(() => top.value.predicted)
const showReference = computed(() => top.value.reference)
const showTrend = computed(() => top.value.state)
/** Each row's place (CSS order: a reorder re-creates no row). */
const place = computed(() => placesOf(rows.value))
const showBar = computed(() => rows.value.includes('bar'))
const showSectors = computed(() => rows.value.includes('sectors'))
const showLaps = computed(() => rows.value.includes('laps'))
const rangeS = computed(() => clampOption(RANGE, options.value.rangeS))

// ---- 30 Hz path: primitives and shared frozen objects only ----------------------------
// Each computed keeps its value while equal, so a frame re-renders only what it changed: the
// hero text, the predicted lap and the bar's two transforms (patched by v-inline-style).

const delta = computed(() => content.value?.delta ?? null)
const deltaKnown = computed(() => delta.value !== null)
/** Every payload brings a new array: the previous one is kept while the values are equal. */
const sectors = computed<readonly (number | null)[]>((prev) => {
  const s = content.value?.sectors
  const next = Array.isArray(s) ? s : NO_SECTORS
  return prev !== undefined && arrayEqual(prev, next) ? prev : next
})
const lapState = computed(() => content.value?.lapState)
/** An invalid lap, the out lap or a tow won't count: the numbers step back. */
const counts = computed(() => lapCounts(lapState.value))

const heroText = computed(() => formatDelta(delta.value))
const sign = computed(() => deltaSign(delta.value))
const heroTone = computed<Tone>(() => deltaTone(delta.value))

const trend = computed<TrendKind>((prev) => trendKind(content.value?.trend ?? 0, prev))
// Frozen per language: the same object while the state and the language stay.
const state = computed(() => stateView(lapState.value, trend.value, showTrend.value, t.value))

const predicted = computed(() => predictedText(content.value?.predictedLap))
// Primitives first: the view object is only rebuilt when the reference (or the language)
// changes.
const refKind = computed(() => content.value?.reference ?? null)
const refDriver = computed(() => content.value?.refDriver ?? '')
const refSelf = computed(() => content.value?.refSelf === true)
const refLapTime = computed(() => content.value?.refLapTime ?? null)
/** The cycle shortcut's choice is in force (this session only): the reference says so. */
const temporary = computed(
  () => content.value?.temporary === true && content.value.pending === null
)
const reference = computed<RefView>((prev) => {
  const kind = refKind.value
  if (kind === null) return NO_REF
  return reuseView(
    prev,
    refView(
      {
        reference: kind,
        refDriver: refDriver.value,
        refSelf: refSelf.value,
        refLapTime: refLapTime.value
      },
      t.value
    )
  )
})

const barStyles = createBarStyles()
const bar = computed(() => barStyles(barStep(delta.value, rangeS.value)))
const barClass = computed(() => {
  const s = sign.value
  const over = barOverflow(delta.value, rangeS.value)
  const tone = s === -1 ? 'dl-bar--good' : s === 1 ? 'dl-bar--bad' : 'dl-bar--idle'
  return over === 0 ? tone : `${tone} dl-bar--over-${over < 0 ? 'left' : 'right'}`
})

const chips = computed<readonly SectorChipView[]>((prev) =>
  sectorChips(sectors.value, deltaKnown.value, t.value, prev)
)
const density = computed(() => sectorDensity(chips.value.length))
const current = computed(() => currentSector(sectors.value, deltaKnown.value))
const live = computed(() => liveSectorDelta(sectors.value, delta.value, current.value))
const liveText = computed(() => (live.value === null ? '' : formatDelta(live.value)))
const liveTone = computed<Tone>(() => deltaTone(live.value))

// ---- The lap times line and the reference label (only on a change of times or choice) ----

const laps = computed(() => content.value?.laps ?? null)
const lapTimes = computed<readonly LapTimeView[]>((prev) =>
  reuseViews(prev, [...lapTimesView(laps.value, options.value.laps, refKind.value, t.value)])
)

// ---- The bars per reference: the list on a change of choice, each bar on a change of its value
/** The bars in the user's order, the reference in use marked. */
const refBars = computed<readonly RefBarView[]>((prev) =>
  reuseViews(prev, [...refBarsView(options.value.refBars, refKind.value, t.value)])
)
/** The row with no reference shown draws nothing, and sizes nothing. */
const showRefs = computed(() => rows.value.includes('refs') && refBars.value.length > 0)
/** A bar's delta ('—' and an empty bar while its reference has no lap yet). */
const barValue = (id: DeltaReference): number | null => content.value?.bars?.[id] ?? null
const refBarStyles = (v: number | null): ReturnType<typeof barStyles> =>
  barStyles(barStep(v, rangeS.value))
/** As the main bar's: the tone of the sign, the end hatched beyond the scale. */
function refBarClass(v: number | null): string {
  const s = deltaSign(v)
  const over = barOverflow(v, rangeS.value)
  const tone = s === -1 ? 'dl-bar--good' : s === 1 ? 'dl-bar--bad' : 'dl-bar--idle'
  return over === 0 ? tone : `${tone} dl-bar--over-${over < 0 ? 'left' : 'right'}`
}

/** Brief label after another reference is chosen (or takes over), live only. */
const note = shallowRef('')
let noteTimer: ReturnType<typeof setTimeout> | undefined
const choice = computed<ReferenceChoice>((prev) =>
  reuseView(prev, {
    preferred: content.value?.preferred ?? null,
    pending: content.value?.pending ?? null,
    temporary: content.value?.temporary === true
  })
)
watch(choice, (next, prev) => {
  if (phase.value !== 'live') return
  const text = referenceNote(prev, next, t.value)
  if (text === null) return
  clearTimeout(noteTimer)
  note.value = text
  if (text !== '') noteTimer = setTimeout(() => (note.value = ''), REFERENCE_NOTE_MS)
})
watch(phase, (p) => {
  if (p === 'live') return
  clearTimeout(noteTimer)
  note.value = ''
})
onBeforeUnmount(() => clearTimeout(noteTimer))

// The panel's tint follows the sign of the delta: these classes change on a sign flip only. The
// rows and parts shown size the font (--dl-fit-h / --dl-fit-w, see the styles).
const rootClass = computed(() => ({
  'is-shown': shown.value,
  'dl--bar': showBar.value,
  'dl--sectors': showSectors.value,
  'dl--laps': showLaps.value,
  [`dl--laps-${lapTimes.value.length}`]: showLaps.value,
  'dl--refs': showRefs.value,
  [`dl--refs-${refBars.value.length}`]: showRefs.value,
  'dl--trend': showTrend.value,
  'dl--noinfo': !showPredicted.value && !showReference.value,
  'dl--invalid': !counts.value,
  'dl--good': heroTone.value === 'good',
  'dl--bad': heroTone.value === 'bad'
}))
</script>

<template>
  <div class="delta ov-root ov-fade" :class="rootClass">
    <WidgetPanel class="dl-panel" :surface="surfaceStyle" :halo="halo" fill>
      <div v-inline-style="orderStyle(place.top ?? 0)" class="dl-top" data-el="delta.rows.top">
        <div class="dl-hero" :class="`ov-tone-${heroTone}`">
          <!-- The sign as a shape too: ▼ faster, ▲ slower (colour-blind safe). -->
          <span class="dl-hero__sym">
            <Icon v-if="sign === -1" name="arrow-down" />
            <Icon v-else-if="sign === 1" name="arrow-up" />
          </span>
          <span class="dl-hero__num ov-t-hero">{{ heroText }}</span>
        </div>

        <!-- For a moment after another reference is chosen: what the delta will compare with. -->
        <p v-if="note !== ''" class="dl-note" role="status">
          <span class="dl-note__mark" aria-hidden="true">{{ t.widgets.delta.refMark }}</span>
          <span class="dl-note__text">{{ note }}</span>
        </p>
        <template v-else>
          <div class="dl-state" data-el="delta.top.state">
            <span
              v-if="state.kind !== 'none'"
              class="dl-state__line"
              :class="`ov-tone-${state.tone}`"
            >
              <Icon v-if="state.icon !== null" :name="state.icon" />
              <!-- Chevrons point where the bar is heading: left gaining, right losing. -->
              <svg
                v-else
                class="ov-icon dl-chev"
                :class="{ 'dl-chev--right': state.kind === 'loss' }"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path class="ov-icon__stroke" d="M8.5 3.5 4 8l4.5 4.5M13 3.5 8.5 8l4.5 4.5" />
              </svg>
              <span class="dl-state__text">{{ state.text }}</span>
            </span>
            <PreviewTag v-if="preview" class="dl-state__tag" />
          </div>

          <div v-if="showPredicted || showReference" class="dl-info">
            <div v-if="showPredicted" class="dl-pred" data-el="delta.top.predicted">
              <span class="dl-pred__label">{{ t.widgets.delta.predicted }}</span>
              <span class="dl-pred__time">{{ predicted }}</span>
            </div>
            <div v-if="showReference" class="dl-ref" data-el="delta.top.reference">
              <span class="dl-ref__dot" :class="`dl-ref__dot--${reference.kind}`" />
              <span class="dl-ref__label">{{ reference.label }}</span>
              <!-- The cycle shortcut's choice: this session only, never saved. -->
              <span v-if="temporary" class="dl-ref__temp">{{ t.widgets.delta.temporary }}</span>
              <span class="dl-ref__time">{{ reference.time }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- Static track; a frame moves only the fill (scaleX) and the needle (translateX). -->
      <div
        v-if="showBar"
        v-inline-style="orderStyle(place.bar ?? 0)"
        class="dl-bar"
        :class="barClass"
        data-el="delta.rows.bar"
        aria-hidden="true"
      >
        <span v-inline-style="bar.fill" class="dl-bar__fill" />
        <span class="dl-bar__zero" />
        <span v-inline-style="bar.tip" class="dl-bar__tip" />
        <span class="dl-bar__cap dl-bar__cap--left" />
        <span class="dl-bar__cap dl-bar__cap--right" />
      </div>

      <!-- One bar per reference, on the main bar's scale; the delta's own is tagged. A bar
           re-renders only when its value (or the scale) changes. -->
      <div
        v-if="showRefs"
        v-inline-style="orderStyle(place.refs ?? 0)"
        class="dl-refs"
        data-el="delta.rows.refs"
      >
        <div
          v-for="b in refBars"
          :key="b.id"
          v-memo="[b, barValue(b.id), rangeS]"
          class="dl-rb"
          :class="{ 'dl-rb--ref': b.isRef }"
          :data-el="`delta.refBars.${b.id}`"
        >
          <span class="dl-rb__cap" :title="b.name">{{ b.caption }}</span>
          <span
            v-if="b.isRef"
            class="dl-lap__mark dl-rb__mark"
            role="img"
            :aria-label="t.widgets.delta.refMarkName"
            >{{ t.widgets.delta.refMark }}</span
          >
          <span class="dl-bar dl-rb__bar" :class="refBarClass(barValue(b.id))" aria-hidden="true">
            <span v-inline-style="refBarStyles(barValue(b.id)).fill" class="dl-bar__fill" />
            <span class="dl-bar__zero" />
            <span class="dl-bar__cap dl-bar__cap--left" />
            <span class="dl-bar__cap dl-bar__cap--right" />
          </span>
          <span class="dl-rb__val" :class="`ov-tone-${deltaTone(barValue(b.id))}`">{{
            formatDelta(barValue(b.id))
          }}</span>
        </div>
      </div>

      <!-- Your times side by side; the one the delta compares with is underlined and tagged. -->
      <div
        v-if="showLaps"
        v-inline-style="orderStyle(place.laps ?? 0)"
        class="dl-laps"
        data-el="delta.rows.laps"
      >
        <span
          v-for="l in lapTimes"
          :key="l.id"
          class="dl-lap"
          :class="{ 'dl-lap--ref': l.isRef }"
          :data-el="`delta.laps.${l.id}`"
        >
          <span class="dl-lap__cap">{{ l.caption }}</span>
          <span class="dl-lap__time">{{ l.time }}</span>
          <span
            v-if="l.isRef"
            class="dl-lap__mark"
            role="img"
            :aria-label="t.widgets.delta.refMarkName"
            >{{ t.widgets.delta.refMark }}</span
          >
        </span>
      </div>

      <div
        v-if="showSectors"
        v-inline-style="orderStyle(place.sectors ?? 0)"
        class="dl-sectors"
        :class="`dl-sectors--${density}`"
        data-el="delta.rows.sectors"
      >
        <span
          v-for="c in chips"
          :key="c.label"
          v-memo="[c, c.state === 'current' ? liveText : '', c.state === 'current' ? liveTone : '']"
          class="dl-sector"
        >
          <Chip
            class="dl-chip"
            :class="[`dl-chip--${c.state}`, { 'dl-chip--live': c.state === 'current' && liveText }]"
            :label="c.label"
            :tone="c.state === 'current' ? liveTone : c.tone"
            :variant="c.state === 'current' ? 'outline' : 'soft'"
            >{{ c.state === 'current' ? liveText : c.text }}</Chip
          >
        </span>
      </div>
    </WidgetPanel>
  </div>
</template>

<style scoped>
/*
 * Free size: the window is the container and the text is fitted to it. --dl-fit-h / --dl-fit-w
 * are the em height of the rows shown and the em width of the top line, so everything fits
 * whatever the window; narrow or short windows drop parts (see the end) instead of shrinking
 * the hero below legibility.
 */
.delta {
  container: delta / size;
}

.dl-panel {
  /* Em each row shown adds (rows.ts DELTA_ROW_FIT_EM, DELTA_FIT_TOP_EM for the top line). */
  --dl-h-bar: 0;
  --dl-h-refs: 0;
  --dl-h-sectors: 0;
  --dl-h-laps: 0;
  /* Em width of the top line (hero and info, plus the trend caption) and of the lap times. */
  --dl-w-info: 20;
  --dl-w-trend: 0;
  --dl-w-laps: 0;
  --dl-w-refs: 0;
  --dl-fit-h: calc(
    3.35 + var(--dl-h-bar) + var(--dl-h-refs) + var(--dl-h-sectors) + var(--dl-h-laps)
  );
  --dl-fit-w: max(var(--dl-w-info) + var(--dl-w-trend), var(--dl-w-laps), var(--dl-w-refs));
  justify-content: center;
  gap: 0.35em;
  padding: 0.4em 0.6em;
  font-size: clamp(
    var(--ov-min-text),
    min(100cqh / var(--dl-fit-h), 100cqw / var(--dl-fit-w)),
    40px
  );
  line-height: 1.2;
}

.dl--bar .dl-panel {
  --dl-h-bar: 0.95;
}

.dl--sectors .dl-panel {
  --dl-h-sectors: 1.7;
}

/* rows.ts refBarsFitEm: 0.15 + 1.35 per bar; DELTA_REF_BARS_FIT_W wide at least. */
.dl--refs .dl-panel {
  --dl-w-refs: 14;
}

.dl--refs-1 .dl-panel {
  --dl-h-refs: 1.5;
}

.dl--refs-2 .dl-panel {
  --dl-h-refs: 2.85;
}

.dl--refs-3 .dl-panel {
  --dl-h-refs: 4.2;
}

.dl--refs-4 .dl-panel {
  --dl-h-refs: 5.55;
}

.dl--refs-5 .dl-panel {
  --dl-h-refs: 6.9;
}

.dl--laps .dl-panel {
  --dl-h-laps: 1.7;
}

.dl--trend .dl-panel {
  --dl-w-trend: 6;
}

/* Hero (and trend) alone: no predicted lap nor reference. */
.dl--noinfo .dl-panel {
  --dl-w-info: 11.5;
}

/* DELTA_LAP_FIT_EM per time, plus the padding. */
.dl--laps-1 .dl-panel {
  --dl-w-laps: 8;
}

.dl--laps-2 .dl-panel {
  --dl-w-laps: 15;
}

.dl--laps-3 .dl-panel {
  --dl-w-laps: 22;
}

.dl--laps-4 .dl-panel {
  --dl-w-laps: 29;
}

/* ---- Top line: hero, state, predicted lap and reference ------------------------------- */

.dl-top {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.6em;
  min-width: 0;
  height: 2.2em;
}

.dl-hero {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.15em;
}

.dl-hero__sym {
  /* Centred on the figures, not on their line box (the digits sit low in it). */
  position: relative;
  top: 0.12em;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  font-size: 1.15em;
}

/* Fixed box (five characters at most, see formatDelta): a new value re-lays out only itself. */
.dl-hero__num {
  width: 2.7em;
  height: 1em;
  contain: strict;
  overflow: hidden;
  white-space: nowrap;
}

.dl-state {
  display: flex;
  /* Gives way first: the predicted lap matters more than the caption. */
  flex: 0 100 auto;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.2em;
  min-width: 0;
  overflow: hidden;
}

.dl-state__line {
  display: flex;
  align-items: center;
  gap: 0.35em;
  /* 'PERDIENDO' on one line; 'VUELTA INVÁLIDA' wraps into two. */
  max-width: 9em;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.dl-state__line .ov-icon {
  font-size: 1.25em;
}

.dl-chev--right {
  transform: scaleX(-1);
}

.dl-state__text {
  min-width: 0;
}

.dl-info {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 0.15em;
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
}

/* Centred, not baseline: the time is a contain: strict box, whose baseline is synthesized at its
   bottom edge, so a baseline row drops the label below the figures. */
.dl-pred {
  display: flex;
  align-items: center;
  gap: 0.35em;
  white-space: nowrap;
}

.dl-pred__label {
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--ov-fg-dim);
}

/* Fixed box: the 30 Hz predicted time re-lays out only itself. A lead number. */
.dl-pred__time {
  width: 3.95em;
  height: 1.2em;
  contain: strict;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
  text-align: right;
}

.dl-ref {
  display: flex;
  align-items: center;
  gap: 0.35em;
  max-width: 100%;
  min-width: 0;
  font-size: var(--ov-t-secondary);
  color: var(--ov-fg-muted);
  white-space: nowrap;
}

/* Whose lap it is, as a square marker: yours (accent) or your class's (best). */
.dl-ref__dot {
  flex: none;
  width: 0.5em;
  height: 0.5em;
  border-radius: 1px;
  background: var(--ov-accent);
}

.dl-ref__dot--class,
.dl-ref__dot--classOptimal {
  background: var(--ov-best);
}

.dl-ref__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* An outlined tag (a shape, not colour alone): the reference is for this session only. */
.dl-ref__temp {
  flex: none;
  padding: 0 0.3em;
  border: 1px solid var(--ov-accent);
  border-radius: 2px;
  font-size: 0.85em;
  line-height: 1.25;
  color: var(--ov-fg);
}

.dl-ref__time {
  flex: none;
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

/* A lap that won't count (invalid, the out lap, a tow): its numbers step back, the state says
   why. */
.dl--invalid .dl-hero,
.dl--invalid .dl-pred {
  opacity: var(--ov-o-dim);
}

/* The brief label after another reference is chosen: in place of the state and the info. */
.dl-note {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 0.4em;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: var(--ov-t-secondary);
  line-height: 1.2;
  color: var(--ov-fg);
}

.dl-note__mark {
  flex: none;
  padding: 0 0.3em;
  border-radius: var(--ov-radius-chip);
  box-shadow: inset 0 0 0 1px var(--ov-accent);
  font-family: var(--ov-font-small);
  font-weight: var(--ov-w-strong);
  color: var(--ov-accent);
}

.dl-note__text {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* ---- Lap times ------------------------------------------------------------------------- */

/* Equal cells sized by the row (a new time re-lays out its cell only): caption, time, and on
   the reference's the 'Δ' tag and an accent underline (a shape, not colour alone). */
.dl-laps {
  display: grid;
  flex: none;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: 0.6em;
  height: 1.25em;
  min-width: 0;
}

.dl-lap {
  display: flex;
  align-items: center;
  gap: 0.3em;
  min-width: 0;
  contain: strict;
  overflow: hidden;
  white-space: nowrap;
}

.dl-lap__cap {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  color: var(--ov-fg-dim);
}

.dl-lap__time {
  flex: none;
  padding-bottom: 0.08em;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-secondary);
  font-weight: var(--ov-w-strong);
  font-variant-numeric: tabular-nums;
  color: var(--ov-fg-muted);
}

.dl-lap--ref .dl-lap__time {
  color: var(--ov-fg);
  box-shadow: inset 0 -0.12em 0 var(--ov-accent);
}

.dl-lap__mark {
  flex: none;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  color: var(--ov-accent);
}

/* ---- Bar ------------------------------------------------------------------------------ */

/* A recessed well graduated like a gauge: majors at half scale, minors every quarter of each
   side (eighths of the bar, so every major also falls on a minor and the spacing stays even;
   each tick centred on its mark, the two ends alike), its top edge in a 1 px inner shade.
   Painted once; a frame moves only the fill and the needle. */
.dl-bar {
  --dl-tone: var(--ov-fg-muted);
  position: relative;
  flex: none;
  height: 0.6em;
  contain: strict;
  overflow: hidden;
  border-radius: var(--ov-radius-chip);
  box-shadow: inset 0 1px 0 rgba(0, 0, 0, 0.35);
  background:
    linear-gradient(
      90deg,
      transparent calc(25% - 0.5px),
      var(--ov-tick-major) calc(25% - 0.5px) calc(25% + 0.5px),
      transparent calc(25% + 0.5px) calc(75% - 0.5px),
      var(--ov-tick-major) calc(75% - 0.5px) calc(75% + 0.5px),
      transparent calc(75% + 0.5px)
    ),
    repeating-linear-gradient(
      90deg,
      var(--ov-tick) 0 0.5px,
      transparent 0.5px calc(12.5% - 0.5px),
      var(--ov-tick) calc(12.5% - 0.5px) 12.5%
    ),
    var(--ov-well);
}

.dl-bar--good {
  --dl-tone: var(--ov-good);
}

.dl-bar--bad {
  --dl-tone: var(--ov-bad);
}

/* From zero to the delta: brightest at the end. scaleX(-k) mirrors it to the left. */
.dl-bar__fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 50%;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--dl-tone) 30%, transparent),
    var(--dl-tone)
  );
  transform: scaleX(0);
  transform-origin: left center;
}

.dl-bar__zero {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(50% - 1px);
  width: 2px;
  background: var(--ov-fg-muted);
}

/* A track-wide layer whose centre line is the needle: translateX(±50 %) reaches each end. */
.dl-bar__tip {
  position: absolute;
  inset: 0;
  transform: translateX(0);
}

/* The needle, with a dark keyline (no blur) so it reads over the fill and the ticks. */
.dl-bar__tip::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(50% - 1px);
  width: 2px;
  background: var(--ov-fg);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55);
}

.dl-bar--idle .dl-bar__fill,
.dl-bar--idle .dl-bar__tip {
  opacity: 0;
}

.dl--invalid .dl-bar__fill {
  opacity: var(--ov-o-dim);
}

/* Beyond the scale: hatched end in the tone (the bar is full). */
.dl-bar__cap {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0.6em;
  background: repeating-linear-gradient(90deg, var(--ov-fg) 0 2px, transparent 2px 4px);
  opacity: 0;
}

.dl-bar__cap--left {
  left: 0;
}

.dl-bar__cap--right {
  right: 0;
}

.dl-bar--over-left .dl-bar__cap--left,
.dl-bar--over-right .dl-bar__cap--right {
  opacity: 1;
}

/* ---- Bars per reference ----------------------------------------------------------------- */

/* One line per reference: its caption, a slimmer copy of the bar (same well, ticks, tones and
   hatched ends; no needle) and its value in a fixed box, so a new value re-lays out itself only. */
.dl-refs {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 0.2em;
  min-width: 0;
}

.dl-rb {
  display: grid;
  grid-template-columns: 4.6em auto minmax(0, 1fr) 3em;
  align-items: center;
  column-gap: 0.4em;
  height: 1.15em;
  min-width: 0;
}

.dl-rb__cap {
  grid-column: 1;
  min-width: 0;
  overflow: hidden;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--ov-fg-dim);
}

.dl-rb--ref .dl-rb__cap {
  color: var(--ov-fg);
}

.dl-rb__mark {
  grid-column: 2;
}

.dl-rb__bar {
  grid-column: 3;
  height: 0.45em;
}

.dl-rb__val {
  grid-column: 4;
  height: 1.15em;
  contain: strict;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-secondary);
  font-weight: var(--ov-w-strong);
  font-variant-numeric: tabular-nums;
  line-height: 1.15em;
  text-align: right;
  white-space: nowrap;
}

/* ---- Sectors -------------------------------------------------------------------------- */

/*
 * Equal cells sized by the row, never by their text: a cell change re-lays out itself only.
 * Neutral recessed cells keyed in their tone (ui/Chip.vue); the current sector adds the neutral
 * ring, keyed in the live tone; the sectors still ahead are empty wells with a fainter label.
 */
.dl-sectors {
  display: grid;
  flex: none;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  grid-template-rows: minmax(0, 1fr);
  gap: 0.3em;
  height: 1.25em;
  min-width: 0;
}

.dl-sector {
  display: flex;
  min-width: 0;
  contain: strict;
}

.dl-chip {
  flex: 1 1 auto;
  align-items: center;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

/* Sectors still ahead: empty wells (kept at full depth, so they read as slots waiting, not as
   disabled) with a fainter label. A colour, not an opacity group. */
.dl-chip--ahead :deep(.ov-chip__label) {
  color: color-mix(in srgb, var(--ov-fg-dim) 65%, transparent);
}

/* Crowded rows: cells with a value drop their label (position says which); the rest keep it. */
.dl-sectors--compact .dl-chip--done :deep(.ov-chip__label),
.dl-sectors--tight .dl-chip--done :deep(.ov-chip__label),
.dl-sectors--compact .dl-chip--live :deep(.ov-chip__label),
.dl-sectors--tight .dl-chip--live :deep(.ov-chip__label) {
  display: none;
}

.dl-sectors--tight .dl-chip {
  padding-inline: 0.15em;
}

/* ---- Small windows: parts go, the hero keeps its size ---------------------------------- */

@container delta (max-height: 62px) {
  .dl-sectors,
  .dl-laps,
  .dl-refs {
    display: none;
  }

  .dl--sectors .dl-panel,
  .dl--laps .dl-panel,
  .dl--refs .dl-panel {
    --dl-h-sectors: 0;
    --dl-h-laps: 0;
    --dl-h-refs: 0;
  }
}

@container delta (max-width: 300px) {
  .dl-state__text,
  .dl-state__tag {
    display: none;
  }

  .dl--trend .dl-panel {
    --dl-w-trend: 1.5;
  }
}

/* The hero first: the lap times lose their captions (the tag still marks the reference). */
@container delta (max-width: 220px) {
  .dl-info,
  .dl-note,
  .dl-lap__cap {
    display: none;
  }

  /* The bars keep a short caption column. */
  .dl-rb {
    grid-template-columns: 3em auto minmax(0, 1fr) 3em;
  }

  .dl-top {
    justify-content: center;
  }

  .dl-panel,
  .dl--trend .dl-panel,
  .dl--noinfo .dl-panel,
  [class*='dl--laps-'] .dl-panel,
  .dl--refs .dl-panel {
    --dl-w-info: 11.5;
    --dl-w-trend: 0;
    --dl-w-laps: 0;
    --dl-w-refs: 0;
  }
}
</style>
