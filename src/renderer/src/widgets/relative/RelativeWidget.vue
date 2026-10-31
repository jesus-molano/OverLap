<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { brandMarksOn } from '@shared/carBrands'
import { INFO_BAR_SCALE } from '@shared/infoBar'
import { clampRelativeSlots } from '@shared/relative'
import { isRaceSession } from '@shared/sessionInfo'
import type { RelativeData } from '@shared/types'
import StatusMessage from '@renderer/components/StatusMessage.vue'
import { useAppearance } from '@renderer/composables/useAppearance'
import { useI18n } from '@renderer/composables/useI18n'
import { useInfoBar } from '@renderer/composables/useInfoBar'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import {
  useDensity,
  useDriverBlock,
  useNameFormat,
  useOptions
} from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { useElementSize } from '@renderer/composables/useElementSize'
import { injectSampleHost, useNoRoomReport } from '@renderer/composables/widgetContext'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import Badge from '@renderer/ui/Badge.vue'
import DriverCell from '@renderer/ui/DriverCell.vue'
import DriverPart from '@renderer/ui/DriverPart.vue'
import Icon from '@renderer/ui/Icon.vue'
import InfoBar from '@renderer/ui/InfoBar.vue'
import IRating from '@renderer/ui/IRating.vue'
import LapTime from '@renderer/ui/LapTime.vue'
import LicenseChip from '@renderer/ui/LicenseChip.vue'
import PenaltyIcon from '@renderer/ui/PenaltyIcon.vue'
import TyreChip from '@renderer/ui/TyreChip.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { iRatingColumnEm } from '@renderer/view/driverCell'
import { reuseViews } from '@renderer/view/reuse'
import { createDriverStyles, type InlineStyle } from '@renderer/view/styles'
import { previewRelative } from './preview'
import {
  chromeEm,
  densityShows,
  layoutSlots,
  relativeColumns,
  relativeHeads,
  relativeRowEm,
  toSlotViews,
  type RelativeColumns,
  type RelativeHeadView,
  type SlotView
} from './view'

const ID = 'relative'

// No rows (the car out of the world, as on iRacing's session screen): nothing to show (B06).
const { data, phase } = useWidgetPhase(ID, {
  showsOffline: true,
  hasContent: (d) => d.rows.length > 0
})
const opts = useOptions(ID)
const nameFormat = useNameFormat(ID)
/** Makes, flags and penalty badges: the «Piloto» block (own or Apariencia's). */
const block = useDriverBlock(ID)
/** The iRating in its driver's licence colours (request 10). */
const irColor = computed(() => block.value.iRatingColor)
const density = useDensity(ID)
const { halo, surfaceStyle } = useWidgetSurface(ID)
const appearance = useAppearance()
const t = useI18n()

const slotsAheadCfg = computed(() => clampRelativeSlots(opts.value.carsAhead))
const slotsBehindCfg = computed(() => clampRelativeSlots(opts.value.carsBehind))
/** Hidden (no rows, no payload): the panel fades out instead of drawing empty slots (B06). */
const shown = computed(() => phase.value !== 'hidden')
/** Live rows, the sample in edit mode, or what was shown last (kept through the fade-out). */
const source = useShownContent<RelativeData>(
  () => phase.value,
  () => data.value,
  () => previewRelative(slotsAheadCfg.value, slotsBehindCfg.value)
)
const ahead = computed(() => clampRelativeSlots(source.value?.slotsAhead ?? slotsAheadCfg.value))
const behind = computed(() => clampRelativeSlots(source.value?.slotsBehind ?? slotsBehindCfg.value))

/**
 * The header and footer info bars (relative.headerBar / footerBar, each with its size): every
 * item keeps its object while it reads the same, so the 10 Hz payloads re-render nothing there.
 * The footer (off by default) is for the rows only, not the offline message.
 */
const head = useInfoBar(ID, 'headerBar', () => source.value?.info ?? null)
const foot = useInfoBar(ID, 'footerBar', () => source.value?.info ?? null)
const headed = computed(() => head.shown.value)
const footed = computed(() => phase.value !== 'offline' && foot.shown.value)
/** The column heads row (relative.columnHeads), over the rows only. */
const heads = computed(() => opts.value.columnHeads && phase.value !== 'offline')

