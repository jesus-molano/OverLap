<script setup lang="ts">
import { computed } from 'vue'
import { INFO_BAR_SIZES } from '@shared/infoBar'
import {
  STANDINGS_GAP_MODES,
  STANDINGS_MODES,
  STANDINGS_ROWS_MAX,
  STANDINGS_ROWS_MIN
} from '@shared/settings'
import { BRAND_MARK_CHOICES, OPTION_SCHEMA } from '@shared/settingsSchema'
import type {
  ElementEntry,
  InfoBarEntryId,
  InfoBarSize,
  StandingsColumnId,
  StandingsOptions
} from '@shared/types'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { inherit } from '../../view/appearance'
import { columnsEditPatch, deltaAllPatch, fixedColumns, gapModePatch } from '../columns'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import { densityChoicesInherit, nameExample, nameFormatChoicesInherit } from '../controls/choices'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter, updateSection, type Setter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import type { ElementChange } from '../elements/listOps'
import PageSection from '../layout/PageSection.vue'

/**
 * The standings' page: what the table shows (mode, rows, gap, names), then one editor per zone
 * in the widget's order: the columns (with the column heads, the makes and the flags), the
 * header, its second line and the footer (the info bars, each with its size), and the class
 * line. The live sample beside it shows every change.
 */
const opts = useOptions('standings')
const appearance = useAppearance()
const t = useI18n()
const set = optionSetter('standings')
const S = OPTION_SCHEMA.standings

type O = StandingsOptions

const modeChoices = computed(() =>
  choiceOptions(STANDINGS_MODES, t.value.settings.standings.modeChoices)
)
const modeHelp = computed(() => t.value.settings.standings.modeChoices[opts.value.mode].hint)
const gapChoices = computed(() =>
  choiceOptions(STANDINGS_GAP_MODES, t.value.settings.standings.gapChoices)
)

// Options that also change the column list (settings/columns.ts).
const setGapMode: Setter<O['gapMode']> = (gapMode) =>
  updateSection('standings', gapModePatch(opts.value, gapMode))
const setDeltaAll: Setter<boolean> = (on) =>
  updateSection('standings', deltaAllPatch(opts.value, on))
const applyColumns = (
  next: ElementEntry<StandingsColumnId>[],
  change: ElementChange<StandingsColumnId>
): Promise<void> => updateSection('standings', columnsEditPatch(opts.value, next, change))

const compactOff = computed(() => opts.value.mode === 'full')
const nameChoices = computed(() => nameFormatChoicesInherit(t.value, appearance.value.nameFormat))
const nameHelp = computed(() =>
  nameExample(t.value, inherit(opts.value.nameFormat, appearance.value.nameFormat))
)
const densityChoices = computed(() => densityChoicesInherit(t.value, appearance.value.density))
const brandChoices = computed(() =>
  choiceOptions(BRAND_MARK_CHOICES, t.value.settings.driverCell.brandChoices)
)
const sizeChoices = computed(() =>
  choiceOptions(INFO_BAR_SIZES, t.value.settings.infoBar.sizeChoices)
)
const fixed = computed(() => fixedColumns(t.value))
const barTexts = computed(() => elementTexts(t.value, 'standings', 'headerBar'))

type BarField = 'headerBar' | 'subheaderBar' | 'footerBar'

/** One info bar's editor: its list and its size. */
interface BarZone {
  readonly field: BarField
  readonly title: string
  readonly items: readonly Readonly<ElementEntry<InfoBarEntryId>>[]
  readonly spec: (typeof S)[BarField]
  readonly apply: Setter<ElementEntry<InfoBarEntryId>[]>
  readonly size: InfoBarSize
  readonly setSize: Setter<InfoBarSize>
}

/** The three bars, top to bottom: the header, its second line, the footer. */
const BAR_FIELDS: readonly BarField[] = ['headerBar', 'subheaderBar', 'footerBar']

const bars = computed<readonly BarZone[]>(() =>
  BAR_FIELDS.map((field) => {
    const sizeField = `${field}Size` as const
    return {
      field,
      title: zoneTitle(t.value, 'standings', field),
      items: opts.value[field],
      spec: S[field],
      apply: listSetter('standings', field),
      size: opts.value[sizeField],
      setSize: set(sizeField)
    }
  })
)
</script>

