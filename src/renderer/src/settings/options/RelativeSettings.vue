<script setup lang="ts">
import { computed } from 'vue'
import { RELATIVE_CARS_MAX, RELATIVE_CARS_MIN } from '@shared/settings'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { inherit } from '../../view/appearance'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { nameExample, nameFormatChoicesInherit } from '../controls/choices'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'

const opts = useOptions('relative')
const appearance = useAppearance()
const t = useI18n()
const set = optionSetter('relative')

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
        :current="opts.showClassPosition"
        :apply="set('showClassPosition')"
      />
      <ToggleControl
        :label="t.settings.common.license"
        :current="opts.showLicense"
        :apply="set('showLicense')"
      />
      <ToggleControl
        :label="t.settings.common.iRating"
        :current="opts.showIRating"
        :apply="set('showIRating')"
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
