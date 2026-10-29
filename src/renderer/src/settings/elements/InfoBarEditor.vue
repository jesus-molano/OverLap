<script setup lang="ts">
import { computed } from 'vue'
import { INFO_BAR_SIZES, type InfoBarField, type InfoBarSection } from '@shared/infoBar'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { ElementEntry, InfoBarEntryId, InfoBarSize } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter, type Setter } from '../editor'
import ElementEditor from './ElementEditor.vue'
import { elementTexts, zoneTitle } from './labels'
import type { SpecRules } from './listOps'

/**
 * One info bar's editor, the same on every page that has one (the relative, the standings, the
 * fuel): the shared catalog's items in the bar's order with their eyes, the trend arrow and the
 * wind dial on the `trackTemp` and `wind` rows (the section's options, greyed out while the
 * item or the bar is hidden), then the bar's size.
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

const title = computed(() => zoneTitle(t.value, props.section, props.field as never))
const labels = computed(() => elementTexts(t.value, props.section, 'headerBar'))
const sizeChoices = computed(() =>
  choiceOptions(INFO_BAR_SIZES, t.value.settings.infoBar.sizeChoices)
)
</script>

<template>
  <ElementEditor :title="title" :items="items" :spec="spec" :labels="labels" :apply="applyList">
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
    <template #footer>
      <ChoiceControl
        :label="t.settings.infoBar.size"
        :help="t.settings.infoBar.fitNote"
        :current="size"
        :options="sizeChoices"
        :apply="setSize"
      />
    </template>
  </ElementEditor>
</template>
