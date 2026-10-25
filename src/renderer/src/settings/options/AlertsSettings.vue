<script setup lang="ts">
import { computed } from 'vue'
import type { AlertToggle } from '@shared/alerts'
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

/** Every on/off option of the page, in the schema's (UI) order. */
const TOGGLES = (Object.keys(OPTION_SCHEMA.alerts) as (keyof typeof OPTION_SCHEMA.alerts)[]).filter(
  (k): k is AlertToggle => OPTION_SCHEMA.alerts[k].kind === 'bool'
)

const nothing = computed(() => TOGGLES.every((k) => !opts.value[k]))
// "Ocultar en boxes" (Ventana) hides the whole widget on pit road, limiter line included.
const prefs = useWidgetSettings('alerts')
const limiterHidden = computed(() => opts.value.showPitLimiter && prefs.value.hideInPits)
/** The hold applies to the flags and to the alerts a flicker could make unreadable. */
const holds = computed(
  () =>
    opts.value.showFlags ||
    opts.value.showWrongWay ||
    opts.value.showStalled ||
    opts.value.showEngineWarnings
)
</script>

<template>
  <PageSection :title="t.settings.common.content">
    <CheckGroup
      :legend="t.settings.common.show"
      :help="nothing ? t.settings.alerts.nothing : undefined"
      :warn="nothing"
    >
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
        :label="t.settings.alerts.furled"
        :help="t.settings.alerts.furledHelp"
        :current="opts.showFurled"
        :disabled="!opts.showFlags"
        :apply="set('showFurled')"
      />
    </CheckGroup>
    <CheckGroup
      :legend="t.settings.alerts.pitGroup"
      :help="limiterHidden ? t.settings.alerts.limiterHidden : undefined"
      :warn="limiterHidden"
    >
      <ToggleControl
        :label="t.settings.alerts.limiter"
        :help="t.settings.alerts.limiterHelp"
        :current="opts.showPitLimiter"
        :apply="set('showPitLimiter')"
      />
      <ToggleControl
        :label="t.settings.alerts.overspeed"
        :help="t.settings.alerts.overspeedHelp"
        :current="opts.showPitOverspeed"
        :disabled="!opts.showPitLimiter"
        :apply="set('showPitOverspeed')"
      />
      <ToggleControl
        :label="t.settings.alerts.pitEntry"
        :help="t.settings.alerts.pitEntryHelp"
        :current="opts.showPitEntry"
        :apply="set('showPitEntry')"
      />
    </CheckGroup>
    <CheckGroup :legend="t.settings.alerts.raceGroup">
      <ToggleControl
        :label="t.settings.alerts.lapsToGo"
        :help="t.settings.alerts.lapsToGoHelp"
        :current="opts.showLapsToGo"
        :apply="set('showLapsToGo')"
      />
      <ToggleControl
        :label="t.settings.alerts.tow"
        :help="t.settings.alerts.towHelp"
        :current="opts.showTow"
        :apply="set('showTow')"
      />
      <ToggleControl
        :label="t.settings.alerts.wrongWay"
        :help="t.settings.alerts.wrongWayHelp"
        :current="opts.showWrongWay"
        :apply="set('showWrongWay')"
      />
    </CheckGroup>
    <CheckGroup :legend="t.settings.alerts.engineGroup">
      <ToggleControl
        :label="t.settings.alerts.stalled"
        :help="t.settings.alerts.stalledHelp"
        :current="opts.showStalled"
        :apply="set('showStalled')"
      />
      <ToggleControl
        :label="t.settings.alerts.engineWarnings"
        :help="t.settings.alerts.engineWarningsHelp"
        :current="opts.showEngineWarnings"
        :apply="set('showEngineWarnings')"
      />
      <ToggleControl
        :label="t.settings.alerts.engineTrend"
        :help="t.settings.alerts.engineTrendHelp"
        :current="opts.showEngineTrend"
        :apply="set('showEngineTrend')"
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
      :disabled="!holds"
      :apply="set('holdS')"
    />
  </PageSection>
</template>
