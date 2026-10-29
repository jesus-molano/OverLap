<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { elementOrder, isElementVisible, visibleIds } from '@shared/elements'
import { deepEqual } from '@shared/equal'
import { OPTION_SCHEMA, clampOption } from '@shared/settingsSchema'
import type { TrafficPartId } from '@shared/types'
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
import DriverCell from '@renderer/ui/DriverCell.vue'
import PanelHeader from '@renderer/ui/PanelHeader.vue'
import PreviewTag from '@renderer/ui/PreviewTag.vue'
import WidgetPanel from '@renderer/ui/WidgetPanel.vue'
import { reuseView, reuseViews } from '@renderer/view/reuse'
import { createDriverStyles } from '@renderer/view/styles'
import { PREVIEW_TRAFFIC, previewOptions } from './preview'
import TrafficKindIcon from './TrafficKindIcon.vue'
import {
  hasClasses,
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
  reuseView(
    prev,
    {
      groups: visibleIds(options.value.groups),
      captions: isElementVisible(options.value.header, 'captions'),
      maxEntries: clampOption(OPTION_SCHEMA.traffic.maxEntries, options.value.maxEntries),
      nameFormat: nameFormat.value
    },
    deepEqual
  )
)
/** The cells of a car line, left to right (traffic.parts; the driver and the value always). */
const parts = computed<readonly TrafficPartId[]>((prev) =>
  reuseView(prev, visibleIds(options.value.parts, OPTION_SCHEMA.traffic.parts.ids), deepEqual)
)
const titleShown = computed(() => isElementVisible(options.value.header, 'title'))
const leadShown = computed(() => parts.value.includes('lead'))

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
  const o =
    d === PREVIEW_TRAFFIC
      ? previewOptions(viewOptions.value, elementOrder(options.value.groups))
      : viewOptions.value
  return reuseViews(prev, toSlots(d, o, styles, t.value))
})
const sectors = computed(() => hasSectors(slots.value))
const classes = computed(() => hasClasses(slots.value))

const preview = computed(() => phase.value === 'preview')
const wanted = computed(
  () => (phase.value === 'live' || phase.value === 'preview') && slots.value.length > 0
)
/** Where the VISTA PREVIA tag goes: the header, else the first caption, else the first line. */
const previewTag = computed(() =>
  !preview.value
    ? null
    : titleShown.value
      ? 'header'
      : viewOptions.value.captions
        ? 'caption'
        : 'row'
)
const shown = useReveal(
  () => wanted.value,
  () => `${titleShown.value ? 'h' : ''}${layoutKey(slots.value)}`,
  { fit: () => autoHeight.value }
)

// The panel is as tall as its lines, whatever the widget's height: its overlay panel fits to it.
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
      :class="{ 'has-sectors': sectors, 'has-classes': classes }"
      :surface="surfaceStyle"
      :halo="halo"
      :fill="!autoHeight"
    >
      <template v-if="titleShown" #header>
        <PanelHeader :title="title">
          <PreviewTag v-if="previewTag === 'header'" />
        </PanelHeader>
      </template>

      <div
        v-for="(slot, i) in slots"
        :key="i"
        v-memo="[slot, parts, i === 0 ? previewTag : null]"
        v-inline-style="slot.kind === 'row' ? slot.clsStyle : undefined"
        :class="slot.css"
      >
        <template v-if="slot.kind === 'caption'">
          <span class="tr-cap__text">{{ slot.text }}</span>
          <PreviewTag v-if="i === 0 && previewTag === 'caption'" class="tr-preview" />
        </template>
        <!-- One plate per line, the car number (plus a hazard tag): class, lap state and
             sector are text. The cells in traffic.parts' order. -->
        <template v-else>
          <template v-for="part in parts" :key="part">
            <TrafficKindIcon v-if="part === 'icon'" class="tr-icon" :kind="slot.group" />
            <template v-else-if="part === 'cls'">
              <span v-if="slot.cls" class="tr-cls">{{ slot.cls }}</span>
              <span v-else class="tr-cls tr-cls--none" />
            </template>
            <template v-else-if="part === 'driver'">
              <DriverCell
                class="tr-who"
                :number="slot.number"
                :name="slot.name"
                :name-unknown="slot.nameUnknown"
                :lap="slot.lap"
              >
                <Badge
                  v-if="slot.lapBadge"
                  class="tr-lap"
                  :class="`tr-lap--${slot.lap}`"
                  variant="text"
                  >{{ slot.lapBadge }}</Badge
                >
              </DriverCell>
              <!-- What a hazard is stays said without the words around the value. -->
              <Badge v-if="slot.hazard && !leadShown" class="tr-hazard" :tone="slot.hazardTone">{{
                slot.hazard
              }}</Badge>
            </template>
            <span v-else-if="part === 'lead'" class="tr-lead">
              <Badge v-if="slot.hazard" :tone="slot.hazardTone">{{ slot.hazard }}</Badge>
              <span class="tr-verb">{{ slot.lead }}</span>
            </span>
            <span v-else-if="part === 'value'" class="tr-num"
              >{{ slot.num }}<span class="tr-unit ov-unit">{{ slot.unit }}</span></span
            >
            <span v-else-if="part === 'sector'" class="tr-sector">{{ slot.sector }}</span>
          </template>
          <PreviewTag v-if="i === 0 && previewTag === 'row'" class="tr-preview" />
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
  padding: 0 0.6em 0.2em calc(var(--ov-bar-w) + 0.35em);
}

