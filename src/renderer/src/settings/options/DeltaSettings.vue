<script setup lang="ts">
import { computed } from 'vue'
import { OPTION_SCHEMA, type NumericSpec } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import PersonalBestsSection from './PersonalBestsSection.vue'
import { decimalsOf, formatSeconds } from '../values'

const opts = useOptions('delta')
const t = useI18n()
const set = optionSetter('delta')

const referenceChoices = computed(() =>
  choiceOptions(OPTION_SCHEMA.delta.reference.values, t.value.settings.delta.references)
)
/** What the chosen reference is, under the choice. */
const referenceHelp = computed(() => t.value.settings.delta.referenceHelp[opts.value.reference])

/** Where the fallback goes from each reference (pb → session → class). */
const fallbackHelp = computed(() => {
  const d = t.value.settings.delta
  const r = opts.value.reference
  if (r === 'class') return d.fallbackHelp.class
  return opts.value.fallback ? d.fallbackHelp[r] : d.fallbackOff
})

const RANGE: NumericSpec = OPTION_SCHEMA.delta.rangeS
const RANGE_STEP = RANGE.step ?? 0.1
const RANGE_PRESETS_S = [0.5, 1, 1.5, 2, 3].filter((s) => s >= RANGE.min && s <= RANGE.max)
/** Snapped values only: '0.5 s', '1 s', '1.25 s' (no trailing zeros). */
const rangeText = (s: number): string =>
  formatSeconds(s, Math.min(decimalsOf(RANGE_STEP), decimalsOf(s)))
</script>

<template>
  <PageSection :title="t.settings.delta.reference" :note="t.settings.delta.referenceNote">
    <ChoiceControl
      :label="t.settings.delta.compareWith"
      :help="referenceHelp"
      stack
      :current="opts.reference"
      :options="referenceChoices"
      :apply="set('reference')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.delta.fallback"
      :help="fallbackHelp"
      :current="opts.fallback"
      :disabled="opts.reference === 'class'"
      :apply="set('fallback')"
    />
  </PageSection>

  <PageSection :title="t.settings.common.content">
    <SliderControl
      :label="t.settings.delta.range"
      :help="t.settings.delta.rangeHelp"
      :current="opts.rangeS"
      :min="RANGE.min"
      :max="RANGE.max"
      :step="RANGE_STEP"
      :format="rangeText"
      :presets="RANGE_PRESETS_S"
      :apply="set('rangeS')"
    />
    <CheckGroup :legend="t.settings.common.show">
      <ToggleControl
        :label="t.settings.delta.predicted"
        :help="t.settings.delta.predictedHelp"
        :current="opts.showPredicted"
        :apply="set('showPredicted')"
      />
      <ToggleControl
        :label="t.settings.delta.sectors"
        :help="t.settings.delta.sectorsHelp"
        :current="opts.showSectors"
        :apply="set('showSectors')"
      />
      <ToggleControl
        :label="t.settings.delta.trend"
        :help="t.settings.delta.trendHelp"
        :current="opts.showTrend"
        :apply="set('showTrend')"
      />
    </CheckGroup>
  </PageSection>

  <PersonalBestsSection />
</template>
