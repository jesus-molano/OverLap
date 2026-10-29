<script setup lang="ts">
import { isElementVisible } from '@shared/elements'
import { formatMetres } from '@shared/format'
import { RADAR_RANGE_MAX_M, RADAR_RANGE_MIN_M, RADAR_RANGE_PRESETS_M } from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { elementToggle, optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'

const opts = useOptions('radar')
const set = optionSetter('radar')
const t = useI18n()
const format = (m: number): string => formatMetres(m)
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
    <ToggleControl
      kind="switch"
      :label="t.settings.radar.labels"
      :help="t.settings.radar.labelsHelp"
      :current="isElementVisible(opts.parts, 'rangeLabels')"
      :apply="elementToggle('radar', 'parts', 'rangeLabels')"
    />
  </PageSection>
</template>
