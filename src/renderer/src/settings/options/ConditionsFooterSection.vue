<script setup lang="ts">
import { computed } from 'vue'
import type { FooterSection } from '../../composables/useConditionsFooter'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import CheckGroup from '../controls/CheckGroup.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter } from '../editor'
import PageSection from '../layout/PageSection.vue'

/**
 * "Pie de condiciones": the conditions footer of a table page (the relative's, the
 * standings'): its switch and the readings it shows, in the line's order (greyed out while the
 * footer is off).
 */
const props = defineProps<{ section: FooterSection }>()

const opts = useOptions(props.section)
const set = optionSetter(props.section)
const t = useI18n()

const showHelp = computed(() =>
  props.section === 'relative'
    ? t.value.settings.conditionsFooter.relativeHelp
    : t.value.settings.conditionsFooter.standingsHelp
)
/** Every reading off: the footer never shows. */
const nothing = computed(() => {
  const o = opts.value
  return !(
    o.conditionsTrackTemp ||
    o.conditionsWet ||
    o.conditionsWind ||
    o.conditionsAirTemp ||
    o.conditionsRubber
  )
})
const off = computed(() => !opts.value.conditionsFooter)
</script>

<template>
  <PageSection :title="t.settings.conditionsFooter.title" :note="t.settings.conditionsFooter.note">
    <ToggleControl
      kind="switch"
      :label="t.settings.conditionsFooter.show"
      :help="showHelp"
      :current="opts.conditionsFooter"
      :apply="set('conditionsFooter')"
    />
    <CheckGroup
      :legend="t.settings.conditionsFooter.readings"
      :help="
        nothing ? t.settings.conditionsFooter.nothing : t.settings.conditionsFooter.readingsHelp
      "
      :warn="nothing && !off"
      :disabled="off"
    >
      <ToggleControl
        :label="t.settings.conditionsFooter.trackTemp"
        :help="t.settings.conditionsFooter.trackTempHelp"
        :current="opts.conditionsTrackTemp"
        :apply="set('conditionsTrackTemp')"
      />
      <ToggleControl
        :label="t.settings.conditionsFooter.trend"
        :help="t.settings.conditionsFooter.trendHelp"
        :current="opts.conditionsTrend"
        :disabled="!opts.conditionsTrackTemp"
        :apply="set('conditionsTrend')"
      />
      <ToggleControl
        :label="t.settings.conditionsFooter.wet"
        :help="t.settings.conditionsFooter.wetHelp"
        :current="opts.conditionsWet"
        :apply="set('conditionsWet')"
      />
      <ToggleControl
        :label="t.settings.conditionsFooter.wind"
        :help="t.settings.conditionsFooter.windHelp"
        :current="opts.conditionsWind"
        :apply="set('conditionsWind')"
      />
      <ToggleControl
        :label="t.settings.conditionsFooter.windDirection"
        :help="t.settings.conditionsFooter.windDirectionHelp"
        :current="opts.conditionsWindDirection"
        :disabled="!opts.conditionsWind"
        :apply="set('conditionsWindDirection')"
      />
      <ToggleControl
        :label="t.settings.conditionsFooter.airTemp"
        :current="opts.conditionsAirTemp"
        :apply="set('conditionsAirTemp')"
      />
      <ToggleControl
        :label="t.settings.conditionsFooter.rubber"
        :help="t.settings.conditionsFooter.rubberHelp"
        :current="opts.conditionsRubber"
        :apply="set('conditionsRubber')"
      />
    </CheckGroup>
  </PageSection>
</template>
