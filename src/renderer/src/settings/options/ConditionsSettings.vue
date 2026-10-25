<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import CheckGroup from '../controls/CheckGroup.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'

const opts = useOptions('conditions')
const set = optionSetter('conditions')
const t = useI18n()

/** Every reading off: the widget never shows (the header alone is not drawn). */
const nothing = computed(() => {
  const o = opts.value
  return !(
    o.showTrackTemp ||
    o.showAirTemp ||
    o.showWind ||
    o.showWetness ||
    o.showPrecipitation ||
    o.showDeclaredWet ||
    o.showSkies ||
    o.showRubber
  )
})
</script>

<template>
  <PageSection :title="t.settings.common.content" :note="t.settings.conditions.note">
    <ToggleControl
      kind="switch"
      :label="t.settings.conditions.header"
      :help="t.settings.conditions.headerHelp"
      :current="opts.showHeader"
      :apply="set('showHeader')"
    />
    <CheckGroup :legend="t.settings.conditions.temps">
      <ToggleControl
        :label="t.settings.conditions.trackTemp"
        :help="t.settings.conditions.trackTempHelp"
        :current="opts.showTrackTemp"
        :apply="set('showTrackTemp')"
      />
      <ToggleControl
        :label="t.settings.conditions.trend"
        :help="t.settings.conditions.trendHelp"
        :current="opts.showTrend"
        :disabled="!opts.showTrackTemp"
        :apply="set('showTrend')"
      />
      <ToggleControl
        :label="t.settings.conditions.airTemp"
        :current="opts.showAirTemp"
        :apply="set('showAirTemp')"
      />
    </CheckGroup>
    <CheckGroup :legend="t.settings.conditions.wind">
      <ToggleControl
        :label="t.settings.conditions.windSpeed"
        :help="t.settings.conditions.windHelp"
        :current="opts.showWind"
        :apply="set('showWind')"
      />
      <ToggleControl
        :label="t.settings.conditions.windDirection"
        :help="t.settings.conditions.windDirectionHelp"
        :current="opts.showWindDirection"
        :disabled="!opts.showWind"
        :apply="set('showWindDirection')"
      />
    </CheckGroup>
    <CheckGroup
      :legend="t.settings.conditions.surface"
      :help="nothing ? t.settings.conditions.nothing : undefined"
      :warn="nothing"
    >
      <ToggleControl
        :label="t.settings.conditions.wetness"
        :help="t.settings.conditions.wetnessHelp"
        :current="opts.showWetness"
        :apply="set('showWetness')"
      />
      <ToggleControl
        :label="t.settings.conditions.precipitation"
        :help="t.settings.conditions.precipitationHelp"
        :current="opts.showPrecipitation"
        :apply="set('showPrecipitation')"
      />
      <ToggleControl
        :label="t.settings.conditions.declaredWet"
        :help="t.settings.conditions.declaredWetHelp"
        :current="opts.showDeclaredWet"
        :apply="set('showDeclaredWet')"
      />
      <ToggleControl
        :label="t.settings.conditions.skies"
        :help="t.settings.conditions.skiesHelp"
        :current="opts.showSkies"
        :apply="set('showSkies')"
      />
      <ToggleControl
        :label="t.settings.conditions.rubber"
        :help="t.settings.conditions.rubberHelp"
        :current="opts.showRubber"
        :apply="set('showRubber')"
      />
    </CheckGroup>
  </PageSection>
</template>
