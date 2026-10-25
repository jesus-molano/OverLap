<script setup lang="ts">
import { computed } from 'vue'
import { formatSessionType } from '@shared/format'
import { clampRelativeSlots } from '@shared/relative'
import type { RelativeData } from '@shared/types'
import StatusMessage from '@renderer/components/StatusMessage.vue'
import { useI18n } from '@renderer/composables/useI18n'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import { useNameFormat, useOptions } from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { useWidgetTitle } from '@renderer/composables/useWidgetTitle'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import Badge from '@renderer/ui/Badge.vue'
import DriverCell from '@renderer/ui/DriverCell.vue'
import IncidentCount from '@renderer/ui/IncidentCount.vue'
import LicenseChip from '@renderer/ui/LicenseChip.vue'
import PanelHeader from '@renderer/ui/PanelHeader.vue'
import PenaltyIcon from '@renderer/ui/PenaltyIcon.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import TyreChip from '@renderer/ui/TyreChip.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { toIncidentCountView, type IncidentCountView } from '@renderer/view/incidents'
import { reuseView, reuseViews } from '@renderer/view/reuse'
import { createDriverStyles, type InlineStyle } from '@renderer/view/styles'
import { previewRelative } from './preview'
import {
  layoutSlots,
  relativeColumns,
  toSlotViews,
  type RelativeColumns,
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
const { halo, surfaceStyle } = useWidgetSurface(ID)
const t = useI18n()
const title = useWidgetTitle(ID)

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
const sessionLabel = computed(() => formatSessionType(source.value?.sessionType ?? null, t.value))
/** Your incidents in the header ('3x · pen. a 17x'); the same object while it reads the same. */
const incidents = computed<IncidentCountView | null>((prev) =>
  reuseView(
    prev,
    opts.value.showIncidents ? toIncidentCountView(source.value?.incidents ?? null, t.value) : null
  )
)

const styles = createDriverStyles()
// Slots are keyed by index and an unchanged slot keeps its object, so a 10 Hz payload only
// rewrites the slots whose car or values changed: no row element is ever reordered.
const slots = computed<readonly SlotView[]>((prev) =>
  reuseViews(
    prev,
    toSlotViews(
      layoutSlots(source.value, ahead.value, behind.value),
      styles,
      nameFormat.value,
      t.value
    )
  )
)
const cols = computed<RelativeColumns>((prev) => {
  const next = relativeColumns(opts.value)
  return prev !== undefined && prev.key === next.key ? prev : next
})

// Every row inherits --rl-slots, --rl-cols and --rl-fit; written only when one of them changes.
const panelStyle = computed<InlineStyle>(() => ({
  ...surfaceStyle.value,
  '--rl-slots': String(slots.value.length),
  '--rl-cols': cols.value.template,
  '--rl-fit': String(cols.value.fitEm)
}))
</script>

<template>
  <div class="ov-root rl-root ov-fade" :class="{ 'is-shown': shown }">
    <WidgetPanel fill :surface="panelStyle" :halo="halo" class="rl-panel">
      <template #header>
        <PanelHeader :title="title" :meta="sessionLabel">
          <IncidentCount v-if="incidents" v-bind="incidents" />
          <PreviewTag v-if="phase === 'preview'" />
        </PanelHeader>
      </template>

      <div v-if="phase === 'offline'" class="rl-status"><StatusMessage /></div>

      <div v-else class="rl-rows">
        <div
          v-for="(slot, i) in slots"
          :key="i"
          v-memo="[slot, cols.key, t]"
          v-inline-style="slot.kind === 'car' ? slot.clsStyle : undefined"
          :class="slot.css"
        >
          <template v-if="slot.kind === 'car'">
            <span v-if="cols.pos" class="c-pos">{{ slot.pos }}</span>
            <DriverCell
              class="c-driver"
              :number="slot.number"
              :name="slot.name"
              :name-unknown="slot.nameUnknown"
              :player="slot.isPlayer"
              :lap="slot.lap"
            >
              <span v-if="cols.flags && slot.penalty" class="rl-flag"
                ><PenaltyIcon :penalty="slot.penalty"
              /></span>
              <Badge v-if="slot.inPits" class="rl-pit">{{ t.widgets.common.pit }}</Badge>
            </DriverCell>
            <span v-if="cols.lic" class="c-lic"
              ><LicenseChip v-if="slot.lic" :text="slot.lic" :colors="slot.licStyle"
            /></span>
            <span v-if="cols.ir" class="c-ir">{{ slot.iRating }}</span>
            <span v-if="cols.tyre" class="c-tyre"><TyreChip :letter="slot.tyre" /></span>
            <span v-if="cols.stint" class="c-stint"
              >{{ slot.stint
              }}<span v-if="slot.stintUnit" class="rl-unit">{{ slot.stintUnit }}</span></span
            >
            <span class="c-gap">{{ slot.gap }}</span>
          </template>
        </div>
      </div>
    </WidgetPanel>
  </div>
</template>

<style scoped>
/* Free-size widget: the text is fitted to the window (the window is the container). */
.rl-root {
  container-type: size;
}

/* About half a row high, capped by the width so the columns always fit (--rl-fit: view.ts). */
.rl-panel {
  font-size: clamp(
    var(--ov-min-text),
    min(calc(100cqh / (var(--rl-slots) * 2 + 1.8)), calc(100cqw / var(--rl-fit, 27))),
    30px
  );
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

/* Dim the content, not the row, so the striping stays even; the PIT badge and flag stay bright. */
.rl-row.is-pits > :not(.c-driver),
.rl-row.is-pits > .c-driver > :deep(:not(.rl-pit):not(.rl-flag)) {
  opacity: var(--ov-o-dim);
}

/* The flag after the name, a notch under the text like the standings' icons. */
.rl-flag {
  display: inline-flex;
  flex: none;
  font-size: 0.85em;
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

.c-lic,
.c-tyre {
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

/* The value read at a glance: Text face, 600, full ink. */
.c-gap {
  min-width: 0;
  overflow: hidden;
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
  text-align: right;
}
</style>
