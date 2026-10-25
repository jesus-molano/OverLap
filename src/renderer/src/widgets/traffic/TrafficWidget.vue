<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { OPTION_SCHEMA, clampOption } from '@shared/settingsSchema'
import { useContentSize } from '@renderer/composables/useContentSize'
import { useI18n } from '@renderer/composables/useI18n'
import { useReveal } from '@renderer/composables/useReveal'
import { useShownContent, useWidgetPhase } from '@renderer/composables/useWidgetPhase'
import {
  useAutoHeight,
  useNameFormat,
  useOptions,
  useWidgetSettings
} from '@renderer/composables/useWidgetSettings'
import { useWidgetSurface } from '@renderer/composables/useWidgetSurface'
import { useWidgetTitle } from '@renderer/composables/useWidgetTitle'
import { vInlineStyle } from '@renderer/directives/inlineStyle'
import Badge from '@renderer/ui/Badge.vue'
import Chip from '@renderer/ui/Chip.vue'
import DriverCell from '@renderer/ui/DriverCell.vue'
import PanelHeader from '@renderer/ui/PanelHeader.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView, reuseViews } from '@renderer/view/reuse'
import { createDriverStyles } from '@renderer/view/styles'
import { PREVIEW_TRAFFIC, previewOptions } from './preview'
import TrafficKindIcon from './TrafficKindIcon.vue'
import {
  hasSectors,
  hasTraffic,
  layoutKey,
  toSlots,
  type TrafficSlotView,
  type TrafficViewOptions
} from './view'

const ID = 'traffic'
const NO_SLOTS: readonly TrafficSlotView[] = Object.freeze([])

const options = useOptions(ID)
const nameFormat = useNameFormat(ID)
const prefs = useWidgetSettings(ID)
const autoHeight = useAutoHeight(ID)
const { surfaceStyle, halo } = useWidgetSurface(ID)
const styles = createDriverStyles()
const t = useI18n()
const title = useWidgetTitle(ID)

// Options are stable objects (useOptions); the view input keeps its identity while equal, so a
// look-ahead change (provider side) or a drag re-renders nothing.
const viewOptions = computed<TrafficViewOptions>((prev) =>
  reuseView(prev, {
    showFaster: options.value.showFaster,
    showSlower: options.value.showSlower,
    showHazards: options.value.showHazards,
    maxEntries: clampOption(OPTION_SCHEMA.traffic.maxEntries, options.value.maxEntries),
    nameFormat: nameFormat.value
  })
)

// Look-ahead windows and 'Solo en multiclase' are the provider's: it simply sends no entries.
const { data, phase } = useWidgetPhase(ID, {
  showsOffline: false,
  hasContent: (d) => hasTraffic(d, viewOptions.value)
})

/** Live data, the sample in edit mode, or what was shown last (kept through the fade-out). */
const content = useShownContent(
  () => phase.value,
  () => data.value,
  () => PREVIEW_TRAFFIC
)

// Slots are keyed by index and an unchanged slot keeps its object, so a 4 Hz payload only
// rewrites the lines whose car or values changed: no line element is ever reordered. A new
// language rebuilds every line once.
const slots = computed<readonly TrafficSlotView[]>((prev) => {
  const d = content.value
  if (d === null) return prev ?? NO_SLOTS
  const o = d === PREVIEW_TRAFFIC ? previewOptions(viewOptions.value) : viewOptions.value
  return reuseViews(prev, toSlots(d, o, styles, t.value))
})
const sectors = computed(() => hasSectors(slots.value))

const preview = computed(() => phase.value === 'preview')
const wanted = computed(
  () => (phase.value === 'live' || phase.value === 'preview') && slots.value.length > 0
)
const shown = useReveal(
  () => wanted.value,
  () => layoutKey(slots.value),
  { fit: () => autoHeight.value }
)

// The panel is as tall as its lines, whatever the window height: main fits the window to it.
// It only exists once there are lines (and then keeps the last ones while hidden), so the first
// height measured is the real one, never that of an empty, header-only panel.
const panel = useTemplateRef('panel')
useContentSize(panel, { enabled: () => autoHeight.value && wanted.value })

/** The window grows upwards: the panel hugs the bottom edge while the window waits to shrink. */
const bottomAnchored = computed(() => autoHeight.value && prefs.value.anchor === 'bottom')
</script>

<template>
  <div class="ov-root tr-root ov-fade" :class="{ 'is-shown': shown, 'is-bottom': bottomAnchored }">
    <WidgetPanel
      v-if="slots.length > 0"
      ref="panel"
      class="tr-panel"
      :class="{ 'has-sectors': sectors }"
      :surface="surfaceStyle"
      :halo="halo"
      :fill="!autoHeight"
    >
      <template #header>
        <PanelHeader :title="title">
          <PreviewTag v-if="preview" />
        </PanelHeader>
      </template>

      <div
        v-for="(slot, i) in slots"
        :key="i"
        v-memo="[slot]"
        v-inline-style="slot.kind === 'row' ? slot.clsStyle : undefined"
        :class="slot.css"
      >
        <span v-if="slot.kind === 'caption'" class="tr-cap__text">{{ slot.text }}</span>
        <template v-else>
          <TrafficKindIcon class="tr-icon" :kind="slot.group" />
          <span v-if="slot.cls" class="tr-cls">{{ slot.cls }}</span>
          <span v-else class="tr-cls tr-cls--none" />
          <DriverCell class="tr-who" :number="slot.number" :name="slot.name" :lap="slot.lap">
            <Badge
              v-if="slot.lapBadge"
              class="tr-lap"
              :class="`tr-lap--${slot.lap}`"
              variant="outline"
              >{{ slot.lapBadge }}</Badge
            >
          </DriverCell>
          <span class="tr-lead">
            <Badge v-if="slot.hazard" :tone="slot.hazardTone">{{ slot.hazard }}</Badge>
            <span class="tr-verb">{{ slot.lead }}</span>
          </span>
          <span class="tr-num"
            >{{ slot.num }}<span class="tr-unit">{{ slot.unit }}</span></span
          >
          <span class="tr-sector"
            ><Chip v-if="slot.sector">{{ slot.sector }}</Chip></span
          >
        </template>
      </div>
    </WidgetPanel>
  </div>