.tr-cap:not(.is-first) {
  border-top: 1px solid var(--ov-sep);
}

.tr-cap__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
  letter-spacing: var(--ov-track-caps);
  color: var(--ov-fg-muted);
}

.tr-cap--hazard .tr-cap__text {
  color: var(--ov-warn);
}

/* ---- Car line ------------------------------------------------------------------- */

.tr-row {
  --tr-tone: var(--ov-fg-muted);
  gap: 0.4em;
  height: var(--ov-row-h);
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  background: var(--ov-bg-row);
}

.tr-row.is-alt {
  background: var(--ov-bg-row-alt);
}

/* Stripes off: a hairline between lines instead of bands. */
.tr-row + .tr-row {
  box-shadow: inset 0 1px 0 var(--ov-row-rule);
}

/* No group captions: a group's first line below another one carries the separator. */
.tr-row.is-break {
  box-shadow: inset 0 1px 0 var(--ov-sep);
}

/* The VISTA PREVIA tag at the end of a caption or a line (no header to hold it). */
.tr-preview {
  margin-left: auto;
}

.tr-hazard {
  flex: none;
}

/* Colour-blind mode needs nothing here: the theme's warn steps away from its orange "bad". */
.tr-row.is-bad {
  --tr-tone: var(--ov-bad);
}

.tr-row.is-warn {
  --tr-tone: var(--ov-warn);
}

/* Urgency is state: the rail in its tone, full height and flush (with the icon colour and the
   number, never alone). */
.tr-row.is-bad::before,
.tr-row.is-warn::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--ov-bar-w);
  background: var(--tr-tone);
}

.tr-icon {
  font-size: 0.95em;
  color: var(--tr-tone);
}

/* Class of the car as quiet caps text, no box: the filled number plate carries its colour. */
.tr-cls {
  flex: none;
  width: 3.4em;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-tag);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
  letter-spacing: var(--ov-track-tag);
  text-transform: uppercase;
  color: var(--ov-fg-muted);
}

.tr-cls--none {
  visibility: hidden;
}

/* No line names a class (one class in the session): the column goes, the names get its room. */
.tr-panel:not(.has-classes) .tr-cls {
  display: none;
}

/* Clipped, so even a squeezed number chip never runs into the value on its right. */
.tr-who {
  flex: 1 1 auto;
  overflow: hidden;
}

/* Lapping you / lapped: a caps text tag in the lap colours of the relative (the number plate
   turns outlined too). */
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
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

/* The voice of the line: a lead number in the Display face, its unit small and dim. */
.tr-num {
  flex: none;
  min-width: 2.3em;
  font-family: var(--ov-font-num);
  font-size: var(--ov-t-lead);
  font-weight: var(--ov-w-strong);
  text-align: right;
  color: var(--ov-fg);
}

.tr-row.is-bad .tr-num,
.tr-row.is-warn .tr-num {
  color: var(--tr-tone);
}

/* Not converging: how far it is, quieter. */
.tr-row.is-idle .tr-num {
  font-weight: var(--ov-w-text);
  color: var(--ov-fg-muted);
}

/* .ov-unit (theme.css) gives the face, weight and colour. */
.tr-unit {
  font-size: max(var(--ov-min-text), var(--ov-t-unit));
}

/* Where you meet, as caption text. Always as wide, so the numbers of every line align;
   dropped when no line has a sector. */
.tr-sector {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 2.2em;
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-strong);
  color: var(--ov-fg-muted);
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
