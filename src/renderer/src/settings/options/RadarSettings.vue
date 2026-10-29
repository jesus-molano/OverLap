<script setup lang="ts">
import { computed } from 'vue'
import { formatMetres } from '@shared/format'
import { RADAR_RANGE_MAX_M, RADAR_RANGE_MIN_M, RADAR_RANGE_PRESETS_M } from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import SliderControl from '../controls/SliderControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'

const opts = useOptions('radar')
const set = optionSetter('radar')
const t = useI18n()
const format = (m: number): string => formatMetres(m)

const partTexts = computed(() => {
  const base = elementTexts(t.value, 'radar', 'parts')
  return {
    ...base,
    rangeLabels: { label: base.rangeLabels.label, hint: t.value.settings.radar.labelsHelp }
  }
})
const setParts = listSetter('radar', 'parts')
</script>

<template>
  <PageSection :title="t.settings.common.content">
    <SliderControl
      :label="t.settings.radar.range"
      :help="t.settings.radar.rangeHelp"
      :current="opts.rangeM"
      :min="RADAR_RANGE_MIN_M"
      :max="RADAR_RANGE_MAX_M"
      :step="OPTION_SCHEMA.radar.rangeM.step"
      :format="format"
      :presets="RADAR_RANGE_PRESETS_M"
      :apply="set('rangeM')"
    />
  </PageSection>

  <CustomizeSection no-bars>
    <ElementEditor
      :title="zoneTitle(t, 'radar', 'parts')"
      :items="opts.parts"
      :spec="OPTION_SCHEMA.radar.parts"
      :labels="partTexts"
      :apply="setParts"
    />
  </CustomizeSection>
</template>