const styles = createDriverStyles()
/** A race session: outside races «Última vuelta» shows the best lap, as in the standings. */
const race = computed(() => isRaceSession(source.value?.sessionType ?? null))
// Slots are keyed by index and an unchanged slot keeps its object, so a 10 Hz payload only
// rewrites the slots whose car or values changed: no row element is ever reordered.
const slots = computed<readonly SlotView[]>((prev) =>
  reuseViews(
    prev,
    toSlotViews(
      layoutSlots(source.value, ahead.value, behind.value),
      styles,
      nameFormat.value,
      t.value,
      race.value,
      block.value.iRatingFormat
    )
  )
)
/** The provider names no compound while the whole field runs the same one: no tyre column. */
const tyres = computed(() => source.value?.rows.some((r) => r.tyre !== null) ?? false)
/** Makes and flags in the driver cell; 'auto' marks only a field of several makes (A.4). */
const brands = computed(() =>
  brandMarksOn(block.value.brandMarks, source.value?.multiBrand ?? false)
)
const cols = computed<RelativeColumns>((prev) => {
  const next = relativeColumns(opts.value.columns, {
    tyres: tyres.value,
    flags: block.value.showFlags,
    brand: brands.value,
    country: block.value.countryFlags,
    numberStyle: appearance.value.numberStyle,
    race: race.value,
    irEm: iRatingColumnEm(
      block.value.iRatingFormat,
      block.value.iRatingColor,
      appearance.value.licenseStyle
    )
  })
  return prev !== undefined && prev.key === next.key ? prev : next
})
const headViews = computed<readonly RelativeHeadView[]>((prev) =>
  reuseViews(
    prev,
    relativeHeads(cols.value.tracks, appearance.value.licenseStyle, t.value, race.value)
  )
)

/** What the bars and heads take of the height (em of the row font), with the rows. */
const chrome = computed(() =>
  chromeEm({
    header: headed.value ? INFO_BAR_SCALE[head.size.value] : null,
    heads: heads.value,
    footer: footed.value ? INFO_BAR_SCALE[foot.size.value] : null
  })
)

// Every row inherits --rl-slots, --rl-row (a row's em: the density), --rl-cols, --rl-fit and
// --rl-chrome (the bars' and the heads' em); written only when one of them changes.
const panelStyle = computed<InlineStyle>(() => ({
  ...surfaceStyle.value,
  '--rl-slots': String(slots.value.length),
  '--rl-row': String(relativeRowEm(density.value)),
  '--rl-cols': cols.value.template,
  '--rl-fit': String(cols.value.fitEm),
  '--rl-chrome': String(chrome.value)
}))

// A window the width sets the text of draws both densities the same: the settings page says so
// on the density choice (the preview's note). Measured in the settings sample only.
const root = useTemplateRef<HTMLElement>('root')
if (injectSampleHost() !== null) {
  const rootSize = useElementSize(root)
  useNoRoomReport(() =>
    densityShows(
      rootSize.value.w,
      rootSize.value.h,
      slots.value.length,
      chrome.value,
      cols.value.fitEm
    )
      ? []
      : ['relative.density']
  )
}
</script>

