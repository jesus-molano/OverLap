<script setup lang="ts">
import { computed } from 'vue'
import { formatSessionType } from '@shared/format'
import { clampRelativeSlots } from '@shared/relative'
import type { RelativeData } from '@shared/types'
import StatusMessage from '@renderer/components/StatusMessage.vue'
import { useI18n } from '@renderer/composables/useI18n'
import { useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import { useNameFormat, useOptions } from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { useWidgetTitle } from '@renderer/composables/useWidgetTitle'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import Badge from '@renderer/ui/Badge.vue'
import DriverCell from '@renderer/ui/DriverCell.vue'
import LicenseChip from '@renderer/ui/LicenseChip.vue'
import PanelHeader from '@renderer/ui/PanelHeader.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseViews } from '@renderer/view/reuse'
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

const { data, phase } = useWidgetPhase(ID, { showsOffline: true })
const opts = useOptions(ID)
const nameFormat = useNameFormat(ID)
const { halo, surfaceStyle } = useWidgetSurface(ID)
const t = useI18n()
const title = useWidgetTitle(ID)

const slotsAheadCfg = computed(() => clampRelativeSlots(opts.value.carsAhead))
const slotsBehindCfg = computed(() => clampRelativeSlots(opts.value.carsBehind))
/** Live rows, the sample in edit mode, or none (offline, or no payload yet: empty slots). */
const source = computed<RelativeData | null>(() => {
  if (phase.value === 'live') return data.value
  if (phase.value === 'preview') return previewRelative(slotsAheadCfg.value, slotsBehindCfg.value)
  return null
})
const ahead = computed(() => clampRelativeSlots(source.value?.slotsAhead ?? slotsAheadCfg.value))
const behind = computed(() => clampRelativeSlots(source.value?.slotsBehind ?? slotsBehindCfg.value))
const sessionLabel = computed(() => formatSessionType(source.value?.sessionType ?? null, t.value))

const styles = createDriverStyles()
// Slots are keyed by index and an unchanged slot keeps its object, so a 10 Hz payload only
// rewrites the slots whose car or values changed: no row element is ever reordered.
const slots = computed<readonly SlotView[]>((prev) =>
  reuseViews(
    prev,
    toSlotViews(layoutSlots(source.value, ahead.value, behind.value), styles, nameFormat.value)
  )
)
const cols = computed<RelativeColumns>((prev) => {
  const next = relativeColumns(opts.value)
  return prev !== undefined && prev.key === next.key ? prev : next
})

// Every row inherits --rl-slots and --rl-cols; written only when one of them changes.
const panelStyle = computed<InlineStyle>(() => ({
  ...surfaceStyle.value,
  '--rl-slots': String(slots.value.length),
  '--rl-cols': cols.value.template
}))
</script>

<template>
  <div class="ov-root rl-root">
    <WidgetPanel fill :surface="panelStyle" :halo="halo" class="rl-panel">
      <template #header>
        <PanelHeader :title="title" :meta="sessionLabel">
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
              :player="slot.isPlayer"
              :lap="slot.lap"
            >
              <Badge v-if="slot.inPits" class="rl-pit">{{ t.widgets.common.pit }}</Badge>
            </DriverCell>
            <span v-if="cols.lic" class="c-lic"
              ><LicenseChip v-if="slot.lic" :text="slot.lic" :colors="slot.licStyle"
            /></span>
            <span v-if="cols.ir" class="c-ir">{{ slot.iRating }}</span>
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

/* About half a row high, capped by the width so the fixed columns always fit. */
.rl-panel {
  font-size: clamp(
    var(--ov-min-text),
    min(calc(100cqh / (var(--rl-slots) * 2 + 1.8)), calc(100cqw / 27)),
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

/* Dim the content, not the row, so the striping stays even; the PIT badge stays bright. */
.rl-row.is-pits > :not(.c-driver),
.rl-row.is-pits > .c-driver > :deep(:not(.rl-pit)) {
  opacity: var(--ov-o-dim);
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

.c-lic {
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

/* The value read at a glance: Text face, 600, full ink. */
.c-gap {
  min-width: 0;
  overflow: hidden;
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg);
  text-align: right;
}
</style>
