<script setup lang="ts">
import { computed } from 'vue'
import { showsNothing } from '@shared/alerts'
import { INCIDENT_ALERT } from '@shared/incidents/alert'
import { FUEL_ALERT } from '@shared/notices/fuel'
import { OPTION_SCHEMA, type NumericSpec } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions, useWidgetSettings } from '../../composables/useWidgetSettings'
import CheckGroup from '../controls/CheckGroup.vue'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'
import { formatSeconds } from '../values'

const opts = useOptions('alerts')
const set = optionSetter('alerts')
const t = useI18n()

const HOLD: NumericSpec = OPTION_SCHEMA.alerts.holdS
const HOLD_PRESETS_S = [0, 3, 5].filter((s) => s >= HOLD.min && s <= HOLD.max)
const tenths = (s: number): string => formatSeconds(s, 1)

// The blue, furled and overspeed switches hide with their own (their values stay): not counted.
const nothing = computed(() => showsNothing(opts.value))
// "Ocultar en boxes" (Ventana) hides the whole widget on pit road, limiter line included.
const prefs = useWidgetSettings('alerts')
const limiterHidden = computed(() => opts.value.showPitLimiter && prefs.value.hideInPits)
/**
 * The hold applies to the flags, to the alerts a flicker could make unreadable and to the
 * incident line (never under their own minimum).
 */
const holds = computed(
  () =>
    opts.value.showFlags ||
    opts.value.showWrongWay ||
    opts.value.showIncidents ||
    opts.value.showStalled ||
    opts.value.showOilPressure
)

const partTexts = computed(() => elementTexts(t.value, 'alerts', 'parts'))
const setParts = listSetter('alerts', 'parts')
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
        v-if="opts.showFlags"
        :label="t.settings.alerts.blue"
        :help="t.settings.alerts.blueHelp"
        :current="opts.showBlue"
        :apply="set('showBlue')"
      />
      <ToggleControl
        v-if="opts.showFlags"
        :label="t.settings.alerts.furled"
        :help="t.settings.alerts.furledHelp"
        :current="opts.showFurled"
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
        v-if="opts.showPitLimiter"
        :label="t.settings.alerts.overspeed"
        :help="t.settings.alerts.overspeedHelp"
        :current="opts.showPitOverspeed"
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
      <ToggleControl
        :label="t.settings.alerts.incidents"
        :help="t.settings.alerts.incidentsHelp(INCIDENT_ALERT.minS)"
        :current="opts.showIncidents"
        :apply="set('showIncidents')"
      />
    </CheckGroup>
    <CheckGroup :legend="t.settings.alerts.engineGroup" :help="t.settings.alerts.engineNote">
      <ToggleControl
        :label="t.settings.alerts.stalled"
        :help="t.settings.alerts.stalledHelp"
        :current="opts.showStalled"
        :apply="set('showStalled')"
      />
      <ToggleControl
        :label="t.settings.alerts.oilPressure"
        :help="t.settings.alerts.oilPressureHelp"
        :current="opts.showOilPressure"
        :apply="set('showOilPressure')"
      />
      <ToggleControl
        :label="t.settings.alerts.damage"
        :help="t.settings.alerts.damageHelp"
        :current="opts.showDamage"
        :apply="set('showDamage')"
      />
    </CheckGroup>
    <CheckGroup :legend="t.settings.alerts.fuelGroup">
      <ToggleControl
        :label="t.settings.alerts.boxThisLap"
        :help="t.settings.alerts.boxThisLapHelp"
        :current="opts.showBoxThisLap"
        :apply="set('showBoxThisLap')"
      />
      <ToggleControl
        :label="t.settings.alerts.fuelLow"
        :help="t.settings.alerts.fuelLowHelp(FUEL_ALERT.lowLaps)"
        :current="opts.showFuelLow"
        :apply="set('showFuelLow')"
      />
    </CheckGroup>
    <SliderControl
      v-if="holds"
      :label="t.settings.common.keepVisible"
      :help="t.settings.alerts.holdHelp"
      :current="opts.holdS"
      :min="HOLD.min"
      :max="HOLD.max"
      :step="HOLD.step"
      :format="tenths"
      :presets="HOLD_PRESETS_S"
      :apply="set('holdS')"
    />
  </PageSection>

  <CustomizeSection>
    <ElementEditor
      :title="zoneTitle(t, 'alerts', 'parts')"
      :items="opts.parts"
      :spec="OPTION_SCHEMA.alerts.parts"
      :labels="partTexts"
      :apply="setParts"
    />
  </CustomizeSection>
</template>
