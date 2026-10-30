<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { widgetTitle } from '@shared/i18n'
import { RELATIVE_CARS_MAX, RELATIVE_CARS_MIN } from '@shared/settings'
import { OPTION_SCHEMA, RELATIVE_PINNED_COLUMNS } from '@shared/settingsSchema'
import { setElementVisible } from '@shared/elements'
import type { RelativeColumnId } from '@shared/types'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { densityChoicesInherit } from '../controls/choices'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import InfoBarEditor from '../elements/InfoBarEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import type { ElementText } from '../elements/listOps'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'
import DriverSection from './DriverSection.vue'
import { useNoRoom } from '../preview/useNoRoom'
import { matchSharedColumns } from '../columns'
import { offerSectionRestore } from '../undo/restore'

/**
 * The relative's page: how many cars, then one editor per zone (the columns, then the header and
 * footer bars), each with the zone's own options below its list. The live sample beside it shows every
 * change.
 */
const opts = useOptions('relative')
const appearance = useAppearance()
const t = useI18n()
const set = optionSetter('relative')
const R = OPTION_SCHEMA.relative

/** The columns' labels, with the hints of those that need one. */
const columnTexts = computed<Readonly<Record<RelativeColumnId, ElementText>>>(() => {
  const base = elementTexts(t.value, 'relative', 'columns')
  const r = t.value.settings.relative
  // The row's fixed start, worded as the standings' (R10).
  const fixed = t.value.settings.columns.fixedHints
  return {
    ...base,
    pos: { label: base.pos.label, hint: fixed.pos },
    driver: { label: base.driver.label, hint: fixed.name },
    pit: { label: base.pit.label, hint: r.pitHelp },
    tyre: { label: base.tyre.label, hint: r.tyreHelp },
    stint: { label: base.stint.label, hint: r.stintHelp }
  }
})
/**
 * «Igualar con Posiciones» (R10): the columns both tables have take the standings' order and
 * eyes; one click, then "Deshacer".
 */
const standings = useOptions('standings')
const matched = shallowRef('')
function matchStandings(): void {
  const done = offerSectionRestore('relative', zoneTitle(t.value, 'relative', 'columns'))
  // The position too: shown or hidden as the standings' (R10).
  const next = setElementVisible(
    matchSharedColumns(opts.value.columns, standings.value.columns),
    'pos',
    standings.value.showPosition
  )
  void listSetter('relative', 'columns')(next)
  done()
  matched.value = t.value.settings.columns.match.done(widgetTitle(t.value, 'standings'))
}
const densityChoices = computed(() => densityChoicesInherit(t.value, appearance.value.density))
/** A window the width sets the text of draws both densities the same: said on the choice. */
const noRoom = useNoRoom()
const densityNote = computed(() => {
  const p = t.value.settings.preview
  return noRoom.value(
    'relative.density',
    () => p.noEffectDensity,
    (w, h) => p.noEffect(`${w} × ${h}`)
  )
})
</script>

<template>
  <PageSection :title="t.settings.common.content" resets="content">
    <StepperControl
      :label="t.settings.relative.carsAhead"
      :current="opts.carsAhead"
      :min="RELATIVE_CARS_MIN"
      :max="RELATIVE_CARS_MAX"
      :apply="set('carsAhead')"
    />
    <StepperControl
      :label="t.settings.relative.carsBehind"
      :current="opts.carsBehind"
      :min="RELATIVE_CARS_MIN"
      :max="RELATIVE_CARS_MAX"
      :apply="set('carsBehind')"
    />
    <ChoiceControl
      :label="t.settings.common.density"
      :current="opts.density"
      :options="densityChoices"
      :note="densityNote"
      :apply="set('density')"
    />
  </PageSection>

  <!-- The «Piloto» block: the same rows here as in the other driver widgets (R08). -->
  <DriverSection section="relative" />

  <CustomizeSection>
    <ElementEditor
      :title="zoneTitle(t, 'relative', 'columns')"
      :items="opts.columns"
      :spec="R.columns"
      :labels="columnTexts"
      :pinned="RELATIVE_PINNED_COLUMNS"
      :apply="listSetter('relative', 'columns')"
    >
      <template #footer>
        <ToggleControl
          kind="switch"
          :label="t.settings.driverCell.columnHeads"
          :help="t.settings.driverCell.columnHeadsHelp"
          :current="opts.columnHeads"
          :apply="set('columnHeads')"
        />
        <div class="st-row match-row">
          <span class="st-help">{{ t.settings.columns.match.help }}</span>
          <button type="button" class="st-btn st-btn-sm" @click="matchStandings">
            {{ t.settings.columns.match.fromStandings }}
          </button>
        </div>
        <p class="st-sr-only" aria-live="polite">{{ matched }}</p>
      </template>
    </ElementEditor>

    <InfoBarEditor section="relative" field="headerBar" />
    <InfoBarEditor section="relative" field="footerBar" />
  </CustomizeSection>
</template>
