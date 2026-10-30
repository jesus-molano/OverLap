<script setup lang="ts">
import { computed } from 'vue'
import {
  INPUTS_TRACE_MAX_S,
  INPUTS_TRACE_MIN_S,
  INPUTS_TRACE_WIDTH_MAX,
  INPUTS_TRACE_WIDTH_MIN
} from '@shared/settings'
import { ACCENT_PRESETS, OPTION_SCHEMA, PEDAL_COLOR_PRESETS } from '@shared/settingsSchema'
import type { InputsOptions } from '@shared/types'
import { useAppearance } from '../../composables/useAppearance'
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
import { useParentGate } from '../elements/parentGate'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import { formatPx, formatSeconds, stepValues } from '../values'

const opts = useOptions('inputs')
const t = useI18n()
const set = optionSetter('inputs')
const seconds = (s: number): string => formatSeconds(t.value, s)
/** The trace's length: the same quick buttons as every other seconds slider. */
const TRACE_PRESETS_S = [3, 5, 8, 10].filter(
  (s) => s >= INPUTS_TRACE_MIN_S && s <= INPUTS_TRACE_MAX_S
)

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
  const colorNames = t.value.settings.inputs.pedalColors
  return PEDALS.map((key) => {
    const label = names[key]
    return {
      key,
      label: colorNames[key],
      presets: PEDAL_COLOR_PRESETS[key].map((value, i) => ({ value, label: `${label} ${i + 1}` })),
      apply: PEDAL_SETTERS[key]
    }
  })
})

const spec = OPTION_SCHEMA.inputs.traceWidth
const WIDTHS = stepValues(INPUTS_TRACE_WIDTH_MIN, INPUTS_TRACE_WIDTH_MAX, spec.step)
const widthChoices = computed<readonly ChoiceOption<string>[]>(() =>
  WIDTHS.map((w) => ({ value: String(w), label: formatPx(t.value, w) }))
)
const traceWidth = computed(() => String(opts.value.traceWidth))
const setTraceWidth: Setter<string> = (v) => set('traceWidth')(Number(v))

const I = OPTION_SCHEMA.inputs
const steeringChoices = computed(() =>
  choiceOptions(I.steeringStyle.values, t.value.settings.inputs.steeringChoices)
)
/** The size and the mark are a wheel's: not the bar's. */
const showWheel = computed(() => opts.value.steeringStyle !== 'bar')
const wheelSizeChoices = computed(() =>
  choiceOptions(I.wheelSize.values, t.value.settings.inputs.wheelSizeChoices)
)
// Worded again only when the language changes.
const accentPresets = computed(() => {
  const names = t.value.settings.appearance.color.accentNames
  return ACCENT_PRESETS.map((p) => ({ value: p.value, label: names[p.name] }))
})

/** «Global (acento)» first (R46), as «Global (…)» everywhere: the mark follows Apariencia's accent. */
const appearance = useAppearance()
const wheelInherit = computed(() => ({
  label: t.value.settings.inputs.wheelColorAccent,
  color: appearance.value.accent
}))

/** The widget's fixed top strip (R12): a row with its eye, above the blocks it sits over. */
const setShiftLights = set('shiftLights')
const shiftRow = computed(() => [
  {
    key: 'shiftLights',
    label: t.value.settings.inputs.shiftLights,
    hint: t.value.settings.inputs.shiftLightsRow,
    visible: opts.value.shiftLights,
    toggle: (v: boolean) => void setShiftLights(v)
  }
])
/**
 * The steering row's folded options (R12, as the trace's): its look, said on its button
 * ('Realista · Mediano', 'Barra').
 */
const steeringSummary = computed(() => {
  const i = t.value.settings.inputs
  const style = i.steeringChoices[opts.value.steeringStyle].label
  const size = i.wheelSizeChoices[opts.value.wheelSize].label
  return { steering: showWheel.value ? `${style} · ${size}` : style }
})
/** The trace row's folded options, said on its button ('8 s · 2 px'). */
const traceSummary = computed(() => ({
  trace: `${seconds(opts.value.traceSeconds)} · ${formatPx(t.value, opts.value.traceWidth)}`
}))

// The editors' words (the trace's options say themselves on its row's button).
const sectionTexts = computed(() => elementTexts(t.value, 'inputs', 'sections'))
const barTexts = computed(() => elementTexts(t.value, 'inputs', 'bars'))
const infoTexts = computed(() => elementTexts(t.value, 'inputs', 'info'))
const carTexts = computed(() => elementTexts(t.value, 'inputs', 'car'))
const setSections = listSetter('inputs', 'sections')
const setBars = listSetter('inputs', 'bars')
const setInfo = listSetter('inputs', 'info')
const setCar = listSetter('inputs', 'car')
/**
 * The «Datos» and «Coche» items are drawn in their block of «Bloques»: while it is hidden the
 * list says so, and showing an item shows the block (useParentGate, as Delta's lines).
 */
