<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible } from '@shared/elements'
import {
  INPUTS_TRACE_MAX_S,
  INPUTS_TRACE_MIN_S,
  INPUTS_TRACE_WIDTH_MAX,
  INPUTS_TRACE_WIDTH_MIN
} from '@shared/settings'
import { OPTION_SCHEMA, PEDAL_COLOR_PRESETS } from '@shared/settingsSchema'
import type { InputsOptions } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { overlayState } from '../../composables/useOverlay'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions, type ChoiceOption } from '../controls/choice'
import ColorControl from '../controls/ColorControl.vue'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter, updateSection, type Setter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'
import { formatPx, formatSeconds, stepValues } from '../values'

const opts = useOptions('inputs')
const t = useI18n()
const set = optionSetter('inputs')
const seconds = (s: number): string => formatSeconds(s)

type Pedal = keyof InputsOptions['colors']

/** The colour set always goes out whole, built from the latest settings main sent. */
function colorSetter(pedal: Pedal): Setter<string> {
  return (color) => {
    const current = overlayState.settings.value?.inputs.colors ?? opts.value.colors
    return updateSection('inputs', { colors: { ...current, [pedal]: color } })
  }
}

const PEDALS: readonly Pedal[] = ['throttle', 'brake', 'clutch']
// One stable setter per pedal; only the labels follow the language.
const PEDAL_SETTERS: Readonly<Record<Pedal, Setter<string>>> = {
  throttle: colorSetter('throttle'),
  brake: colorSetter('brake'),
  clutch: colorSetter('clutch')
}
const pedals = computed(() => {
  const names = t.value.settings.inputs.pedals
  return PEDALS.map((key) => {
    const label = names[key]
    return {
      key,
      label,
      presets: PEDAL_COLOR_PRESETS[key].map((value, i) => ({ value, label: `${label} ${i + 1}` })),
      apply: PEDAL_SETTERS[key]
    }
  })
})

const spec = OPTION_SCHEMA.inputs.traceWidth
const WIDTH_CHOICES: readonly ChoiceOption<string>[] = stepValues(
  INPUTS_TRACE_WIDTH_MIN,
  INPUTS_TRACE_WIDTH_MAX,
  spec.step
).map((w) => ({ value: String(w), label: formatPx(w) }))
const traceWidth = computed(() => String(opts.value.traceWidth))
const setTraceWidth: Setter<string> = (v) => set('traceWidth')(Number(v))

const I = OPTION_SCHEMA.inputs
const steeringChoices = computed(() =>
  choiceOptions(I.steeringStyle.values, t.value.settings.inputs.steeringChoices)
)
const hasTrace = computed(() => isElementVisible(opts.value.sections, 'trace'))
const infoShown = computed(() => isElementVisible(opts.value.sections, 'info'))
const showSteering = computed(
  () => infoShown.value && isElementVisible(opts.value.info, 'steering')
)

// The editors' words, with the hints of the parts that need one.
const sectionTexts = computed(() => {
  const base = elementTexts(t.value, 'inputs', 'sections')
  return {
    ...base,
    trace: { label: base.trace.label, hint: t.value.settings.inputs.traceSecondsHelp }
  }
})
const barTexts = computed(() => elementTexts(t.value, 'inputs', 'bars'))
const infoTexts = computed(() => elementTexts(t.value, 'inputs', 'info'))
const setSections = listSetter('inputs', 'sections')
const setBars = listSetter('inputs', 'bars')
const setInfo = listSetter('inputs', 'info')
</script>

<template>
  <PageSection :title="t.settings.common.content">
    <SliderControl
      :label="t.settings.inputs.traceSeconds"
      :help="t.settings.inputs.traceSecondsHelp"
      :current="opts.traceSeconds"
      :min="INPUTS_TRACE_MIN_S"
      :max="INPUTS_TRACE_MAX_S"
      :format="seconds"
      :disabled="!hasTrace"
      :apply="set('traceSeconds')"
    />
    <ChoiceControl
      :label="t.settings.inputs.traceWidth"
      :current="traceWidth"
      :options="WIDTH_CHOICES"
      :disabled="!hasTrace"
      :apply="setTraceWidth"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.inputs.clutchInTrace"
      :help="t.settings.inputs.clutchInTraceHelp"
      :current="opts.clutchInTrace"
      :disabled="!hasTrace"
      :apply="set('clutchInTrace')"
    />
    <ChoiceControl
      :label="t.settings.inputs.steeringStyle"
      :current="opts.steeringStyle"
      :options="steeringChoices"
      :disabled="!showSteering"
      :apply="set('steeringStyle')"
    />
  </PageSection>

  <CustomizeSection>
    <ElementEditor
      :title="zoneTitle(t, 'inputs', 'sections')"
      :items="opts.sections"
      :spec="I.sections"
      :labels="sectionTexts"
      :apply="setSections"
    />
    <ElementEditor
      :title="zoneTitle(t, 'inputs', 'bars')"
      :items="opts.bars"
      :spec="I.bars"
      :labels="barTexts"
      :apply="setBars"
    />
    <ElementEditor
      :title="zoneTitle(t, 'inputs', 'info')"
      :items="opts.info"
      :spec="I.info"
      :labels="infoTexts"
      :apply="setInfo"
    />
  </CustomizeSection>

  <PageSection :title="t.settings.inputs.colors" :note="t.settings.inputs.colorsNote">
    <ColorControl
      v-for="p in pedals"
      :key="p.key"
      :label="p.label"
      :current="opts.colors[p.key]"
      :presets="p.presets"
      :apply="p.apply"
    />
  </PageSection>
</template>
