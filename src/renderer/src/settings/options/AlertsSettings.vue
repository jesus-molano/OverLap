<script setup lang="ts">
import { computed } from 'vue'
import { OPTION_SCHEMA, type NumericSpec } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions, useWidgetSettings } from '../../composables/useWidgetSettings'
import CheckGroup from '../controls/CheckGroup.vue'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import { formatSeconds } from '../values'

const opts = useOptions('alerts')
const set = optionSetter('alerts')
const t = useI18n()

const HOLD: NumericSpec = OPTION_SCHEMA.alerts.holdS
const HOLD_PRESETS_S = [0, 3, 5].filter((s) => s >= HOLD.min && s <= HOLD.max)
const tenths = (s: number): string => formatSeconds(s, 1)

const nothing = computed(() => !opts.value.showFlags && !opts.value.showPitLimiter)
// "Ocultar en boxes" (Ventana) hides the whole widget on pit road, limiter line included.
const prefs = useWidgetSettings('alerts')
const limiterHidden = computed(() => opts.value.showPitLimiter && prefs.value.hideInPits)
const showHelp = computed(() => {
  const a = t.value.settings.alerts
  return nothing.value ? a.nothing : limiterHidden.value ? a.limiterHidden : undefined
})
</script>

<template>
  <PageSection :title="t.settings.common.content">
    <CheckGroup :legend="t.settings.common.show" :help="showHelp" :warn="nothing || limiterHidden">
      <ToggleControl
        :label="t.settings.alerts.flags"
        :help="t.settings.alerts.flagsHelp"
        :current="opts.showFlags"
        :apply="set('showFlags')"
      />
      <ToggleControl
        :label="t.settings.alerts.blue"
        :help="t.settings.alerts.blueHelp"
        :current="opts.showBlue"
        :disabled="!opts.showFlags"
        :apply="set('showBlue')"
      />
      <ToggleControl
        :label="t.settings.alerts.limiter"
        :help="t.settings.alerts.limiterHelp"
        :current="opts.showPitLimiter"
        :apply="set('showPitLimiter')"
      />
    </CheckGroup>
    <SliderControl
      :label="t.settings.common.keepVisible"
      :help="t.settings.alerts.holdHelp"
      :current="opts.holdS"
      :min="HOLD.min"
      :max="HOLD.max"
      :step="HOLD.step"
      :format="tenths"
      :presets="HOLD_PRESETS_S"
      :disabled="!opts.showFlags"
      :apply="set('holdS')"
    />
  </PageSection>
</template>