<template>
  <div ref="root" class="ov-root rl-root ov-fade" :class="{ 'is-shown': shown }">
    <WidgetPanel fill :surface="panelStyle" :halo="halo" class="rl-panel">
      <template v-if="headed" #header>
        <InfoBar
          :view="head.view.value"
          :size="head.size.value"
          place="head"
          sim
          :preview="phase === 'preview'"
          zone="relative.headerBar"
        />
      </template>

      <div v-if="phase === 'offline'" class="rl-status"><StatusMessage /></div>

      <template v-else>
        <div v-if="heads" class="rl-heads" aria-hidden="true">
          <span
            v-for="h in headViews"
            :key="h.id"
            class="rl-head"
            :class="`is-${h.align}`"
            :data-el="`relative.columns.${h.id}`"
            >{{ h.label }}</span
          >
        </div>

        <div class="rl-rows">
          <div
            v-for="(slot, i) in slots"
            :key="i"
            v-memo="[slot, cols.key, t, irColor]"
            v-inline-style="slot.kind === 'car' ? slot.clsStyle : undefined"
            :class="slot.css"
          >
            <template v-if="slot.kind === 'car'">
              <template v-for="cell in cols.tracks" :key="cell">
                <span v-if="cell === 'pos'" class="c-pos" data-el="relative.columns.pos">{{
                  slot.pos
                }}</span>
                <DriverCell
                  v-else-if="cell === 'driver'"
                  class="c-driver"
                  data-el="relative.columns.driver"
                  :number="slot.number"
                  :name="slot.name"
                  :name-unknown="slot.nameUnknown"
                  :player="slot.isPlayer"
                  :lap="slot.lap"
                  :brand="cols.brand ? slot.brand : undefined"
                  :country="cols.country ? slot.country : undefined"
                  :before="cols.before"
                  part-el="relative.columns"
                  :penalty="slot.penalty"
                >
                  <!-- The parts placed after the name (request 11), the penalty flag as always. -->
                  <template v-for="part in cols.after" :key="part">
                    <span
                      v-if="part === 'flags' && slot.penalty"
                      class="rl-flag"
                      data-el="relative.columns.flags"
                      ><PenaltyIcon :penalty="slot.penalty"
                    /></span>
                    <DriverPart
                      v-else-if="part !== 'flags'"
                      :part="part"
                      :number="slot.number"
                      :lap="slot.lap"
                      :brand="slot.brand"
                      :country="slot.country"
                      :data-el="`relative.columns.${part}`"
                    />
                  </template>
                  <template v-if="cols.pitInline">
                    <Badge v-if="slot.towed" class="rl-pit" tone="warn">{{
                      t.widgets.common.tow
                    }}</Badge>
                    <Badge v-else-if="slot.inPits" class="rl-pit">{{ t.widgets.common.pit }}</Badge>
                  </template>
                </DriverCell>
                <span v-else-if="cell === 'number'" class="c-num" data-el="relative.columns.number"
                  ><DriverPart part="number" :number="slot.number" :lap="slot.lap"
                /></span>
                <span v-else-if="cell === 'brand'" class="c-brand" data-el="relative.columns.brand"
                  ><DriverPart part="brand" :brand="slot.brand"
                /></span>
                <span
                  v-else-if="cell === 'country'"
                  class="c-country"
                  data-el="relative.columns.country"
                  ><DriverPart part="country" :country="slot.country"
                /></span>
                <span v-else-if="cell === 'pit'" class="c-pit" data-el="relative.columns.pit"
                  ><Badge v-if="slot.towed" tone="warn">{{ t.widgets.common.tow }}</Badge
                  ><Badge v-else-if="slot.inPits">{{ t.widgets.common.pit }}</Badge></span
                >
                <span v-else-if="cell === 'flags'" class="c-flags" data-el="relative.columns.flags"
                  ><PenaltyIcon v-if="slot.penalty" :penalty="slot.penalty"
                /></span>
                <span
                  v-else-if="cell === 'gained'"
                  class="c-gained"
                  :class="`ov-tone-${slot.gainedTone}`"
                  data-el="relative.columns.gained"
                  ><Icon v-if="slot.gainedIcon" :name="slot.gainedIcon" class="rl-gain-icon" />{{
                    slot.gained
                  }}</span
                >
                <span v-else-if="cell === 'lic'" class="c-lic" data-el="relative.columns.lic"
                  ><LicenseChip v-if="slot.lic" :text="slot.lic" :colors="slot.licStyle"
                /></span>
                <span
                  v-else-if="cell === 'ir'"
                  class="c-ir"
                  :class="{ 'is-lic': irColor }"
                  data-el="relative.columns.ir"
                  ><IRating :text="slot.iRating" :colors="irColor ? slot.licStyle : null"
                /></span>
                <span v-else-if="cell === 'tyre'" class="c-tyre" data-el="relative.columns.tyre"
                  ><TyreChip :letter="slot.tyre"
                /></span>
                <span v-else-if="cell === 'stint'" class="c-stint" data-el="relative.columns.stint"
                  >{{ slot.stint
                  }}<span v-if="slot.stintUnit" class="rl-unit">{{ slot.stintUnit }}</span></span
                >
                <span v-else-if="cell === 'last'" class="c-lap" data-el="relative.columns.last"
                  ><LapTime :text="slot.lastLap" :kind="slot.lastLapKind"
                /></span>
                <span v-else class="c-gap" data-el="relative.columns.gap">{{ slot.gap }}</span>
              </template>
            </template>
          </div>
        </div>
      </template>

      <InfoBar
        v-if="footed"
        :view="foot.view.value"
        :size="foot.size.value"
        place="foot"
        zone="relative.footerBar"
      />
    </WidgetPanel>
  </div>
</template>

<style scoped>
/* Free-size widget: the text is fitted to the window (the window is the container). */
.rl-root {
  container-type: size;
}

/*
 * A row is --rl-row em of this font (half a row high when comfortable), capped by the width so the columns always fit (--rl-fit: view.ts). The
 * info bars and the column heads are counted in the height (--rl-chrome: view.ts chromeEm): with
 * them the rows keep their proportions, a notch smaller.
 */
.rl-panel {
  font-size: clamp(
    var(--ov-min-text),
    min(
      calc(100cqh / (var(--rl-slots) * var(--rl-row, 2) + var(--rl-chrome, 1.8))),
      calc(100cqw / var(--rl-fit, 27))
    ),
    30px
  );
}

