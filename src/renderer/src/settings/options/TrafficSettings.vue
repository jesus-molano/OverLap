<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible } from '@shared/elements'
import { OPTION_SCHEMA, type NumericSpec } from '@shared/settingsSchema'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { inherit } from '../../view/appearance'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { nameExample, nameFormatChoicesInherit } from '../controls/choices'
import SliderControl from '../controls/SliderControl.vue'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { elementToggle, optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import { decimalsOf, formatSeconds } from '../values'

const opts = useOptions('traffic')
const appearance = useAppearance()
const t = useI18n()
const set = optionSetter('traffic')

interface SecondsSlider {
  readonly min: number
  readonly max: number
  readonly step: number
  readonly format: (s: number) => string
  readonly presets: readonly number[]
}

/** A seconds slider of the schema: its range, step, format and the presets inside its range. */
function secondsSlider(spec: NumericSpec, presets: readonly number[]): SecondsSlider {
  const step = spec.step ?? 1
  const decimals = decimalsOf(step)
  return {
    min: spec.min,
    max: spec.max,
    step,
    format: (s: number): string => formatSeconds(s, decimals),
    presets: presets.filter((p) => p >= spec.min && p <= spec.max)
  }
}

const S = OPTION_SCHEMA.traffic
const BEHIND = secondsSlider(S.behindS, [5, 12, 20, 30])
const AHEAD = secondsSlider(S.aheadS, [4, 8, 15, 30])
const HAZARD = secondsSlider(S.hazardS, [3, 5, 8, 12])
const ENTRIES: NumericSpec = S.maxEntries

// Until this page gets the element editors (package P3): one toggle per group.
const showFaster = computed(() => isElementVisible(opts.value.groups, 'faster'))
const showSlower = computed(() => isElementVisible(opts.value.groups, 'slower'))
const showHazards = computed(() => isElementVisible(opts.value.groups, 'hazard'))
const nothing = computed(() => !showFaster.value && !showSlower.value && !showHazards.value)
const noClasses = computed(() => !showFaster.value && !showSlower.value)

const nameChoices = computed(() => nameFormatChoicesInherit(t.value, appearance.value.nameFormat))
const nameHelp = computed(() =>
  nameExample(t.value, inherit(opts.value.nameFormat, appearance.value.nameFormat))
)
</script>

<template>
  <PageSection :title="t.settings.common.content">
    <CheckGroup
      :legend="t.settings.traffic.warnAbout"
      :help="nothing ? t.settings.traffic.nothing : undefined"
      :warn="nothing"
    >
      <ToggleControl
        :label="t.settings.traffic.faster"
        :help="t.settings.traffic.fasterHelp"
        :current="showFaster"
        :apply="elementToggle('traffic', 'groups', 'faster')"
      />
      <ToggleControl
        :label="t.settings.traffic.slower"
        :help="t.settings.traffic.slowerHelp"
        :current="showSlower"
        :apply="elementToggle('traffic', 'groups', 'slower')"
      />
      <ToggleControl
        :label="t.settings.traffic.hazards"
        :help="t.settings.traffic.hazardsHelp"
        :current="showHazards"
        :apply="elementToggle('traffic', 'groups', 'hazard')"
      />
    </CheckGroup>
    <SliderControl
      :label="t.settings.traffic.behind"
      :help="t.settings.traffic.behindHelp"
      :current="opts.behindS"
      :min="BEHIND.min"
      :max="BEHIND.max"
      :step="BEHIND.step"
      :format="BEHIND.format"
      :presets="BEHIND.presets"
      :disabled="!showFaster"
      :apply="set('behindS')"
    />
    <SliderControl
      :label="t.settings.traffic.ahead"
      :help="t.settings.traffic.aheadHelp"
      :current="opts.aheadS"
      :min="AHEAD.min"
      :max="AHEAD.max"
      :step="AHEAD.step"
      :format="AHEAD.format"
      :presets="AHEAD.presets"
      :disabled="!showSlower"
      :apply="set('aheadS')"
    />
    <SliderControl
      :label="t.settings.traffic.hazardRange"
      :help="t.settings.traffic.hazardRangeHelp"
      :current="opts.hazardS"
      :min="HAZARD.min"
      :max="HAZARD.max"
      :step="HAZARD.step"
      :format="HAZARD.format"
      :presets="HAZARD.presets"
      :disabled="!showHazards"
      :apply="set('hazardS')"
    />
    <StepperControl
      :label="t.settings.traffic.entries"
      :help="t.settings.traffic.entriesHelp"
      :current="opts.maxEntries"
      :min="ENTRIES.min"
      :max="ENTRIES.max"
      :disabled="nothing"
      :apply="set('maxEntries')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.traffic.multiclass"
      :help="t.settings.traffic.multiclassHelp"
      :current="opts.onlyMulticlass"
      :disabled="noClasses"
      :apply="set('onlyMulticlass')"
    />
    <ChoiceControl
      :label="t.settings.common.nameFormat"
      :help="nameHelp"
      stack
      :current="opts.nameFormat"
      :options="nameChoices"
      :apply="set('nameFormat')"
    />
  </PageSection>
</template>
