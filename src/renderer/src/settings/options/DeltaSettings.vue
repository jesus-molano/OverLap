<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible, visibleIds } from '@shared/elements'
import { DELTA_REFERENCE_FIELD, type DeltaReferenceField } from '@shared/delta/choice'
import type { SessionKind } from '@shared/sessionInfo'
import { previewSession } from '../../widgets/delta/preview'
import { referenceRowHelp } from './deltaHelp'
import {
  DELTA_REFERENCE_VALUES,
  OPTION_SCHEMA,
  SHOW_IN_KINDS,
  type NumericSpec
} from '@shared/settingsSchema'
import type { DeltaReference, DeltaRowId, ElementEntry } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useDeviceNames, useShortcuts } from '../../composables/useShortcuts'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { behaviourNote } from '../controls/previewNote'
import type { ChoiceOption } from '../controls/choice'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter, type Setter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { useParentGate } from '../elements/parentGate'
import { bindingsText } from '../shortcutsView'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageAppendix from '../layout/PageAppendix.vue'
import PageSection from '../layout/PageSection.vue'
import PersonalBestsSection from './PersonalBestsSection.vue'
import { formatSeconds, snapToStep } from '../values'

const opts = useOptions('delta')
const shortcuts = useShortcuts()
const deviceNames = useDeviceNames()
const t = useI18n()

/** Acts during the session only: the same note as every such option (PreviewNote). */
const behaviour = computed(() => behaviourNote(t.value))
const set = optionSetter('delta')
const S = OPTION_SCHEMA.delta

/** Each reference by its full name (R21), what it is as its hint; under the label (they wrap). */
const referenceChoices = computed<readonly ChoiceOption<DeltaReference>[]>(() => {
  const d = t.value.settings.delta
  return DELTA_REFERENCE_VALUES.map((value) => ({
    value,
    label: d.references[value].label,
    hint: d.references[value].hint
  }))
})

/** A reference changed: the preview draws that session's (previewSession). */
function setReference(kind: SessionKind, field: DeltaReferenceField): Setter<DeltaReference> {
  return (v) => {
    previewSession.value = kind
    return set(field)(v)
  }
}
/** 'La vista previa usa la de Carrera: Vuelta óptima'. */
const previewNote = computed(() => {
  const d = t.value.settings.delta
  const kind = previewSession.value
  const ref = opts.value[DELTA_REFERENCE_FIELD[kind]]
  return d.previewShows(d.sessions[kind], d.references[ref].label)
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
/** Snapped values only: '0,5 s', '1 s', '1,25 s' (no trailing zeros). */
const rangeText = (s: number): string => formatSeconds(t.value, snapToStep(s, RANGE_STEP, 0))

// The editors' words, with the hints of the parts that need one.
const rowTexts = computed(() => {
  const d = t.value.settings.delta
  const base = elementTexts(t.value, 'delta', 'rows')
  return {
    ...base,
    sectors: { label: base.sectors.label, hint: d.sectorsHelp },
    laps: { label: base.laps.label, hint: d.lapTimesHelp },
    refs: { label: base.refs.label, hint: d.refBarsHelp }
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
const refBarTexts = computed(() => elementTexts(t.value, 'delta', 'refBars'))

/** The lines that unfold to their parts, and what is shown of them ('2 de 3 partes'). */
const PARTS_OF: readonly DeltaRowId[] = ['top', 'refs', 'laps']
const partsSummary = computed(() => {
  const e = t.value.settings.elements
  const count = (l: readonly ElementEntry<string>[]): string =>
    e.partsCount(visibleIds(l).length, l.length)
  return {
    top: count(opts.value.top),
    refs: count(opts.value.refBars),
    laps: count(opts.value.laps)
  }
})
const setRows = listSetter('delta', 'rows')
const setTop = listSetter('delta', 'top')
const setLaps = listSetter('delta', 'laps')
const setRefBars = listSetter('delta', 'refBars')

/**
 * The lap times are drawn in a line of their own ('laps' in Líneas), off by default: with it off,
 * showing a time would change nothing you can see. So the list says so, and showing a time shows
 * the line (useParentGate, as Pedales' blocks). The top line is always shown: no such note.
 */
const lapsGate = useParentGate({
  parents: () => opts.value.rows,
  parent: 'laps',
  setParents: setRows,
  items: () => opts.value.laps,
  set: setLaps,
  parentLabel: () => rowTexts.value.laps.label,
  zoneLabel: () => zoneTitle(t.value, 'delta', 'rows')
})
/** The bars per reference likewise: a line of their own, off by default. */
const refBarsGate = useParentGate({
  parents: () => opts.value.rows,
  parent: 'refs',
  setParents: setRows,
  items: () => opts.value.refBars,
  set: setRefBars,
  parentLabel: () => rowTexts.value.refs.label,
  zoneLabel: () => zoneTitle(t.value, 'delta', 'rows')
})
</script>

<template>
  <PageSection
    :title="t.settings.common.content"
    resets="content"
    :note="t.settings.delta.referenceBySessionNote"
  >
    <ChoiceControl
      v-for="k in kinds"
      :key="k.kind"
      :label="k.label"
      :help="k.help"
      stack
      :current="k.current"
      :options="referenceChoices"
      :apply="setReference(k.kind, k.field)"
    />
    <p class="st-row st-help dl-cycle">{{ previewNote }}</p>
    <ToggleControl
      v-if="!kinds.every((k) => k.current === 'class')"
      kind="switch"
      :label="t.settings.delta.fallback"
      :help="fallbackHelp"
      :current="opts.fallback"
      :note="behaviour"
      :apply="set('fallback')"
    />
    <p class="st-row st-help dl-cycle">{{ cycleText }}</p>
    <SliderControl
      v-if="isElementVisible(opts.rows, 'bar') || isElementVisible(opts.rows, 'refs')"
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
  </PageSection>

  <!-- One list (R21): each line, and under the top line and the lap times their parts. -->
  <CustomizeSection>
    <ElementEditor
      :title="zoneTitle(t, 'delta', 'rows')"
      :items="opts.rows"
      :spec="S.rows"
      :labels="rowTexts"
      :apply="setRows"
      :parts-of="PARTS_OF"
      :parts-summary="partsSummary"
    >
      <template #parts="{ id }">
        <ElementEditor
          v-if="id === 'top'"
          embedded
          :title="zoneTitle(t, 'delta', 'top')"
          :items="opts.top"
          :spec="S.top"
          :labels="topTexts"
          :apply="setTop"
        />
        <ElementEditor
          v-else-if="id === 'refs'"
          embedded
          :title="zoneTitle(t, 'delta', 'refBars')"
          :items="opts.refBars"
          :spec="S.refBars"
          :labels="refBarTexts"
          :apply="refBarsGate.apply"
          :note="refBarsGate.note.value"
        />
        <ElementEditor
          v-else
          embedded
          :title="zoneTitle(t, 'delta', 'laps')"
          :items="opts.laps"
          :spec="S.laps"
          :labels="lapTexts"
          :apply="lapsGate.apply"
          :note="lapsGate.note.value"
        />
      </template>
    </ElementEditor>
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
