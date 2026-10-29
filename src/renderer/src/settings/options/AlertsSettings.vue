<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { ElementEntry } from '@shared/types'
import { showsNothing } from '@shared/alerts'
import { INCIDENT_ALERT } from '@shared/incidents/alert'
import { FUEL_ALERT } from '@shared/notices/fuel'
import { OPTION_SCHEMA, type NumericSpec } from '@shared/settingsSchema'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import SliderControl from '../controls/SliderControl.vue'
import { listSetter, optionSetter, updateSection } from '../editor'
import { ALERT_GROUPS, alertItems, alertPatch, type AlertKey } from '../alertsList'
import type { ElementText } from '../elements/listOps'
import AccordionSection from '../layout/AccordionSection.vue'
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
const seconds = (s: number): string => formatSeconds(t.value, s)

// The blue, furled and overspeed switches hide with their own (their values stay): not counted.
const nothing = computed(() => showsNothing(opts.value))
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

/** The alerts as eye lists, one per group (alertsList.ts), worded with their old hints. */
const alertTexts = computed<Readonly<Record<AlertKey, ElementText>>>(() => {
  const a = t.value.settings.alerts
  return {
    showFlags: { label: a.flags, hint: a.flagsHelp },
    showBlue: { label: a.blue, hint: a.blueHelp },
    showFurled: { label: a.furled, hint: a.furledHelp },
    showPitLimiter: { label: a.limiter, hint: a.limiterHelp },
    showPitOverspeed: { label: a.overspeed, hint: a.overspeedHelp },
    showPitEntry: { label: a.pitEntry, hint: a.pitEntryHelp },
    showLapsToGo: { label: a.lapsToGo, hint: a.lapsToGoHelp },
    showTow: { label: a.tow, hint: a.towHelp },
    showWrongWay: { label: a.wrongWay, hint: a.wrongWayHelp },
    showIncidents: { label: a.incidents, hint: a.incidentsHelp(INCIDENT_ALERT.minS) },
    showStalled: { label: a.stalled, hint: a.stalledHelp },
    showOilPressure: { label: a.oilPressure, hint: a.oilPressureHelp },
    showDamage: { label: a.damage, hint: a.damageHelp },
    showBoxThisLap: { label: a.boxThisLap, hint: a.boxThisLapHelp },
    showFuelLow: { label: a.fuelLow, hint: a.fuelLowHelp(FUEL_ALERT.lowLaps) }
  }
})
const groups = computed(() => {
  const a = t.value.settings.alerts
  return ALERT_GROUPS.map((g) => ({
    key: g.key,
    spec: g.spec,
    title: a.groups[g.key],
    items: alertItems(g, opts.value),
    note: g.key === 'engine' ? a.engineNote : undefined
  }))
})
/** '12 de 15 visibles', as every list's count. */
const alertsSummary = computed(() => {
  const all = groups.value.flatMap((g) => g.items)
  return t.value.settings.elements.count(all.filter((e) => e.visible).length, all.length)
})
const alertsOpen = shallowRef(true)
const setAlerts = (next: ElementEntry<AlertKey>[]): Promise<void> =>
  updateSection('alerts', alertPatch(next))
const setParts = listSetter('alerts', 'parts')
</script>

<template>
  <PageSection :title="t.settings.common.content" resets="options">
    <!-- Which alerts: their lists, in Personalizar (R12). Here what the page does with them. -->
    <p v-if="nothing" class="st-row st-help st-help-warn al-nothing" role="status">
      {{ t.settings.alerts.nothing }}
    </p>
    <SliderControl
      v-if="holds"
      :label="t.settings.common.keepVisible"
      :help="t.settings.alerts.holdHelp"
      :current="opts.holdS"
      :min="HOLD.min"
      :max="HOLD.max"
      :step="HOLD.step"
      :format="seconds"
      :presets="HOLD_PRESETS_S"
      :apply="set('holdS')"
    />
  </PageSection>

  <CustomizeSection>
    <!--
      Which alerts (R12): an eye list per group, as Testigos' and Radar's, first as every page's
      main list; its own accordion, open until closed.
    -->
    <AccordionSection
      :title="t.settings.alerts.listTitle"
      :summary="alertsSummary"
      :open="alertsOpen"
      @toggle="alertsOpen = $event"
    >
      <div class="al-groups">
        <ElementEditor
          v-for="g in groups"
          :key="g.key"
          :title="g.title"
          :items="g.items"
          :spec="g.spec"
          :labels="alertTexts"
          :apply="setAlerts"
          :note="g.note"
          quiet-empty
        />
      </div>
    </AccordionSection>
    <ElementEditor
      :title="zoneTitle(t, 'alerts', 'parts')"
      :items="opts.parts"
      :spec="OPTION_SCHEMA.alerts.parts"
      :labels="partTexts"
      :apply="setParts"
    />
  </CustomizeSection>
</template>
