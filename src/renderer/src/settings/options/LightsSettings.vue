<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible } from '@shared/elements'
import { ENGINE_TREND } from '@shared/notices/engineTrend'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { LightKind } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import PageSection from '../layout/PageSection.vue'
import LightsLegend from './LightsLegend.vue'

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
const shown = (kind: LightKind): boolean => isElementVisible(opts.value.icons, kind)
/** The trend lights the two temperature lights: nothing to light without them. */
const noTemps = computed(() => !shown('water') && !shown('oilTemp'))
const noRepairs = computed(() => !shown('repair') && !shown('repairOptional'))
const iconTexts = computed(() => elementTexts(t.value, 'lights', 'icons'))
const setIcons = listSetter('lights', 'icons')
</script>

<template>
  <PageSection :title="t.settings.common.content" :note="t.settings.lights.note">
    <ChoiceControl
      :label="t.settings.lights.layout"
      :current="opts.layout"
      :options="layoutChoices"
      :apply="set('layout')"
    />
    <ChoiceControl
      :label="t.settings.lights.labelSide"
      :help="column ? undefined : t.settings.lights.labelSideOff"
      :current="opts.labelSide"
      :options="labelSideChoices"
      :disabled="!column"
      :apply="set('labelSide')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.lights.onlyWhenLit"
      :help="t.settings.lights.onlyWhenLitHelp"
      :current="opts.onlyWhenLit"
      :apply="set('onlyWhenLit')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.lights.captions"
      :help="t.settings.lights.captionsHelp"
      :current="opts.showCaptions"
      :apply="set('showCaptions')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.lights.temps"
      :help="t.settings.lights.tempsHelp"
      :current="opts.showTemps"
      :disabled="noTemps"
      :apply="set('showTemps')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.lights.repairTime"
      :help="t.settings.lights.repairTimeHelp"
      :current="opts.showRepairTime"
      :disabled="noRepairs"
      :apply="set('showRepairTime')"
    />
  </PageSection>

  <ElementEditor
    :title="zoneTitle(t, 'lights', 'icons')"
    :items="opts.icons"
    :spec="OPTION_SCHEMA.lights.icons"
    :labels="iconTexts"
    :apply="setIcons"
    empty-hides
  >
    <template #footer>
      <div class="st-card li-extras">
        <ToggleControl
          kind="switch"
          :label="t.settings.lights.trend"
          :help="t.settings.lights.trendHelp(ENGINE_TREND.sustainS)"
          :current="opts.showTrend"
          :disabled="noTemps"
          :apply="set('showTrend')"
        />
      </div>
    </template>
  </ElementEditor>

  <LightsLegend />
</template>

<style scoped>
.li-extras {
  margin-top: 10px;
}
</style>
