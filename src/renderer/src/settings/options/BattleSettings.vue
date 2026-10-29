<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible, setElementVisible } from '@shared/elements'
import {
  BATTLE_HOLD_MAX_S,
  BATTLE_HOLD_MIN_S,
  BATTLE_THRESHOLD_MAX_S,
  BATTLE_THRESHOLD_MIN_S
} from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { inherit } from '../../view/appearance'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import { nameExample, nameFormatChoicesInherit } from '../controls/choices'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { currentList, elementToggle, listSetter, optionSetter, type Setter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import { formatSeconds } from '../values'

const opts = useOptions('battle')
const appearance = useAppearance()
const t = useI18n()
const set = optionSetter('battle')

const THRESHOLD_PRESETS_S = [0.5, 1, 1.5, 2, 3] as const
const HOLD_PRESETS_S = [0, 3, 5] as const
const tenths = (s: number): string => formatSeconds(s, 1)

const B = OPTION_SCHEMA.battle
const layoutChoices = computed(() =>
  choiceOptions(B.layout.values, t.value.settings.battle.layoutChoices)
)
// Until this page gets the element editors (package P3): the old detail choice, read from and
// written to the rows' sector and lap chips.
type Detail = 'none' | 'sectors' | 'laps' | 'both'
const DETAILS = ['none', 'sectors', 'laps', 'both'] as const satisfies readonly Detail[]
const detailChoices = computed(() => choiceOptions(DETAILS, t.value.settings.battle.detailChoices))
const detail = computed<Detail>(() => {
  const sectors = isElementVisible(opts.value.rows, 'sectors')
  const laps = isElementVisible(opts.value.rows, 'laps')
  return sectors && laps ? 'both' : sectors ? 'sectors' : laps ? 'laps' : 'none'
})
const setDetail: Setter<Detail> = (d) => {
  const rows = setElementVisible(
    currentList('battle', 'rows'),
    'sectors',
    d === 'sectors' || d === 'both'
  )
  return listSetter('battle', 'rows')(setElementVisible(rows, 'laps', d === 'laps' || d === 'both'))
}
const shownAhead = computed(() => isElementVisible(opts.value.lanes, 'ahead'))
const shownBehind = computed(() => isElementVisible(opts.value.lanes, 'behind'))

const noRivals = computed(() => !shownAhead.value && !shownBehind.value)
const nameChoices = computed(() => nameFormatChoicesInherit(t.value, appearance.value.nameFormat))
const nameHelp = computed(() =>
  nameExample(t.value, inherit(opts.value.nameFormat, appearance.value.nameFormat))
)
</script>

<template>
  <PageSection :title="t.settings.common.content">
    <SliderControl
      :label="t.settings.battle.threshold"
      :help="t.settings.battle.thresholdHelp"
      :current="opts.thresholdS"
      :min="BATTLE_THRESHOLD_MIN_S"
      :max="BATTLE_THRESHOLD_MAX_S"
      :step="OPTION_SCHEMA.battle.thresholdS.step"
      :format="tenths"
      :presets="THRESHOLD_PRESETS_S"
      :apply="set('thresholdS')"
    />
    <SliderControl
      :label="t.settings.common.keepVisible"
      :help="t.settings.battle.holdHelp"
      :current="opts.holdS"
      :min="BATTLE_HOLD_MIN_S"
      :max="BATTLE_HOLD_MAX_S"
      :step="OPTION_SCHEMA.battle.holdS.step"
      :format="tenths"
      :presets="HOLD_PRESETS_S"
      :apply="set('holdS')"
    />
    <CheckGroup
      :legend="t.settings.battle.rivals"
      :help="noRivals ? t.settings.battle.noRivals : undefined"
      :warn="noRivals"
    >
      <ToggleControl
        :label="t.settings.battle.ahead"
        :current="shownAhead"
        :apply="elementToggle('battle', 'lanes', 'ahead')"
      />
      <ToggleControl
        :label="t.settings.battle.behind"
        :current="shownBehind"
        :apply="elementToggle('battle', 'lanes', 'behind')"
      />
    </CheckGroup>
    <ChoiceControl
      :label="t.settings.common.layout"
      :current="opts.layout"
      :options="layoutChoices"
      :apply="set('layout')"
    />
    <ChoiceControl
      :label="t.settings.battle.detail"
      :help="t.settings.battle.detailHelp"
      :current="detail"
      :options="detailChoices"
      :apply="setDetail"
    />
    <CheckGroup :legend="t.settings.common.show">
      <ToggleControl
        :label="t.settings.battle.prediction"
        :help="t.settings.battle.predictionHelp"
        :current="isElementVisible(opts.rows, 'prediction')"
        :apply="elementToggle('battle', 'rows', 'prediction')"
      />
      <ToggleControl
        :label="t.settings.battle.atStake"
        :help="t.settings.battle.atStakeHelp"
        :current="isElementVisible(opts.parts, 'stake')"
        :apply="elementToggle('battle', 'parts', 'stake')"
      />
    </CheckGroup>
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
