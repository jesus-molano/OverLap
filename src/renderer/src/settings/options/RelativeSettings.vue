<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible } from '@shared/elements'
import { RELATIVE_CARS_MAX, RELATIVE_CARS_MIN } from '@shared/settings'
import type { RelativeColumnId } from '@shared/types'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { inherit } from '../../view/appearance'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { nameExample, nameFormatChoicesInherit } from '../controls/choices'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { elementToggle, optionSetter, type Setter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import ConditionsFooterSection from './ConditionsFooterSection.vue'

const opts = useOptions('relative')
const appearance = useAppearance()
const t = useI18n()
const set = optionSetter('relative')

// Until this page gets the element editors (package P1): one toggle per element.
const shown = (id: RelativeColumnId): boolean => isElementVisible(opts.value.columns, id)
const column = (id: RelativeColumnId): Setter<boolean> => elementToggle('relative', 'columns', id)

const nameChoices = computed(() => nameFormatChoicesInherit(t.value, appearance.value.nameFormat))
const nameHelp = computed(() =>
  nameExample(t.value, inherit(opts.value.nameFormat, appearance.value.nameFormat))
)
</script>

<template>
  <PageSection :title="t.settings.common.content">
    <StepperControl
      :label="t.settings.relative.carsAhead"
      :current="opts.carsAhead"
      :min="RELATIVE_CARS_MIN"
      :max="RELATIVE_CARS_MAX"
      :apply="set('carsAhead')"
    />
    <StepperControl
      :label="t.settings.relative.carsBehind"
      :current="opts.carsBehind"
      :min="RELATIVE_CARS_MIN"
      :max="RELATIVE_CARS_MAX"
      :apply="set('carsBehind')"
    />
    <CheckGroup :legend="t.settings.relative.columns">
      <ToggleControl
        :label="t.settings.relative.classPosition"
        :current="shown('pos')"
        :apply="column('pos')"
      />
      <ToggleControl
        :label="t.settings.common.license"
        :current="shown('lic')"
        :apply="column('lic')"
      />
      <ToggleControl
        :label="t.settings.common.iRating"
        :current="shown('ir')"
        :apply="column('ir')"
      />
      <ToggleControl
        :label="t.settings.relative.tyre"
        :help="t.settings.relative.tyreHelp"
        :current="shown('tyre')"
        :apply="column('tyre')"
      />
      <ToggleControl
        :label="t.settings.relative.stint"
        :help="t.settings.relative.stintHelp"
        :current="shown('stint')"
        :apply="column('stint')"
      />
    </CheckGroup>
    <ToggleControl
      kind="switch"
      :label="t.settings.common.penaltyFlags"
      :help="t.settings.common.penaltyFlagsHelp"
      :current="opts.showFlags"
      :apply="set('showFlags')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.relative.incidents"
      :help="t.settings.relative.incidentsHelp"
      :current="isElementVisible(opts.headerBar, 'incidents')"
      :apply="elementToggle('relative', 'headerBar', 'incidents')"
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

  <ConditionsFooterSection section="relative" />
</template>
