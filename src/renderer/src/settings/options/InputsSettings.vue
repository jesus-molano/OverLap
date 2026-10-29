<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible, setElementVisible } from '@shared/elements'
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
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions, type ChoiceOption } from '../controls/choice'
import ColorControl from '../controls/ColorControl.vue'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import {
  currentList,
  elementToggle,
  listSetter,
  optionSetter,
  updateSection,
  type Setter
} from '../editor'
import {
  INPUTS_LAYOUTS,
  inputsLayout,
  sectionsOf,
  type InputsLayout
} from '../../widgets/inputs/layout'
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
// Until this page gets the element editors (package P4): the old layout choice and toggles,
// read from and written to the lists.
const layoutChoices = computed(() =>
  choiceOptions(INPUTS_LAYOUTS, t.value.settings.inputs.layoutChoices)
)
const layout = computed(() => inputsLayout(opts.value.sections))
const setLayout: Setter<InputsLayout> = (l) => listSetter('inputs', 'sections')(sectionsOf(l))
const showSteering = computed(() => isElementVisible(opts.value.info, 'steering'))
const showGearSpeed = computed(() => isElementVisible(opts.value.info, 'gear'))
const setGearSpeed: Setter<boolean> = (on) =>
  listSetter(
    'inputs',
    'info'
  )(setElementVisible(setElementVisible(currentList('inputs', 'info'), 'gear', on), 'speed', on))
</script>

<template>
  <PageSection :title="t.settings.common.content">
    <ChoiceControl
      :label="t.settings.common.layout"
      stack
      :current="layout"
      :options="layoutChoices"
      :apply="setLayout"
    />
    <SliderControl
      :label="t.settings.inputs.traceSeconds"
      :help="t.settings.inputs.traceSecondsHelp"
      :current="opts.traceSeconds"
      :min="INPUTS_TRACE_MIN_S"
      :max="INPUTS_TRACE_MAX_S"
      :format="seconds"
      :disabled="layout === 'bars'"
      :apply="set('traceSeconds')"
    />
    <ChoiceControl
      :label="t.settings.inputs.traceWidth"
      :current="traceWidth"
      :options="WIDTH_CHOICES"
      :disabled="layout === 'bars'"
      :apply="setTraceWidth"
    />
    <CheckGroup :legend="t.settings.common.show">
      <ToggleControl
        :label="t.settings.inputs.pedals.clutch"
        :current="isElementVisible(opts.bars, 'clutch')"
        :apply="elementToggle('inputs', 'bars', 'clutch')"
      />
      <ToggleControl
        :label="t.settings.inputs.clutchInTrace"
        :help="t.settings.inputs.clutchInTraceHelp"
        :current="opts.clutchInTrace"
        :apply="set('clutchInTrace')"
      />
      <ToggleControl
        :label="t.settings.inputs.steering"
        :current="showSteering"
        :apply="elementToggle('inputs', 'info', 'steering')"
      />
      <ToggleControl
        :label="t.settings.inputs.gearSpeed"
        :current="showGearSpeed"
        :apply="setGearSpeed"
      />
    </CheckGroup>
    <ChoiceControl
      :label="t.settings.inputs.steeringStyle"
      :current="opts.steeringStyle"
      :options="steeringChoices"
      :disabled="!showSteering"
      :apply="set('steeringStyle')"
    />
  </PageSection>

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
