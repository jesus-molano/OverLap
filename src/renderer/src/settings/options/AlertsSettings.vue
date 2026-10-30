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
import {
  ALERTS_SPEC,
  ALERT_GROUP_HEADS,
  allAlertItems,
  alertPatch,
  lightOfAlert,
  lightShown,
  lightsPatch,
  type AlertKey
} from '../alertsList'
import ToggleControl from '../controls/ToggleControl.vue'
import SiblingLink from '../layout/SiblingLink.vue'
import type { ElementText } from '../elements/listOps'
import AccordionSection from '../layout/AccordionSection.vue'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'
import { formatSeconds } from '../values'

const opts = useOptions('alerts')
/** Testigos' lamps of the events both widgets have (R39). */
const lights = useOptions('lights')
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

/** The band's extras, each with what it is, as every alert has. */
const partTexts = computed(() => {
  const base = elementTexts(t.value, 'alerts', 'parts')
  const a = t.value.settings.alerts
  return {
    notes: { label: base.notes.label, hint: a.notesHelp },
    chips: { label: base.chips.label, hint: a.chipsHelp }
  }
})

/** The alerts as one eye list in groups (alertsList.ts), worded with their old hints. */
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
const alertItemsNow = computed(() => allAlertItems(opts.value))
/** Each group's name above its first alert: one list, one reset, one help (R12). */
const groupHeads = computed(() => {
  const g = t.value.settings.alerts.groups
  return Object.fromEntries(ALERT_GROUP_HEADS.map(([id, key]) => [id, g[key]])) as Partial<
    Record<AlertKey, string>
  >
})
/** '12 de 15 visibles', as every list's count. */
const alertsSummary = computed(() => {
  const all = alertItemsNow.value
  return t.value.settings.elements.count(all.filter((e) => e.visible).length, all.length)
})
const alertsOpen = shallowRef(true)
const setAlerts = (next: ElementEntry<AlertKey>[]): Promise<void> =>
  updateSection('alerts', alertPatch(next))
const setParts = listSetter('alerts', 'parts')
const NOOP = (): Promise<void> => Promise.resolve()
/** Its setter, for the box (a row without a lamp never shows one). */
const setLight = (id: AlertKey): ((on: boolean) => Promise<void>) => lightBox(id)?.set ?? NOOP
/** The «Testigo» box of a shared event: its lamp in Testigos, shown or hidden there. */
function lightBox(id: AlertKey): { on: boolean; set: (on: boolean) => Promise<void> } | null {
  const kind = lightOfAlert(id)
  if (kind === null) return null
  return {
    on: lightShown(lights.value, kind),
    set: (on) => updateSection('lights', lightsPatch(lights.value, kind, on))
  }
}
</script>

<template>
  <PageSection :title="t.settings.common.content" resets="content">
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
      Which alerts (R12): one eye list in groups, as Testigos' and Radar's, first as every page's
      main list; its own accordion, open until closed. A click on an alert in the preview hides it.
    -->
    <AccordionSection
      :title="t.settings.alerts.listTitle"
      :summary="alertsSummary"
      :open="alertsOpen"
      @toggle="alertsOpen = $event"
    >
      <div class="al-list">
        <ElementEditor
          :title="t.settings.alerts.listTitle"
          :items="alertItemsNow"
          :spec="ALERTS_SPEC"
          :labels="alertTexts"
          :apply="setAlerts"
          :groups="groupHeads"
          preview-zone="alerts.alerts"
          embedded
        >
          <template #extra="{ id }">
            <ToggleControl
              v-if="lightBox(id) !== null"
              :label="t.settings.alerts.alsoLight"
              :name="t.settings.alerts.alsoLightLabel(alertTexts[id].label)"
              :current="lightBox(id)?.on ?? false"
              :apply="setLight(id)"
            />
          </template>
        </ElementEditor>
        <SiblingLink :text="t.settings.alerts.sharedNote" page="lights" />
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

<style scoped>
/* The one list inside its accordion, inset as every zone's list is (ElementEditor .ed). */
.al-list {
  padding: 12px 16px 12px;
}

/* No frame of its own inside the accordion: one card, as every zone. */
.al-list :deep(.ed) {
  border: 0;
  background: transparent;
  box-shadow: none;
}
</style>
