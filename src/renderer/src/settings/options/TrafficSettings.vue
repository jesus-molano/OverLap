<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible } from '@shared/elements'
import { OPTION_SCHEMA, type NumericSpec } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { behaviourNote } from '../controls/previewNote'
import SliderControl from '../controls/SliderControl.vue'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import InfoBarEditor from '../elements/InfoBarEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'
import DriverSection from './DriverSection.vue'
import { formatSeconds } from '../values'

const opts = useOptions('traffic')
const t = useI18n()

/** Acts during the session only: the same note as every such option (PreviewNote). */
const behaviour = computed(() => behaviourNote(t.value))
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
  return {
    min: spec.min,
    max: spec.max,
    step,
    format: (s: number): string => formatSeconds(t.value, s),
    presets: presets.filter((p) => p >= spec.min && p <= spec.max)
  }
}

const S = OPTION_SCHEMA.traffic
const BEHIND = secondsSlider(S.behindS, [5, 12, 20, 30])
const AHEAD = secondsSlider(S.aheadS, [4, 8, 15, 30])
const HAZARD = secondsSlider(S.hazardS, [3, 5, 8, 12])
const ENTRIES: NumericSpec = S.maxEntries

const showFaster = computed(() => isElementVisible(opts.value.groups, 'faster'))
const showSlower = computed(() => isElementVisible(opts.value.groups, 'slower'))
const showHazards = computed(() => isElementVisible(opts.value.groups, 'hazard'))
const nothing = computed(() => !showFaster.value && !showSlower.value && !showHazards.value)
const noClasses = computed(() => !showFaster.value && !showSlower.value)

// One editor per zone: the groups (a hidden one is not looked for, their captions a switch of
// theirs), the cells of a car line, and the header and footer bars as on the other panels. The
// groups keep the hints their toggles had.
const groups = computed(() => {
  const tr = t.value.settings.traffic
  const l = elementTexts(t.value, 'traffic', 'groups')
  return {
    title: zoneTitle(t.value, 'traffic', 'groups'),
    labels: {
      hazard: { label: l.hazard.label, hint: tr.hazardsHelp },
      slower: { label: l.slower.label, hint: tr.slowerHelp },
      faster: { label: l.faster.label, hint: tr.fasterHelp }
    }
  }
})
const parts = computed(() => ({
  title: zoneTitle(t.value, 'traffic', 'parts'),
  labels: elementTexts(t.value, 'traffic', 'parts')
}))
const setGroups = listSetter('traffic', 'groups')
const setParts = listSetter('traffic', 'parts')
</script>

<template>
  <PageSection :title="t.settings.common.content" resets="content">
    <SliderControl
      v-if="showFaster"
      :label="t.settings.traffic.behind"
      :help="t.settings.traffic.behindHelp"
      :current="opts.behindS"
      :min="BEHIND.min"
      :max="BEHIND.max"
      :step="BEHIND.step"
      :format="BEHIND.format"
      :presets="BEHIND.presets"
      :apply="set('behindS')"
    />
    <SliderControl
      v-if="showSlower"
      :label="t.settings.traffic.ahead"
      :help="t.settings.traffic.aheadHelp"
      :current="opts.aheadS"
      :min="AHEAD.min"
      :max="AHEAD.max"
      :step="AHEAD.step"
      :format="AHEAD.format"
      :presets="AHEAD.presets"
      :apply="set('aheadS')"
    />
    <SliderControl
      v-if="showHazards"
      :label="t.settings.traffic.hazardRange"
      :help="t.settings.traffic.hazardRangeHelp"
      :current="opts.hazardS"
      :min="HAZARD.min"
      :max="HAZARD.max"
      :step="HAZARD.step"
      :format="HAZARD.format"
      :presets="HAZARD.presets"
      :apply="set('hazardS')"
    />
    <StepperControl
      v-if="!nothing"
      :label="t.settings.traffic.entries"
      :help="t.settings.traffic.entriesHelp"
      :current="opts.maxEntries"
      :min="ENTRIES.min"
      :max="ENTRIES.max"
      :apply="set('maxEntries')"
    />
    <ToggleControl
      v-if="!noClasses"
      kind="switch"
      :label="t.settings.traffic.multiclass"
      :help="t.settings.traffic.multiclassHelp"
      :current="opts.onlyMulticlass"
      :note="behaviour"
      :apply="set('onlyMulticlass')"
    />
  </PageSection>

  <!-- The «Piloto» block: the same rows here as in the other driver widgets (R08). -->
  <DriverSection section="traffic" />

  <CustomizeSection>
    <ElementEditor
      :title="groups.title"
      :items="opts.groups"
      :spec="S.groups"
      :labels="groups.labels"
      :apply="setGroups"
      empty-hides
    >
      <template #footer>
        <ToggleControl
          v-if="!nothing"
          kind="switch"
          :label="t.settings.traffic.captions"
          :help="t.settings.traffic.captionsHelp"
          :current="opts.captions"
          :apply="set('captions')"
        />
      </template>
    </ElementEditor>
    <ElementEditor
      :title="parts.title"
      :items="opts.parts"
      :spec="S.parts"
      :labels="parts.labels"
      :apply="setParts"
    />
    <InfoBarEditor section="traffic" field="headerBar" />
    <InfoBarEditor section="traffic" field="footerBar" />
  </CustomizeSection>
</template>
