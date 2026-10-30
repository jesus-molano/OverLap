<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible } from '@shared/elements'
import { ENGINE_TREND } from '@shared/notices/engineTrend'
import { REPAIR_CLOCK } from '@shared/notices/repairClock'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { LightKind } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter, updateSection } from '../editor'
import {
  captionsChoice,
  captionsPatch,
  captionsValues,
  type CaptionsChoice
} from './lightsCaptions'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageAppendix from '../layout/PageAppendix.vue'
import PageSection from '../layout/PageSection.vue'
import { hasLightTexts, lightsFilter } from '@renderer/widgets/lights/view'
import LightsLegend from './LightsLegend.vue'
import { alertOfLight } from '../alertsList'
import SiblingLink from '../layout/SiblingLink.vue'

const opts = useOptions('lights')
const set = optionSetter('lights')
const t = useI18n()

const layoutChoices = computed(() =>
  choiceOptions(OPTION_SCHEMA.lights.layout.values, t.value.settings.lights.layoutChoices)
)
const labelSideChoices = computed(() =>
  choiceOptions(OPTION_SCHEMA.lights.labelSide.values, t.value.settings.lights.labelSideChoices)
)
const column = computed(() => opts.value.layout === 'column')
/**
 * "Rótulos: No / Derecha / Izquierda" (in a column; "No / Sí" in a row, where they go under the
 * icons): the captions switch and their side as one choice (lightsCaptions.ts).
 */
const captions = computed(() => captionsChoice(opts.value))
const captionsChoices = computed(() =>
  choiceOptions(captionsValues(opts.value.layout), t.value.settings.lights.captionsChoices)
)
const setCaptions = (v: CaptionsChoice): Promise<void> => updateSection('lights', captionsPatch(v))
/** Values (temperatures, repair times) without captions in a column: their side on its own. */
const hasTexts = computed(() => hasLightTexts(lightsFilter(opts.value)))
const sideOnItsOwn = computed(() => column.value && !opts.value.showCaptions && hasTexts.value)
const shown = (kind: LightKind): boolean => isElementVisible(opts.value.icons, kind)
/** The trend lights the two temperature lights: nothing to light without them. */
const noTemps = computed(() => !shown('water') && !shown('oilTemp'))
const noRepairs = computed(() => !shown('repair') && !shown('repairOptional'))
const iconTexts = computed(() => elementTexts(t.value, 'lights', 'icons'))
const setIcons = listSetter('lights', 'icons')
const NOOP = (): Promise<void> => Promise.resolve()
/** Its setter, for the box (a row without an alert never shows one). */
const setAlert = (id: string): ((on: boolean) => Promise<void>) => alertBox(id)?.set ?? NOOP
/** Avisos' switches of the events both widgets have (R39): the «Aviso» box of their rows. */
const alerts = useOptions('alerts')
function alertBox(id: string): { on: boolean; set: (on: boolean) => Promise<void> } | null {
  const key = alertOfLight(id)
  if (key === null) return null
  return { on: alerts.value[key], set: (on) => updateSection('alerts', { [key]: on }) }
}
</script>

<template>
  <PageSection :title="t.settings.common.content" resets="content" :note="t.settings.lights.note">
    <ChoiceControl
      :label="t.settings.lights.layout"
      :current="opts.layout"
      :options="layoutChoices"
      :apply="set('layout')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.lights.onlyWhenLit"
      :help="t.settings.lights.onlyWhenLitHelp"
      :current="opts.onlyWhenLit"
      :apply="set('onlyWhenLit')"
    />
    <p v-if="opts.onlyWhenLit" class="st-row st-help wl-sample-note">
      {{ t.settings.lights.onlyWhenLitSample }}
    </p>
  </PageSection>

  <CustomizeSection>
    <ElementEditor
      :title="zoneTitle(t, 'lights', 'icons')"
      :items="opts.icons"
      :spec="OPTION_SCHEMA.lights.icons"
      :labels="iconTexts"
      :apply="setIcons"
      empty-hides
    >
      <template #extra="{ id }">
        <ToggleControl
          v-if="alertBox(id) !== null"
          :label="t.settings.lights.alsoAlert"
          :name="t.settings.lights.alsoAlertLabel(iconTexts[id].label)"
          :current="alertBox(id)?.on ?? false"
          :apply="setAlert(id)"
        />
      </template>
      <!-- How the lights read (R12): their words, temperatures and repairs, next to them. -->
      <template #footer>
        <SiblingLink :text="t.settings.lights.sharedNote" page="alerts" />
        <ChoiceControl
          :label="t.settings.lights.captions"
          :help="t.settings.lights.captionsHelp"
          :current="captions"
          :options="captionsChoices"
          :apply="setCaptions"
        />
        <ChoiceControl
          v-if="sideOnItsOwn"
          :label="t.settings.lights.labelSide"
          :current="opts.labelSide"
          :options="labelSideChoices"
          :apply="set('labelSide')"
        />
        <ToggleControl
          v-if="!noTemps"
          kind="switch"
          :label="t.settings.lights.temps"
          :help="t.settings.lights.tempsHelp"
          :current="opts.showTemps"
          :apply="set('showTemps')"
        />
        <ToggleControl
          v-if="!noRepairs"
          kind="switch"
          :label="t.settings.lights.repairTime"
          :help="t.settings.lights.repairTimeHelp"
          :current="opts.showRepairTime"
          :apply="set('showRepairTime')"
        />
        <ToggleControl
          v-if="!noRepairs && opts.showRepairTime"
          kind="switch"
          :label="t.settings.lights.repairCrewTag"
          :help="t.settings.lights.repairCrewTagHelp"
          :more="t.settings.lights.repairCrewTagMore"
          :current="opts.repairCrewTag"
          :apply="set('repairCrewTag')"
        />
        <ToggleControl
          v-if="!noRepairs && opts.showRepairTime"
          kind="switch"
          :label="t.settings.lights.repairRealTime"
          :help="t.settings.lights.repairRealTimeHelp"
          :more="t.settings.lights.repairRealTimeMore(REPAIR_CLOCK.windowS)"
          :current="opts.repairRealTime"
          :apply="set('repairRealTime')"
        />
        <ToggleControl
          v-if="!noTemps"
          kind="switch"
          :label="t.settings.lights.trend"
          :help="t.settings.lights.trendHelp(ENGINE_TREND.sustainS)"
          :current="opts.showTrend"
          :apply="set('showTrend')"
        />
      </template>
    </ElementEditor>
  </CustomizeSection>

  <PageAppendix>
    <LightsLegend :opts="opts" />
  </PageAppendix>
</template>

<style scoped>
.wl-sample-note {
  display: block;
}
</style>
