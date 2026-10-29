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
import type { DeltaReference } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import type { ChoiceOption } from '../controls/choice'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import PageSection from '../layout/PageSection.vue'
import PersonalBestsSection from './PersonalBestsSection.vue'
import { decimalsOf, formatSeconds } from '../values'

const opts = useOptions('delta')
const shortcuts = useOptions('shortcuts')
const t = useI18n()
const set = optionSetter('delta')
const S = OPTION_SCHEMA.delta

/**
 * The short names fit one line in Spanish ('Óptima de clase'); the full name and what it is are
 * the hover hint.
 */
const referenceChoices = computed<readonly ChoiceOption<DeltaReference>[]>(() => {
  const d = t.value.settings.delta
  return DELTA_REFERENCE_VALUES.map((value) => ({
    value,
    label: d.referencesShort[value],
    hint: `${d.references[value].label}: ${d.references[value].hint}`
  }))
})

/** One row per kind of session (DeltaOptions.reference*), with what the choice is. */
const kinds = computed(() =>
  SHOW_IN_KINDS.map((kind) => {
    const field = DELTA_REFERENCE_FIELD[kind]
    const current = opts.value[field]
    return {
      kind,
      field,
      current,
      label: t.value.settings.delta.sessions[kind],
      help: t.value.settings.delta.references[current].hint
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

/** The cycle shortcut's keys, or where to give it some. */
const cycleText = computed(() => {
  const keys = shortcuts.value.cycleDeltaReference
  return keys !== '' ? t.value.settings.delta.cycleKeys(keys) : t.value.settings.delta.cycleNoKeys
})

const RANGE: NumericSpec = S.rangeS
const RANGE_STEP = RANGE.step ?? 0.1
const RANGE_PRESETS_S = [0.5, 1, 1.5, 2, 3].filter((s) => s >= RANGE.min && s <= RANGE.max)
/** Snapped values only: '0.5 s', '1 s', '1.25 s' (no trailing zeros). */
const rangeText = (s: number): string =>
  formatSeconds(s, Math.min(decimalsOf(RANGE_STEP), decimalsOf(s)))

// The editors' words, with the hints of the parts that need one.
const rowTexts = computed(() => {
  const d = t.value.settings.delta
  const base = elementTexts(t.value, 'delta', 'rows')
  return {
    ...base,
    sectors: { label: base.sectors.label, hint: d.sectorsHelp },
    laps: { label: base.laps.label, hint: d.lapTimesHelp }
  }
})
const topTexts = computed(() => {
  const d = t.value.settings.delta
  const base = elementTexts(t.value, 'delta', 'top')
  return {
    ...base,
    state: { label: base.state.label, hint: d.trendHelp },
    predicted: { label: base.predicted.label, hint: d.predictedHelp }
  }
})
const lapTexts = computed(() => elementTexts(t.value, 'delta', 'laps'))

const setRows = listSetter('delta', 'rows')
const setTop = listSetter('delta', 'top')
const setLaps = listSetter('delta', 'laps')
</script>

<template>
  <PageSection
    :title="t.settings.delta.referenceBySession"
    :note="t.settings.delta.referenceBySessionNote"
  >
    <ChoiceControl
      v-for="k in kinds"
      :key="k.kind"
      :label="k.label"
      :help="k.help"
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
    <p class="st-row st-help dl-cycle">{{ cycleText }}</p>
  </PageSection>

  <PageSection :title="t.settings.common.content" :note="t.settings.delta.referenceNote">
    <SliderControl
      :label="t.settings.delta.range"
      :help="t.settings.delta.rangeHelp"
      :current="opts.rangeS"
      :min="RANGE.min"
      :max="RANGE.max"
      :step="RANGE_STEP"
      :format="rangeText"
      :presets="RANGE_PRESETS_S"
      :disabled="!isElementVisible(opts.rows, 'bar')"
      :apply="set('rangeS')"
    />
  </PageSection>

  <ElementEditor
    :title="zoneTitle(t, 'delta', 'rows')"
    :items="opts.rows"
    :spec="S.rows"
    :labels="rowTexts"
    :apply="setRows"
  />
  <ElementEditor
    :title="zoneTitle(t, 'delta', 'top')"
    :items="opts.top"
    :spec="S.top"
    :labels="topTexts"
    :apply="setTop"
  />
  <ElementEditor
    :title="zoneTitle(t, 'delta', 'laps')"
    :items="opts.laps"
    :spec="S.laps"
    :labels="lapTexts"
    :apply="setLaps"
  />

  <PersonalBestsSection />
</template>

<style scoped>
.dl-cycle {
  display: block;
}
</style>
