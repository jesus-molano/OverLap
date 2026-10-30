<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible } from '@shared/elements'
import { FUEL_STRATEGY } from '@shared/fuel/strategy'
import { OPTION_SCHEMA, type NumericSpec } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { behaviourNote } from '../controls/previewNote'
import SliderControl from '../controls/SliderControl.vue'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import InfoBarEditor from '../elements/InfoBarEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'
import { formatNumber } from '../values'

const opts = useOptions('fuel')
const set = optionSetter('fuel')
const t = useI18n()

/** Acts during the session only: the same note as every such option (PreviewNote). */
const behaviour = computed(() => behaviourNote(t.value))
const S = OPTION_SCHEMA.fuel

const AVG: NumericSpec = S.avgLaps
const MARGIN: NumericSpec = S.marginLaps
const MARGIN_STEP = MARGIN.step ?? 0.1
const MARGIN_PRESETS = [0, 0.5, 1, 2].filter((v) => v >= MARGIN.min && v <= MARGIN.max)
/** '0,5 v' / '0.5 laps', '1 v' (one number format: values.ts). */
const marginText = (v: number): string =>
  t.value.settings.fuel.marginValue(formatNumber(t.value, v, 1))
/** How much less per lap still counts as within reach, as a whole percentage. */
const SAVE_PCT = Math.round(FUEL_STRATEGY.saveReach * 100)

/** Every line's words, with the hint each had as a switch. */
const lineTexts = computed(() => {
  const f = t.value.settings.fuel
  const base = elementTexts(t.value, 'fuel', 'lines')
  return {
    ...base,
    gauge: { label: base.gauge.label, hint: f.gaugeHelp },
    perLap: { label: base.perLap.label, hint: f.perLapHelp },
    finish: { label: base.finish.label, hint: f.finishHelp },
    window: { label: base.window.label, hint: f.windowHelp },
    save: { label: base.save.label, hint: f.saveHelp(SAVE_PCT) },
    tyres: { label: base.tyres.label, hint: f.tyresHelp },
    limits: { label: base.limits.label, hint: f.limitsHelp }
  }
})
const finishShown = computed(() => isElementVisible(opts.value.lines, 'finish'))

const setLines = listSetter('fuel', 'lines')
</script>

<template>
  <PageSection :title="t.settings.common.content" resets="content" :note="t.settings.fuel.calcNote">
    <StepperControl
      :label="t.settings.fuel.avgLaps"
      :help="t.settings.fuel.avgLapsHelp"
      :current="opts.avgLaps"
      :min="AVG.min"
      :max="AVG.max"
      :note="behaviour"
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
      :note="behaviour"
      :apply="set('marginLaps')"
    />
  </PageSection>

  <CustomizeSection>
    <ElementEditor
      :title="zoneTitle(t, 'fuel', 'lines')"
      :items="opts.lines"
      :spec="S.lines"
      :labels="lineTexts"
      :note="t.settings.fuel.note"
      :apply="setLines"
    >
      <template #footer>
        <ToggleControl
          v-if="finishShown"
          kind="switch"
          :label="t.settings.fuel.box"
          :help="t.settings.fuel.boxHelp"
          :current="opts.showBox"
          :apply="set('showBox')"
        />
      </template>
    </ElementEditor>
    <InfoBarEditor section="fuel" field="headerBar" />
    <InfoBarEditor section="fuel" field="footerBar" />
  </CustomizeSection>
</template>