<template>
  <PageSection :title="t.settings.common.content">
    <ChoiceControl
      :label="t.settings.standings.mode"
      :help="modeHelp"
      :current="opts.mode"
      :options="modeChoices"
      :apply="set('mode')"
    />
    <!-- A disabled fieldset disables every control inside: these only apply in compact mode. -->
    <fieldset class="st-fieldset compact" :disabled="compactOff">
      <legend class="st-label">
        {{ t.settings.standings.compact }}
        <span v-if="compactOff" class="st-help off-note">{{
          t.settings.standings.compactOff
        }}</span>
      </legend>
      <div class="compact-body">
        <StepperControl
          :label="t.settings.standings.topRows"
          :help="t.settings.standings.topRowsHelp"
          :current="opts.topRows"
          :min="STANDINGS_ROWS_MIN"
          :max="STANDINGS_ROWS_MAX"
          :apply="set('topRows')"
        />
        <StepperControl
          :label="t.settings.standings.aroundRows"
          :help="t.settings.standings.aroundRowsHelp"
          :current="opts.aroundRows"
          :min="STANDINGS_ROWS_MIN"
          :max="STANDINGS_ROWS_MAX"
          :apply="set('aroundRows')"
        />
        <ToggleControl
          kind="switch"
          :label="t.settings.standings.leaders"
          :help="t.settings.standings.leadersHelp"
          :current="opts.otherClassLeaders"
          :apply="set('otherClassLeaders')"
        />
      </div>
    </fieldset>
    <ChoiceControl
      :label="t.settings.standings.gap"
      :help="t.settings.standings.gapHelp"
      :current="opts.gapMode"
      :options="gapChoices"
      :apply="setGapMode"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.standings.deltaAll"
      :help="t.settings.standings.deltaAllHelp"
      :current="opts.iRatingDeltaAll"
      :apply="setDeltaAll"
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
    <ChoiceControl
      :label="t.settings.common.density"
      :current="opts.density"
      :options="densityChoices"
      :apply="set('density')"
    />
  </PageSection>

  <ElementEditor
    :title="zoneTitle(t, 'standings', 'columns')"
    :items="opts.columns"
    :spec="S.columns"
    :labels="elementTexts(t, 'standings', 'columns')"
    :fixed-before="fixed"
    :apply="applyColumns"
  >
    <template #footer>
      <div class="sd-zone-opts">
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
    v-for="bar in bars"
    :key="bar.field"
    :title="bar.title"
    :items="bar.items"
    :spec="bar.spec"
    :labels="barTexts"
    :apply="bar.apply"
  >
    <!-- The trend arrow and the wind dial are the section's options: on whichever bar shows
         the item, greyed out while it is hidden or its bar is off. -->
    <template #extra="{ id, visible }">
      <ToggleControl
        v-if="id === 'trackTemp'"
        :label="t.settings.conditionsFooter.trend"
        :current="opts.conditionsTrend"
        :disabled="!visible || bar.size === 'off'"
        :apply="set('conditionsTrend')"
      />
      <ToggleControl
        v-else-if="id === 'wind'"
        :label="t.settings.conditionsFooter.windDirection"
        :current="opts.conditionsWindDirection"
        :disabled="!visible || bar.size === 'off'"
        :apply="set('conditionsWindDirection')"
      />
    </template>
    <template #footer>
      <div class="sd-zone-opts">
        <ChoiceControl
          :label="t.settings.infoBar.size"
          :help="t.settings.infoBar.fitNote"
          :current="bar.size"
          :options="sizeChoices"
          :apply="bar.setSize"
        />
      </div>
    </template>
  </ElementEditor>

  <ElementEditor
    :title="zoneTitle(t, 'standings', 'classLine')"
    :items="opts.classLine"
    :spec="S.classLine"
    :labels="elementTexts(t, 'standings', 'classLine')"
    :apply="listSetter('standings', 'classLine')"
  />
</template>

<style scoped>
.compact-body {
  clear: both;
  display: flex;
  flex-direction: column;
  padding-left: 12px;
  border-left: 2px solid var(--st-border-hi);
}

.compact-body > :deep(.st-row) {
  padding: 7px 0;
}

.compact-body > * + * {
  border-top: 1px solid var(--st-border);
}

.compact:disabled .compact-body {
  opacity: 0.45;
}

.off-note {
  margin-left: 6px;
  font-weight: 400;
}

/* A zone's own options under its list, ruled like a card's rows. */
.sd-zone-opts {
  display: flex;
  flex-direction: column;
}

.sd-zone-opts > * + * {
  border-top: 1px solid var(--st-border);
}
</style>
