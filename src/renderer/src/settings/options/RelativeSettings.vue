<script setup lang="ts">
import { computed } from 'vue'
import { INFO_BAR_SIZES } from '@shared/infoBar'
import { RELATIVE_CARS_MAX, RELATIVE_CARS_MIN } from '@shared/settings'
import { BRAND_MARK_CHOICES, OPTION_SCHEMA } from '@shared/settingsSchema'
import type { RelativeColumnId } from '@shared/types'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { inherit } from '../../view/appearance'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import { nameExample, nameFormatChoicesInherit } from '../controls/choices'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import type { ElementText } from '../elements/listOps'
import PageSection from '../layout/PageSection.vue'

/**
 * The relative's page: how many cars, then one editor per zone (columns, header bar, footer
 * bar), each with the zone's own options below its list. The live sample beside it shows every
 * change.
 */
const opts = useOptions('relative')
const appearance = useAppearance()
const t = useI18n()
const set = optionSetter('relative')
const R = OPTION_SCHEMA.relative

const nameChoices = computed(() => nameFormatChoicesInherit(t.value, appearance.value.nameFormat))
const nameHelp = computed(() =>
  nameExample(t.value, inherit(opts.value.nameFormat, appearance.value.nameFormat))
)

/** The columns' labels, with the hints of the two that need one. */
const columnTexts = computed<Readonly<Record<RelativeColumnId, ElementText>>>(() => {
  const base = elementTexts(t.value, 'relative', 'columns')
  const r = t.value.settings.relative
  return {
    ...base,
    tyre: { label: base.tyre.label, hint: r.tyreHelp },
    stint: { label: base.stint.label, hint: r.stintHelp }
  }
})
const barTexts = computed(() => elementTexts(t.value, 'relative', 'headerBar'))
const brandChoices = computed(() =>
  choiceOptions(BRAND_MARK_CHOICES, t.value.settings.driverCell.brandChoices)
)
const sizeChoices = computed(() =>
  choiceOptions(INFO_BAR_SIZES, t.value.settings.infoBar.sizeChoices)
)

// The trend arrow and the wind dial are the section's options: offered on whichever bar shows
// the item, greyed out while it is hidden or its bar is off.
const headerOff = computed(() => opts.value.headerBarSize === 'off')
const footerOff = computed(() => opts.value.footerBarSize === 'off')
</script>

<template>
  <PageSection :title="t.settings.common.content">
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
    <ToggleControl
      kind="switch"
      :label="t.settings.common.penaltyFlags"
      :help="t.settings.common.penaltyFlagsHelp"
      :current="opts.showFlags"
      :apply="set('showFlags')"
    />
    <ChoiceControl
      :label="t.settings.common.nameFormat"
      :help="nameHelp"
      stack
      :current="opts.nameFormat"
      :options="nameChoices"
      :apply="set('nameFormat')"
    />
  </PageSection>

  <ElementEditor
    :title="zoneTitle(t, 'relative', 'columns')"
    :items="opts.columns"
    :spec="R.columns"
    :labels="columnTexts"
    :apply="listSetter('relative', 'columns')"
  >
    <template #footer>
      <div class="rl-zone-opts">
        <ToggleControl
          kind="switch"
          :label="t.settings.driverCell.columnHeads"
          :help="t.settings.driverCell.columnHeadsHelp"
          :current="opts.columnHeads"
          :apply="set('columnHeads')"
        />
        <ChoiceControl
          :label="t.settings.driverCell.brandMarks"
          :help="t.settings.driverCell.brandMarksHelp"
          :current="opts.brandMarks"
          :options="brandChoices"
          :apply="set('brandMarks')"
        />
        <ToggleControl
          kind="switch"
          :label="t.settings.driverCell.countryFlags"
          :help="t.settings.driverCell.countryFlagsHelp"
          :current="opts.countryFlags"
          :apply="set('countryFlags')"
        />
      </div>
    </template>
  </ElementEditor>

  <ElementEditor
    :title="zoneTitle(t, 'relative', 'headerBar')"
    :items="opts.headerBar"
    :spec="R.headerBar"
    :labels="barTexts"
    :apply="listSetter('relative', 'headerBar')"
  >
    <template #extra="{ id, visible }">
      <ToggleControl
        v-if="id === 'trackTemp'"
        :label="t.settings.conditionsFooter.trend"
        :current="opts.conditionsTrend"
        :disabled="!visible || headerOff"
        :apply="set('conditionsTrend')"
      />
      <ToggleControl
        v-else-if="id === 'wind'"
        :label="t.settings.conditionsFooter.windDirection"
        :current="opts.conditionsWindDirection"
        :disabled="!visible || headerOff"
        :apply="set('conditionsWindDirection')"
      />
    </template>
    <template #footer>
      <div class="rl-zone-opts">
        <ChoiceControl
          :label="t.settings.infoBar.size"
          :help="t.settings.infoBar.fitNote"
          :current="opts.headerBarSize"
          :options="sizeChoices"
          :apply="set('headerBarSize')"
        />
      </div>
    </template>
  </ElementEditor>

  <ElementEditor
    :title="zoneTitle(t, 'relative', 'footerBar')"
    :items="opts.footerBar"
    :spec="R.footerBar"
    :labels="barTexts"
    :apply="listSetter('relative', 'footerBar')"
  >
    <template #extra="{ id, visible }">
      <ToggleControl
        v-if="id === 'trackTemp'"
        :label="t.settings.conditionsFooter.trend"
        :current="opts.conditionsTrend"
        :disabled="!visible || footerOff"
        :apply="set('conditionsTrend')"
      />
      <ToggleControl
        v-else-if="id === 'wind'"
        :label="t.settings.conditionsFooter.windDirection"
        :current="opts.conditionsWindDirection"
        :disabled="!visible || footerOff"
        :apply="set('conditionsWindDirection')"
      />
    </template>
    <template #footer>
      <div class="rl-zone-opts">
        <ChoiceControl
          :label="t.settings.infoBar.size"
          :help="t.settings.infoBar.fitNote"
          :current="opts.footerBarSize"
          :options="sizeChoices"
          :apply="set('footerBarSize')"
        />
      </div>
    </template>
  </ElementEditor>
</template>

<style scoped>
/* The zone's own options under its list, ruled off from it. */
.rl-zone-opts {
  display: grid;
  gap: 2px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--st-border);
}
</style>
