<script setup lang="ts">
import { computed } from 'vue'
import { arrayEqual } from '@shared/equal'
import { OPTION_SCHEMA, clampOption, type NumericSpec } from '@shared/settingsSchema'
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
import { reuseView } from '@renderer/view/reuse'
import { previewDelta } from './preview'
import {
  barOverflow,
  barStep,
  createBarStyles,
  currentSector,
  deltaSign,
  deltaTone,
  formatDelta,
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
  () => previewDelta(options.value.reference)
)

// Display options, one primitive each: another option or a drag re-renders nothing.
const showPredicted = computed(() => options.value.showPredicted)
const showSectors = computed(() => options.value.showSectors)
const showTrend = computed(() => options.value.showTrend)
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
const valid = computed(() => content.value?.lapValid !== false)

const heroText = computed(() => formatDelta(delta.value))
const sign = computed(() => deltaSign(delta.value))
const heroTone = computed<Tone>(() => deltaTone(delta.value))

const trend = computed<TrendKind>((prev) => trendKind(content.value?.trend ?? 0, prev))
// Frozen per language: the same object while the state and the language stay.
const state = computed(() => stateView(valid.value, trend.value, showTrend.value, t.value))

const predicted = computed(() => predictedText(content.value?.predictedLap))
// Primitives first: the view object is only rebuilt when the reference (or the language)
// changes.
const refKind = computed(() => content.value?.reference ?? null)
const refDriver = computed(() => content.value?.refDriver ?? '')
const refSelf = computed(() => content.value?.refSelf === true)
const refLapTime = computed(() => content.value?.refLapTime ?? null)
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

// The panel's rail follows the sign of the delta: these classes change on a sign flip only.
const rootClass = computed(() => ({
  'is-shown': shown.value,
  'dl--sectors': showSectors.value,
  'dl--trend': showTrend.value,
  'dl--invalid': !valid.value,
  'dl--good': heroTone.value === 'good',
  'dl--bad': heroTone.value === 'bad'
}))
</script>

<template>
  <div class="delta ov-root ov-fade" :class="rootClass">
    <WidgetPanel class="dl-panel" :surface="surfaceStyle" :halo="halo" fill>
      <div class="dl-top">
        <div class="dl-hero" :class="`ov-tone-${heroTone}`">
          <!-- The sign as a shape too: ▼ faster, ▲ slower (colour-blind safe). -->
          <span class="dl-hero__sym">
            <Icon v-if="sign === -1" name="arrow-down" />
            <Icon v-else-if="sign === 1" name="arrow-up" />
          </span>
          <span class="dl-hero__num ov-t-hero">{{ heroText }}</span>
        </div>

        <div v-memo="[state, preview]" class="dl-state">
          <span
            v-if="state.kind !== 'none'"
            class="dl-state__line"
            :class="`ov-tone-${state.tone}`"
          >
            <Icon v-if="state.kind === 'invalid'" name="warning" />
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

        <div class="dl-info">
          <div v-if="showPredicted" class="dl-pred">
            <span class="dl-pred__label">{{ t.widgets.delta.predicted }}</span>
            <span class="dl-pred__time">{{ predicted }}</span>
          </div>
          <div v-memo="[reference]" class="dl-ref">
            <span class="dl-ref__dot" :class="`dl-ref__dot--${reference.kind}`" />
            <span class="dl-ref__label">{{ reference.label }}</span>
            <span class="dl-ref__time">{{ reference.time }}</span>
          </div>
        </div>
      </div>

      <!-- Static track; a frame moves only the fill (scaleX) and the needle (translateX). -->
      <div class="dl-bar" :class="barClass" aria-hidden="true">
        <span v-inline-style="bar.fill" class="dl-bar__fill" />
        <span class="dl-bar__zero" />
        <span v-inline-style="bar.tip" class="dl-bar__tip" />
        <span class="dl-bar__cap dl-bar__cap--left" />
        <span class="dl-bar__cap dl-bar__cap--right" />
      </div>

      <div v-if="showSectors" class="dl-sectors" :class="`dl-sectors--${density}`">
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
  --dl-fit-h: 4.3;
  --dl-fit-w: 20;
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

.dl--sectors .dl-panel {
  --dl-fit-h: 6;
}

.dl--trend .dl-panel {
  --dl-fit-w: 26;
}

/* The rail is state: the sign of the delta, flush on the panel's left edge, full height. No
   transition: the class changes only when the sign flips, and it is matched on the rail itself
   (not an inherited property on the root), so a flip restyles the rail alone, not the widget. */
.dl-panel::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 2;
  width: var(--ov-bar-w);
  pointer-events: none;
}

.dl--good .dl-panel::before {
  background: var(--ov-good);
}

.dl--bad .dl-panel::before {
  background: var(--ov-bad);
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

.dl-ref__time {
  flex: none;
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
}

/* An invalid lap won't count: its numbers step back, the state says why. */
.dl--invalid .dl-hero,
.dl--invalid .dl-pred {
  opacity: var(--ov-o-dim);
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
  .dl-sectors {
    display: none;
  }

  .dl--sectors .dl-panel {
    --dl-fit-h: 4.3;
  }
}

@container delta (max-width: 300px) {
  .dl-state__text,
  .dl-state__tag {
    display: none;
  }

  .dl--trend .dl-panel {
    --dl-fit-w: 21.5;
  }
}

@container delta (max-width: 220px) {
  .dl-info {
    display: none;
  }

  .dl-top {
    justify-content: center;
  }

  .dl-panel,
  .dl--trend .dl-panel {
    --dl-fit-w: 11.5;
  }
}
</style>
