<script setup lang="ts">
import { computed, watch } from 'vue'
import { isInfoItem, type InfoBarField, type InfoBarSection } from '@shared/infoBar'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { ElementEntry, InfoBarEntryId, InfoBarSize } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter, type Setter } from '../editor'
import {
  SHOWN_SIZES,
  lastShownSize,
  rememberShownSize,
  sizeForSwitch,
  sizeWhenShown,
  type ShownSize
} from './barSwitch'
import ElementEditor from './ElementEditor.vue'
import { elementTexts, zoneTitle } from './labels'
import { shownCount, type ElementChange, type SpecRules } from './listOps'

/**
 * One info bar's editor, the same on every page that has one (the relative, the standings, the
 * fuel): at the top the bar's switch ("Mostrar cabecera") and its size, enabled while it is
 * shown (barSwitch.ts: the size 'off' is the switch off, as files have always stored it); then
 * the shared catalog's items in two boxes, "Izquierda" and "Derecha" (the list's `split`
 * marker, kept as it is stored), with their eyes, the trend arrow and the wind dial on the
 * `trackTemp` and `wind` rows (the section's options, greyed out while the item or the bar is
 * hidden).
 */
const props = defineProps<{ section: InfoBarSection; field: InfoBarField<InfoBarSection> }>()

const t = useI18n()
const opts = useOptions(props.section)
/** The section's fields by name: every bar section (INFO_BARS) has the ones read here. */
const raw = computed(() => opts.value as unknown as Readonly<Record<string, unknown>>)
const sizeField = `${props.field}Size` as const
const barKey = `${props.section}.${props.field}`

const items = computed(
  () => (raw.value[props.field] ?? []) as readonly Readonly<ElementEntry<InfoBarEntryId>>[]
)
const size = computed(() => raw.value[sizeField] as InfoBarSize)
const off = computed(() => size.value === 'off')
const trend = computed(() => raw.value.conditionsTrend !== false)
const windDirection = computed(() => raw.value.conditionsWindDirection !== false)

// The size to come back to: the bar's own while shown, else the last one this window saw.
watch(size, (s) => rememberShownSize(barKey, s), { immediate: true })
const shownSize = computed<ShownSize>(() =>
  off.value ? sizeWhenShown(lastShownSize(barKey)) : sizeWhenShown(size.value)
)

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
const setShown: Setter<boolean> = (on) => setSize(sizeForSwitch(on, lastShownSize(barKey)))

// "Restablecer" is the whole card's: the items, and the switch and size above them.
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
const labels = computed(() => elementTexts(t.value, props.section, 'headerBar'))
const switchLabel = computed(() => t.value.settings.infoBar.show[props.field])
const sizeChoices = computed(() => choiceOptions(SHOWN_SIZES, t.value.settings.infoBar.sizeChoices))
/** 'Normal · 4 de 15 visibles', 'No se muestra'. */
const summary = computed(() => {
  const b = t.value.settings.infoBar
  if (off.value) return b.summaryOff
  const own = items.value.filter((e) => isInfoItem(e.id))
  return b.summary(b.sizeChoices[shownSize.value].label, shownCount(own), own.length)
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
    :dim="off"
    :rest-at-default="sizeAtDefault"
  >
    <template #head>
      <ToggleControl kind="switch" :label="switchLabel" :current="!off" :apply="setShown" />
      <ChoiceControl
        :label="t.settings.infoBar.size"
        :help="t.settings.infoBar.fitNote"
        :current="shownSize"
        :options="sizeChoices"
        :disabled="off"
        :apply="setSize"
      />
    </template>
    <template #extra="{ id, visible }">
      <ToggleControl
        v-if="id === 'trackTemp'"
        :label="t.settings.infoBar.trend"
        :current="trend"
        :disabled="!visible || off"
        :apply="setTrend"
      />
      <ToggleControl
        v-else-if="id === 'wind'"
        :label="t.settings.infoBar.windDirection"
        :current="windDirection"
        :disabled="!visible || off"
        :apply="setWind"
      />
    </template>
  </ElementEditor>
</template>