</template>

<style scoped>
/* With the bottom edge anchored the panel hugs it while the window waits to shrink. */
.tr-root.is-bottom {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

/*
 * As tall as its lines (never sized by the window: no cqh, no height: 100%), so the window can
 * follow it without feedback. Only with the auto height off does the panel fill the window. The
 * panel is the inline-size container (em of the widget font) for the narrow-width rules.
 */
.tr-panel {
  flex: none;
  padding-bottom: 0.25em;
  container: traffic / inline-size;
}

/*
 * Fixed heights, never sized by content, so contain: strict is safe: a 4 Hz text change
 * re-lays out its own line only.
 */
.tr-cap,
.tr-row {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  contain: strict;
}

/* ---- Group caption ------------------------------------------------------------- */

.tr-cap {
  align-items: flex-end;
  height: 1.55em;
  padding: 0 0.7em 0.2em;
}

.tr-cap:not(.is-first) {
  border-top: 1px solid var(--ov-sep);
}

.tr-cap__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--ov-t-tag);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.12em;
  color: var(--ov-fg-muted);
}

.tr-cap--hazard .tr-cap__text {
  color: var(--ov-warn);
}

/* ---- Car line ------------------------------------------------------------------- */

.tr-row {
  --tr-tone: var(--ov-fg-muted);
  gap: 0.45em;
  height: var(--ov-row-h);
  padding: 0 0.7em 0 calc(var(--ov-bar-w) + 0.45em);
  background: var(--ov-bg-row);
}

.tr-row.is-alt {
  background: var(--ov-bg-row-alt);
}

.tr-row.is-bad {
  --tr-tone: var(--ov-bad);
}

.tr-row.is-warn {
  --tr-tone: var(--ov-warn);
}

/* The colour-blind "bad" is orange, next to the amber warn: "soon" steps up to a light yellow. */
:root[data-cvd='on'] .tr-row.is-warn {
  --tr-tone: #ffe066;
}

/* Urgent lines get a side bar in their tone (with the icon colour and the number, never alone). */
.tr-row.is-bad::before,
.tr-row.is-warn::before {
  content: '';
  position: absolute;
  inset: 0.25em auto 0.25em 0;
  width: var(--ov-bar-w);
  border-radius: 0 2px 2px 0;
  background: var(--tr-tone);
}

.tr-icon {
  font-size: 0.95em;
  color: var(--tr-tone);
}

/* Class of the car: its colour as text, tint and ring (the number chip next to it is filled). */
.tr-cls {
  flex: none;
  width: 4.6em;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 0.3em;
  border-radius: var(--ov-radius-chip);
  font-size: var(--ov-t-tag);
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: 0.04em;
  text-align: center;
  text-transform: uppercase;
  color: var(--cls);
  background: color-mix(in srgb, var(--cls) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cls) 55%, transparent);
}

.tr-cls--none {
  visibility: hidden;
}

/* Clipped, so even a squeezed number chip never runs into the value on its right. */
.tr-who {
  flex: 1 1 auto;
  overflow: hidden;
}

/* Lapping you / lapped: the lap colours of the relative (the number chip turns outlined too). */
.tr-lap--ahead {
  --ov-tone: var(--ov-lap-ahead);
  color: var(--ov-lap-ahead);
}

.tr-lap--behind {
  --ov-tone: var(--ov-lap-behind);
  color: var(--ov-lap-behind);
}

/* ---- Key value: words, number, where ---------------------------------------------- */

.tr-lead {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.35em;
}

.tr-verb {
  font-size: var(--ov-t-secondary);
  color: var(--ov-fg-muted);
}

.tr-num {
  flex: none;
  min-width: 2.3em;
  font-family: var(--ov-font-num);
  font-size: 1.08em;
  font-weight: 700;
  text-align: right;
  color: var(--ov-fg);
}

.tr-row.is-bad .tr-num,
.tr-row.is-warn .tr-num {
  color: var(--tr-tone);
}

/* Not converging: how far it is, quieter. */
.tr-row.is-idle .tr-num {
  font-weight: 600;
  color: var(--ov-fg-muted);
}

.tr-unit {
  margin-left: 0.12em;
  font-size: max(var(--ov-min-text), 0.68em);
  font-weight: 600;
  color: var(--ov-fg-muted);
}

/* Always as wide, so the numbers of every line align; dropped when no line has a sector. */
.tr-sector {
  flex: none;
  display: flex;
  justify-content: flex-end;
  width: 2.2em;
}

.tr-panel:not(.has-sectors) .tr-sector {
  display: none;
}

/* ---- Narrow windows: the name keeps its room ---------------------------------------- */

@container traffic (max-width: 26em) {
  .tr-verb,
  .tr-row:not(.tr-row--hazard) > .tr-lead {
    display: none;
  }
}

@container traffic (max-width: 21em) {
  .tr-cls {
    display: none;
  }
}

/* The name keeps its lap colour and the number chip its outline. */
@container traffic (max-width: 18em) {
  .tr-lap {
    display: none;
  }
}

/* Very narrow (a big scale on a small window): when it happens matters more than where. */
@container traffic (max-width: 14em) {
  .tr-sector {
    display: none;
  }
}
</style>