const sectionsTitle = (): string => zoneTitle(t.value, 'inputs', 'sections')
const infoGate = useParentGate({
  parents: () => opts.value.sections,
  parent: 'info',
  setParents: setSections,
  items: () => opts.value.info,
  set: setInfo,
  parentLabel: () => sectionTexts.value.info.label,
  zoneLabel: sectionsTitle
})
const carGate = useParentGate({
  parents: () => opts.value.sections,
  parent: 'car',
  setParents: setSections,
  items: () => opts.value.car,
  set: setCar,
  parentLabel: () => sectionTexts.value.car.label,
  zoneLabel: sectionsTitle
})
</script>

<template>
  <!-- No Contenido: every option is how a part is drawn, on its row (R12). -->
  <CustomizeSection>
    <!--
      The shift lights are the widget's fixed top strip, shown or hidden by their eye; the trace's
      options unfold in its row; the pedals' colours (the bars' and the trace's) below the list.
    -->
    <ElementEditor
      :title="zoneTitle(t, 'inputs', 'sections')"
      :items="opts.sections"
      :spec="I.sections"
      :labels="sectionTexts"
      :fixed-before="shiftRow"
      :parts-of="['trace']"
      :parts-summary="traceSummary"
      :apply="setSections"
    >
      <template #parts="{ id }">
        <div v-if="id === 'trace'" class="in-trace">
          <SliderControl
            :label="t.settings.inputs.traceSeconds"
            :help="t.settings.inputs.traceSecondsHelp"
            :current="opts.traceSeconds"
            :min="INPUTS_TRACE_MIN_S"
            :max="INPUTS_TRACE_MAX_S"
            :format="seconds"
            :presets="TRACE_PRESETS_S"
            :apply="set('traceSeconds')"
          />
          <ChoiceControl
            :label="t.settings.inputs.traceWidth"
            :current="traceWidth"
            :options="widthChoices"
            :apply="setTraceWidth"
          />
          <ToggleControl
            kind="switch"
            :label="t.settings.inputs.clutchInTrace"
            :help="t.settings.inputs.clutchInTraceHelp"
            :current="opts.clutchInTrace"
            :apply="set('clutchInTrace')"
          />
        </div>
      </template>
      <template #footer>
        <ColorControl
          v-for="p in pedals"
          :key="p.key"
          :label="p.label"
          :current="opts.colors[p.key]"
          :presets="p.presets"
          :apply="p.apply"
        />
        <p class="st-row st-help in-colors-note">{{ t.settings.inputs.colorsNote }}</p>
      </template>
    </ElementEditor>
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
      :parts-of="['steering']"
      :parts-summary="steeringSummary"
      :apply="infoGate.apply"
      :note="infoGate.note.value"
    >
      <!-- The wheel's options in its own row (R12), folded as the trace's: its look, its degrees. -->
      <template #parts="{ id }">
        <div v-if="id === 'steering'" class="in-trace">
          <ChoiceControl
            :label="t.settings.inputs.steeringStyle"
            :current="opts.steeringStyle"
            :options="steeringChoices"
            :apply="set('steeringStyle')"
          />
          <ChoiceControl
            v-if="showWheel"
            :label="t.settings.inputs.wheelSize"
            :current="opts.wheelSize"
            :options="wheelSizeChoices"
            :apply="set('wheelSize')"
          />
          <ColorControl
            v-if="showWheel"
            :label="t.settings.inputs.wheelColor"
            :help="t.settings.inputs.wheelColorHelp"
            :current="opts.wheelColor"
            :presets="accentPresets"
            :inherit="wheelInherit"
            :apply="set('wheelColor')"
          />
          <ToggleControl
            kind="switch"
            :label="t.settings.inputs.steeringDegrees"
            :help="t.settings.inputs.steeringDegreesHelp"
            :current="opts.steeringDegrees"
            :apply="set('steeringDegrees')"
          />
        </div>
      </template>
    </ElementEditor>
    <ElementEditor
      :title="zoneTitle(t, 'inputs', 'car')"
      :items="opts.car"
      :spec="I.car"
      :labels="carTexts"
      :apply="carGate.apply"
      :note="carGate.note.value"
    />
  </CustomizeSection>
</template>

<style scoped>
.in-colors-note {
  display: block;
}

.in-trace {
  display: flex;
  flex-direction: column;
}
</style>
