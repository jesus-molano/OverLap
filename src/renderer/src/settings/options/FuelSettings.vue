<script setup lang="ts">
import { FUEL_STRATEGY } from '@shared/fuel/strategy'
import { OPTION_SCHEMA, type NumericSpec } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import CheckGroup from '../controls/CheckGroup.vue'
import SliderControl from '../controls/SliderControl.vue'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'

const opts = useOptions('fuel')
const set = optionSetter('fuel')
const t = useI18n()

const AVG: NumericSpec = OPTION_SCHEMA.fuel.avgLaps
const MARGIN: NumericSpec = OPTION_SCHEMA.fuel.marginLaps
const MARGIN_STEP = MARGIN.step ?? 0.1
const MARGIN_PRESETS = [0, 0.5, 1, 2].filter((v) => v >= MARGIN.min && v <= MARGIN.max)
/** '0.5 v' / '0.5 laps'. */
const marginText = (v: number): string => t.value.settings.fuel.marginValue(v.toFixed(1))
/** How much less per lap still counts as within reach, as a whole percentage. */
const SAVE_PCT = Math.round(FUEL_STRATEGY.saveReach * 100)
</script>

<template>
  <PageSection :title="t.settings.common.content" :note="t.settings.fuel.note">
    <ToggleControl
      kind="switch"
      :label="t.settings.fuel.header"
      :help="t.settings.fuel.headerHelp"
      :current="opts.showHeader"
      :apply="set('showHeader')"
    />
    <CheckGroup :legend="t.settings.fuel.lines">
      <ToggleControl
        :label="t.settings.fuel.gauge"
        :help="t.settings.fuel.gaugeHelp"
        :current="opts.showGauge"
        :apply="set('showGauge')"
      />
      <ToggleControl
        :label="t.settings.fuel.perLap"
        :help="t.settings.fuel.perLapHelp"
        :current="opts.showPerLap"
        :apply="set('showPerLap')"
      />
      <ToggleControl
        :label="t.settings.fuel.finish"
        :help="t.settings.fuel.finishHelp"
        :current="opts.showFinish"
        :apply="set('showFinish')"
      />
      <ToggleControl
        :label="t.settings.fuel.box"
        :help="t.settings.fuel.boxHelp"
        :current="opts.showBox"
        :disabled="!opts.showFinish"
        :apply="set('showBox')"
      />
      <ToggleControl
        :label="t.settings.fuel.window"
        :help="t.settings.fuel.windowHelp"
        :current="opts.showWindow"
        :apply="set('showWindow')"
      />
      <ToggleControl
        :label="t.settings.fuel.save"
        :help="t.settings.fuel.saveHelp(SAVE_PCT)"
        :current="opts.showSave"
        :apply="set('showSave')"
      />
      <ToggleControl
        :label="t.settings.fuel.tyres"
        :help="t.settings.fuel.tyresHelp"
        :current="opts.showTyres"
        :apply="set('showTyres')"
      />
      <ToggleControl
        :label="t.settings.fuel.limits"
        :help="t.settings.fuel.limitsHelp"
        :current="opts.showLimits"
        :apply="set('showLimits')"
      />
    </CheckGroup>
  </PageSection>

  <PageSection :title="t.settings.fuel.calc" :note="t.settings.fuel.calcNote">
    <StepperControl
      :label="t.settings.fuel.avgLaps"
      :help="t.settings.fuel.avgLapsHelp"
      :current="opts.avgLaps"
      :min="AVG.min"
      :max="AVG.max"
      :apply="set('avgLaps')"
    />
    <SliderControl
      :label="t.settings.fuel.margin"
      :help="t.settings.fuel.marginHelp"
      :current="opts.marginLaps"
      :min="MARGIN.min"
      :max="MARGIN.max"
      :step="MARGIN_STEP"
      :format="marginText"
      :presets="MARGIN_PRESETS"
      :apply="set('marginLaps')"
    />
  </PageSection>
</template>
