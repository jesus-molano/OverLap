<script setup lang="ts">
import { computed } from 'vue'
import {
  BATTLE_HOLD_MAX_S,
  BATTLE_HOLD_MIN_S,
  BATTLE_THRESHOLD_MAX_S,
  BATTLE_THRESHOLD_MIN_S
} from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { behaviourNote } from '../controls/previewNote'
import { choiceOptions } from '../controls/choice'
import SliderControl from '../controls/SliderControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import InfoBarEditor from '../elements/InfoBarEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'
import { useNoRoom } from '../preview/useNoRoom'
import DriverSection from './DriverSection.vue'
import { formatSeconds } from '../values'

const opts = useOptions('battle')
const t = useI18n()

/** Acts during the session only: the same note as every such option (PreviewNote). */
const behaviour = computed(() => behaviourNote(t.value))
const set = optionSetter('battle')

const THRESHOLD_PRESETS_S = [0.5, 1, 1.5, 2, 3] as const
const HOLD_PRESETS_S = [0, 3, 5] as const
const seconds = (s: number): string => formatSeconds(t.value, s)

const B = OPTION_SCHEMA.battle
const layoutChoices = computed(() =>
  choiceOptions(B.layout.values, t.value.settings.battle.layoutChoices)
)

// One editor per zone: the rivals (a hidden one is not looked for), the rows under the headline
// and the extras of each lane.
const lanes = computed(() => ({
  title: zoneTitle(t.value, 'battle', 'lanes'),
  labels: elementTexts(t.value, 'battle', 'lanes')
}))
// The hints the old toggles had, on the rows they became.
const rows = computed(() => {
  const b = t.value.settings.battle
  const l = elementTexts(t.value, 'battle', 'rows')
  return {
    title: zoneTitle(t.value, 'battle', 'rows'),
    labels: {
      prediction: { label: l.prediction.label, hint: b.predictionHelp },
      sectors: { label: l.sectors.label, hint: b.detailChoices.sectors.hint },
      laps: { label: l.laps.label, hint: b.detailChoices.laps.hint }
    }
  }
})
const parts = computed(() => {
  const l = elementTexts(t.value, 'battle', 'parts')
  return {
    title: zoneTitle(t.value, 'battle', 'parts'),
    labels: {
      ...l,
      rating: { label: l.rating.label, hint: t.value.settings.battle.ratingHelp },
      license: { label: l.license.label, hint: t.value.settings.battle.licenseHelp },
      stake: { label: l.stake.label, hint: t.value.settings.battle.atStakeHelp }
    }
  }
})
const setLanes = listSetter('battle', 'lanes')
const setRows = listSetter('battle', 'rows')
const setParts = listSetter('battle', 'parts')
/** «Lado a lado» in a window too narrow for it: drawn stacked, and said so. */
const noRoom = useNoRoom()
</script>

<template>
  <PageSection :title="t.settings.common.content" resets="content">
    <SliderControl
      :label="t.settings.battle.threshold"
      :help="t.settings.battle.thresholdHelp"
      :current="opts.thresholdS"
      :min="BATTLE_THRESHOLD_MIN_S"
      :max="BATTLE_THRESHOLD_MAX_S"
      :step="B.thresholdS.step"
      :format="seconds"
      :presets="THRESHOLD_PRESETS_S"
      :note="behaviour"
      :apply="set('thresholdS')"
    />
    <SliderControl
      :label="t.settings.common.keepVisible"
      :help="t.settings.battle.holdHelp"
      :current="opts.holdS"
      :min="BATTLE_HOLD_MIN_S"
      :max="BATTLE_HOLD_MAX_S"
      :step="B.holdS.step"
      :format="seconds"
      :presets="HOLD_PRESETS_S"
      :note="behaviour"
      :apply="set('holdS')"
    />
    <ChoiceControl
      :label="t.settings.common.layout"
      :current="opts.layout"
      :options="layoutChoices"
      :note="noRoom('battle.layout.side', t.settings.preview.noRoomSide)"
      :apply="set('layout')"
    />
  </PageSection>

  <!-- The «Piloto» block: the same rows here as in the other driver widgets (R08). -->
  <DriverSection section="battle" />

  <CustomizeSection>
    <ElementEditor
      :title="lanes.title"
      :items="opts.lanes"
      :spec="B.lanes"
      :labels="lanes.labels"
      :apply="setLanes"
      empty-hides
    />
    <ElementEditor
      :title="rows.title"
      :items="opts.rows"
      :spec="B.rows"
      :labels="rows.labels"
      :apply="setRows"
    />
    <ElementEditor
      :title="parts.title"
      :items="opts.parts"
      :spec="B.parts"
      :labels="parts.labels"
      :apply="setParts"
    >
      <template #footer> </template>
    </ElementEditor>
    <InfoBarEditor section="battle" field="headerBar" />
    <InfoBarEditor section="battle" field="footerBar" />
  </CustomizeSection>
</template>
