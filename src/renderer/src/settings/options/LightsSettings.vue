<script setup lang="ts">
import { computed } from 'vue'
import { isElementVisible, visibleCount } from '@shared/elements'
import { LIGHT_ORDER } from '@shared/lights'
import { ENGINE_TREND } from '@shared/notices/engineTrend'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { LightKind } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import ToggleControl from '../controls/ToggleControl.vue'
import { elementToggle, optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import LightsLegend from './LightsLegend.vue'

const opts = useOptions('lights')
const set = optionSetter('lights')
const t = useI18n()

const layoutChoices = computed(() =>
  choiceOptions(OPTION_SCHEMA.lights.layout.values, t.value.settings.lights.layoutChoices)
)
const shown = (kind: LightKind): boolean => isElementVisible(opts.value.icons, kind)
/** Every light off: the widget never shows. */
const nothing = computed(() => visibleCount(opts.value.icons) === 0)
/** The trend lights the two temperature lights: nothing to light without them. */
const noTemps = computed(() => !shown('water') && !shown('oilTemp'))
const noRepairs = computed(() => !shown('repair') && !shown('repairOptional'))
</script>

<template>
  <PageSection :title="t.settings.common.content" :note="t.settings.lights.note">
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
    <CheckGroup
      :legend="t.settings.lights.lightsGroup"
      :help="nothing ? t.settings.lights.nothing : undefined"
      :warn="nothing"
    >
      <template v-for="kind in LIGHT_ORDER" :key="kind">
        <ToggleControl
          :label="t.widgets.lights.names[kind]"
          :help="t.settings.lights.help[kind]"
          :current="shown(kind)"
          :apply="elementToggle('lights', 'icons', kind)"
        />
        <ToggleControl
          v-if="kind === 'oilTemp'"
          :label="t.settings.lights.trend"
          :help="t.settings.lights.trendHelp(ENGINE_TREND.sustainS)"
          :current="opts.showTrend"
          :disabled="noTemps"
          :apply="set('showTrend')"
        />
      </template>
    </CheckGroup>
  </PageSection>

  <LightsLegend />
</template>