/*
 * The column heads: one fixed-height line on the rows' own grid, so each caption sits over its
 * column whatever the order. Small, dim, clipped; the words as the standings' heads write them
 * ('iR', not 'IR').
 */
.rl-heads {
  display: grid;
  flex: none;
  grid-template-columns: var(--rl-cols);
  align-items: center;
  column-gap: 0.4em;
  height: 1.1em;
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  overflow: hidden;
  contain: strict;
  white-space: nowrap;
  box-shadow: inset 0 -1px 0 var(--ov-row-rule);
}

.rl-head {
  min-width: 0;
  overflow: hidden;
  font-family: var(--ov-font-small);
  font-size: max(var(--ov-min-text), 0.6em);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-tag);
  line-height: 1;
  color: var(--ov-fg-dim);
}

.rl-head.is-center {
  text-align: center;
}

.rl-head.is-end {
  text-align: right;
}

/* StatusMessage centres itself in what is left below the header. */
.rl-status {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.rl-rows {
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-rows: repeat(var(--rl-slots), minmax(0, 1fr));
}

/*
 * Sized by the grid tracks, never by their content, so contain: strict is safe: a 10 Hz text
 * change re-lays out its own row only. Rows sit on the glass; alternate rows get the stripe band
 * (or, with stripes off, every row a 1 px rule on top: --ov-row-rule).
 */
.rl-row {
  position: relative;
  contain: strict;
  display: grid;
  grid-template-columns: var(--rl-cols);
  align-items: center;
  column-gap: 0.4em;
  min-height: 0;
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  overflow: hidden;
  white-space: nowrap;
  background: var(--ov-bg-row);
}

.rl-row.is-alt {
  background: var(--ov-bg-row-alt);
}

.rl-row + .rl-row {
  box-shadow: inset 0 1px 0 var(--ov-row-rule);
}

/* Your row's bracket draws its own top and bottom lines: no rule on it or right under it. */
.rl-row.ov-player,
.ov-player + .rl-row {
  box-shadow: none;
}

/*
 * Dim the content, not the row, so the striping stays even; the PIT badge and the flags stay
 * bright (in the name's cell too: their slot before the name).
 */
.rl-row.is-pits > :not(.c-driver):not(.c-flags),
.rl-row.is-pits > .c-driver > :deep(:not(.rl-pit):not(.rl-flag):not(.ov-dpart--flags)) {
  opacity: var(--ov-o-dim);
}

/* The flag after the name (or in its column), a notch under the text like the standings' icons. */
.rl-flag,
.c-flags {
  font-size: 0.85em;
}

.rl-flag {
  display: inline-flex;
  flex: none;
}

/* Secondary in a relative, by design: plain figures, bright on your own row. */
.c-pos {
  min-width: 0;
  overflow: hidden;
  font-size: var(--ov-t-secondary);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg-muted);
}

.ov-player > .c-pos {
  color: var(--ov-fg);
}

.c-driver {
  min-width: 0;
  overflow: hidden;
}

/* The driver's parts in columns of their own (request 11): at the start, as in the name's cell. */
.c-num,
.c-brand,
.c-country {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.c-lic,
.c-flags,
.c-tyre {
  display: flex;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
}

/* The PIT column (R10): its badge centred in the cell. */
.c-pit {
  display: flex;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
}

.c-ir {
  min-width: 0;
  overflow: hidden;
  font-size: var(--ov-t-secondary);
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
  text-align: right;
}

/* In its licence's colours (IRating): the plate centred on the row, at the cell's end. */
.c-ir.is-lic {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* «Puestos ganados» as the standings' (StandingsCarCells.vue): a triangle and the count in the
   tone, nothing at all for none. */
.c-gained {
  min-width: 0;
  overflow: hidden;
  font-size: max(var(--ov-min-text), 0.75em);
  font-weight: var(--ov-w-strong);
  text-align: right;
}

.rl-gain-icon {
  font-size: 1.15em;
}

/* Stint laps: a secondary figure like the iR, its lap unit smaller and dim. */
.c-stint {
  min-width: 0;
  overflow: hidden;
  font-size: var(--ov-t-secondary);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg-muted);
  text-align: right;
}

.rl-unit {
  margin-left: 0.12em;
  font-size: max(var(--ov-min-text), 0.8em);
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-dim);
}

/* «Última vuelta»: the standings' lap plate, right-aligned (the class's best fills the cell). */
.c-lap {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  overflow: hidden;
}

/* The value read at a glance: Text face, 600, full ink. */
.c-gap {
  min-width: 0;
  overflow: hidden;
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
  text-align: right;
}
</style>
