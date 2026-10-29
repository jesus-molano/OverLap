<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible, visibleIds } from '@shared/elements'
import { DELTA_REFERENCE_FIELD } from '@shared/delta/choice'
import { referenceRowHelp } from './deltaHelp'
import {
  DELTA_REFERENCE_VALUES,
  OPTION_SCHEMA,
  SHOW_IN_KINDS,
  type NumericSpec
} from '@shared/settingsSchema'
import type { DeltaLapId, DeltaReference, ElementEntry } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useDeviceNames, useShortcuts } from '../../composables/useShortcuts'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import type { ChoiceOption } from '../controls/choice'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { bindingsText } from '../shortcutsView'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageAppendix from '../layout/PageAppendix.vue'
import PageSection from '../layout/PageSection.vue'
import PersonalBestsSection from './PersonalBestsSection.vue'
import { decimalsOf, formatSeconds } from '../values'

const opts = useOptions('delta')
const shortcuts = useShortcuts()
const deviceNames = useDeviceNames()
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
      // What it is, and where it falls back to: each session its own chain.
      help: referenceRowHelp(current, opts.value.fallback, t.value)
    }
  })
)

/** The switch itself: what it does (each chain is under its session), off, or nothing to do. */
const fallbackHelp = computed(() => {
  const d = t.value.settings.delta
  if (kinds.value.every((k) => k.current === 'class')) return d.fallbackLast
  return opts.value.fallback ? d.fallbackOn : d.fallbackOff
})

/** The cycle shortcut's keys, or where to give it some. */
const cycleText = computed(() => {
  // 'Ctrl+Alt+D', 'Botón 7 de G29 …' for a controller's button, 'Ctrl+Alt+D o Botón 7'.
  const keys = bindingsText(t.value, shortcuts.value.cycleDeltaReference, deviceNames.value)
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

/**
 * The lap times are a row of their own ('laps' in Filas), off by default: with it off, turning a
 * time on would change nothing you can see. So the list says so, and showing a time shows the row.
 */
const lapsRowShown = computed(() => isElementVisible(opts.value.rows, 'laps'))
const lapsNote = computed(() =>
  lapsRowShown.value ? undefined : t.value.settings.delta.lapTimesRowOff
)
async function applyLaps(next: ElementEntry<DeltaLapId>[]): Promise<unknown> {
  const done = setLaps(next)
  if (!lapsRowShown.value && visibleIds(next).length > 0) {
    await setRows(
      opts.value.rows.map((e) => (e.id === 'laps' ? { ...e, visible: true } : { ...e }))
    )
  }
  return done
}
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

  <CustomizeSection no-bars>
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
      :apply="applyLaps"
      :note="lapsNote"
    />
  </CustomizeSection>

  <PageAppendix>
    <PersonalBestsSection />
  </PageAppendix>
</template>

<style scoped>
.dl-cycle {
  display: block;
}
</style>
