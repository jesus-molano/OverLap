<script setup lang="ts">
import { computed } from 'vue'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'
import { formatPx } from '../values'

const opts = useOptions('spotter')
const set = optionSetter('spotter')
const t = useI18n()
const S = OPTION_SCHEMA.spotter
const px = (n: number): string => formatPx(t.value, n)
/** The quick buttons: thin, the default, wide, the widest. */
const WIDTH_PRESETS = [8, S.barWidth.default, 24, 32]

const barStyleChoices = computed(() =>
  choiceOptions(S.barStyle.values, t.value.settings.spotter.barStyleChoices)
)
const partTexts = computed(() => elementTexts(t.value, 'spotter', 'parts'))
const setParts = listSetter('spotter', 'parts')
</script>

<template>
  <PageSection :title="t.settings.common.content" resets="content" :note="t.settings.spotter.note">
    <ChoiceControl
      :label="t.settings.spotter.barStyle"
      :help="t.settings.spotter.barStyleHelp"
      :current="opts.barStyle"
      :options="barStyleChoices"
      :apply="set('barStyle')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.spotter.onlyAlongside"
      :help="t.settings.spotter.onlyAlongsideHelp"
      :current="opts.onlyAlongside"
      :apply="set('onlyAlongside')"
    />
    <SliderControl
      :label="t.settings.spotter.barWidth"
      :help="t.settings.spotter.barWidthHelp"
      :current="opts.barWidth"
      :min="S.barWidth.min"
      :max="S.barWidth.max"
      :step="S.barWidth.step"
      :format="px"
      :presets="WIDTH_PRESETS"
      :apply="set('barWidth')"
    />
  </PageSection>

  <CustomizeSection>
    <ElementEditor
      :title="zoneTitle(t, 'spotter', 'parts')"
      :items="opts.parts"
      :spec="OPTION_SCHEMA.spotter.parts"
      :labels="partTexts"
      :apply="setParts"
    />
  </CustomizeSection>
</template>
