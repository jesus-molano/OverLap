<script setup lang="ts">
import { computed } from 'vue'
import {
  INFO_BARS,
  INFO_BAR_SIZES,
  isInfoItem,
  type InfoBarField,
  type InfoBarSection
} from '@shared/infoBar'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { ElementEntry, InfoBarEntryId, InfoBarSize } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import ToggleControl from '../controls/ToggleControl.vue'
import { widgetTitle } from '@shared/i18n'
import { listSetter, optionSetter, updateSection, type Setter } from '../editor'
import { offerSectionUndo } from '../undo/restore'
import ElementEditor from './ElementEditor.vue'
import { barItemTexts, zoneTitle } from './labels'
import { shownCount, type ElementChange, type SpecRules } from './listOps'

/**
 * One info bar's editor, the same on every page that has one (the relative, the standings, the
 * fuel): at the top one choice, "Mostrar cabecera: No / Pequeña / Normal / Grande" (the bar's
 * size field as it is stored, 'off' for a hidden bar); then the shared catalog's items in two
 * boxes, "Izquierda" and "Derecha" (the list's `split` marker, kept as it is stored), with their
 * eyes, the trend arrow and the wind dial on the `trackTemp` and `wind` rows (the section's
 * options, shown only while the item and the bar are). With "No" only the choice and the reset
 * show; the boxes come back as they were with a size.
 */
const props = defineProps<{ section: InfoBarSection; field: InfoBarField<InfoBarSection> }>()

const t = useI18n()
const opts = useOptions(props.section)
/** The section's fields by name: every bar section (INFO_BARS) has the ones read here. */
const raw = computed(() => opts.value as unknown as Readonly<Record<string, unknown>>)
const sizeField = `${props.field}Size` as const

const items = computed(
  () => (raw.value[props.field] ?? []) as readonly Readonly<ElementEntry<InfoBarEntryId>>[]
)
const size = computed(() => raw.value[sizeField] as InfoBarSize)
const off = computed(() => size.value === 'off')
const trend = computed(() => raw.value.conditionsTrend !== false)
const windDirection = computed(() => raw.value.conditionsWindDirection !== false)

const schema = OPTION_SCHEMA[props.section] as unknown as Readonly<Record<string, unknown>>
const spec = schema[props.field] as SpecRules<InfoBarEntryId>
// Typed per section by the helpers; the bar fields are the same shape in each section.
const applyList = listSetter(props.section, props.field as never) as Setter<
  ElementEntry<InfoBarEntryId>[]
>
const set = optionSetter(props.section) as unknown as <V>(field: string) => Setter<V>
const setSize = set<InfoBarSize>(sizeField)
const setTrend = set<boolean>('conditionsTrend')
const setWind = set<boolean>('conditionsWindDirection')

// "Restablecer" is the whole card's: the items, and the size above them.
const defaultSize = (schema[sizeField] as { readonly default: InfoBarSize }).default
const sizeAtDefault = computed(() => size.value === defaultSize)
function apply(
  next: ElementEntry<InfoBarEntryId>[],
  change: ElementChange<InfoBarEntryId>
): Promise<unknown> {
  return change.kind === 'reset' && !sizeAtDefault.value
    ? Promise.all([applyList(next), setSize(defaultSize)])
    : applyList(next)
}

const title = computed(() => zoneTitle(t.value, props.section, props.field as never))

/**
 * «Copiar a» (R13): the other widgets with the same bar, each a button that copies this one's
 * items (in their order and sides) and size into it; what the other widget has no room for in its
 * catalog is left out (the fuel lists no laps of fuel). One click, then "Deshacer".
 */
const targets = computed(() =>
  (Object.keys(INFO_BARS) as InfoBarSection[])
    .filter((s) => s !== props.section && INFO_BARS[s].some(([f]) => f === props.field))
    .map((s) => ({ section: s, name: widgetTitle(t.value, s) }))
)
function copyTo(target: InfoBarSection): void {
  const name = widgetTitle(t.value, target)
  const done = offerSectionUndo(target, (m) => m.settings.infoBar.copied(title.value, name))
  const fields: Record<string, unknown> = {
    [props.field]: items.value.map((e) => ({ id: e.id, visible: e.visible })),
    [sizeField]: size.value
  }
  void updateSection(target, fields as never)
  done()
}
/** The items' names and hints (the standings' SoF and cars that its class lines say, R13). */
const labels = computed(() => barItemTexts(t.value, props.section, raw.value))
const switchLabel = computed(() => t.value.settings.infoBar.show[props.field])
const sizeChoices = computed(() =>
  choiceOptions(INFO_BAR_SIZES, t.value.settings.infoBar.sizeChoices)
)
/** 'Normal · 4 de 15 visibles', 'No se muestra'. */
const summary = computed(() => {
  const b = t.value.settings.infoBar
  if (off.value) return b.summaryOff
  const own = items.value.filter((e) => isInfoItem(e.id))
  return b.summary(b.sizeChoices[size.value].label, shownCount(own), own.length)
})
</script>

<template>
  <ElementEditor
    :title="title"
    :items="items"
    :spec="spec"
    :labels="labels"
    :apply="apply"
    split="split"
    :summary="summary"
    :off="off"
    :rest-at-default="sizeAtDefault"
  >
    <template #head>
      <ChoiceControl
        :label="switchLabel"
        :help="off ? undefined : t.settings.infoBar.fitNote"
        :current="size"
        :options="sizeChoices"
        :apply="setSize"
      />
      <div v-if="targets.length > 0 && !off" class="st-row ib-copy">
        <span class="st-label">{{ t.settings.infoBar.copyTo }}</span>
        <span class="ib-copy-list">
          <button
            v-for="x in targets"
            :key="x.section"
            type="button"
            class="st-btn st-btn-sm st-btn-ghost"
            :title="t.settings.infoBar.copyToLabel(title, x.name)"
            :aria-label="t.settings.infoBar.copyToLabel(title, x.name)"
            @click="copyTo(x.section)"
          >
            {{ x.name }}
          </button>
        </span>
      </div>
    </template>
    <template #extra="{ id, visible }">
      <ToggleControl
        v-if="id === 'trackTemp' && visible && !off"
        :label="t.settings.infoBar.trend"
        :current="trend"
        :apply="setTrend"
      />
      <ToggleControl
        v-else-if="id === 'wind' && visible && !off"
        :label="t.settings.infoBar.windDirection"
        :current="windDirection"
        :apply="setWind"
      />
    </template>
  </ElementEditor>
</template>

<style scoped>
/* «Copiar a»: the other widgets with this bar, one button each. */
.ib-copy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.ib-copy-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
