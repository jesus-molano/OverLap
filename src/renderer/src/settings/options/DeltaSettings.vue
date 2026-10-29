<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible } from '@shared/elements'
import { DELTA_REFERENCE_FIELD } from '@shared/delta/choice'
import {
  DELTA_REFERENCE_VALUES,
  OPTION_SCHEMA,
  SHOW_IN_KINDS,
  type NumericSpec
} from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { elementToggle, optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import PersonalBestsSection from './PersonalBestsSection.vue'
import { decimalsOf, formatSeconds } from '../values'

const opts = useOptions('delta')
const t = useI18n()
const set = optionSetter('delta')

const referenceChoices = computed(() =>
  choiceOptions(DELTA_REFERENCE_VALUES, t.value.settings.delta.references)
)
/**
 * One choice per kind of session (DeltaOptions.reference*). Until the page gets its tidied
 * selector (package P4): three of today's choices, the race's fallback help.
 */
const kinds = computed(() =>
  SHOW_IN_KINDS.map((kind) => {
    const field = DELTA_REFERENCE_FIELD[kind]
    const current = opts.value[field]
    return {
      kind,
      field,
      current,
      label: t.value.settings.delta.sessions[kind],
      help: t.value.settings.delta.referenceHelp[current]
    }
  })
)

/** Where the fallback goes from the race's reference (DELTA_FALLBACK); the class best has none. */
const fallbackHelp = computed(() => {
  const d = t.value.settings.delta
  const r = opts.value.referenceRace
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
      v-for="k in kinds"
      :key="k.kind"
      :label="k.label"
      :help="k.help"
      stack
      :current="k.current"
      :options="referenceChoices"
      :apply="set(k.field)"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.delta.fallback"
      :help="fallbackHelp"
      :current="opts.fallback"
      :disabled="kinds.every((k) => k.current === 'class')"
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
        :current="isElementVisible(opts.top, 'predicted')"
        :apply="elementToggle('delta', 'top', 'predicted')"
      />
      <ToggleControl
        :label="t.settings.delta.sectors"
        :help="t.settings.delta.sectorsHelp"
        :current="isElementVisible(opts.rows, 'sectors')"
        :apply="elementToggle('delta', 'rows', 'sectors')"
      />
      <ToggleControl
        :label="t.settings.delta.trend"
        :help="t.settings.delta.trendHelp"
        :current="isElementVisible(opts.top, 'state')"
        :apply="elementToggle('delta', 'top', 'state')"
      />
    </CheckGroup>
  </PageSection>

  <PersonalBestsSection />
</template>
