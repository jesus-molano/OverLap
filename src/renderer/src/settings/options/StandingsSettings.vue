<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { widgetTitle } from '@shared/i18n'
import { INFO_BARS } from '@shared/infoBar'
import {
  STANDINGS_GAP_MODES,
  STANDINGS_MODES,
  STANDINGS_ROWS_MAX,
  STANDINGS_ROWS_MIN
} from '@shared/settings'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import type { ElementEntry, StandingsColumnId, StandingsOptions } from '@shared/types'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import {
  columnsEditPatch,
  deltaAllDroppedAfter,
  deltaAllPatch,
  fixedColumns,
  gapModePatch,
  matchSharedColumns
} from '../columns'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import { densityChoicesInherit } from '../controls/choices'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { listSetter, optionSetter, updateSection, type Setter } from '../editor'
import ElementEditor from '../elements/ElementEditor.vue'
import InfoBarEditor from '../elements/InfoBarEditor.vue'
import { elementTexts, zoneTitle } from '../elements/labels'
import type { ElementChange } from '../elements/listOps'
import CustomizeSection from '../layout/CustomizeSection.vue'
import PageSection from '../layout/PageSection.vue'
import DriverSection from './DriverSection.vue'
import { offerSectionRestore } from '../undo/restore'

/**
 * The standings' page: what the table shows (mode, rows, gap, names), then one editor per zone
 * in every page's order (customizeZones): the columns (with the column heads, the makes and the
 * flags), the class line, then the header, its second line and the footer (the info bars). The
 * live sample beside it shows every change.
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
const gapChoices = computed(() =>
  choiceOptions(STANDINGS_GAP_MODES, t.value.settings.standings.gapChoices)
)

// Options that also change the column list (settings/columns.ts).
const setGapMode: Setter<O['gapMode']> = (gapMode) =>
  updateSection('standings', gapModePatch(opts.value, gapMode))
/**
 * A hide of the delta column turned "iRating en juego de todos" off: its "Deshacer" turns it back
 * on.
 */
let deltaAllDropped = false
const setDeltaAll: Setter<boolean> = (on) => {
  deltaAllDropped = false
  return updateSection('standings', deltaAllPatch(opts.value, on))
}
const applyColumns = (
  next: ElementEntry<StandingsColumnId>[],
  change: ElementChange<StandingsColumnId>
): Promise<void> => {
  const patch = columnsEditPatch(opts.value, next, change, deltaAllDropped)
  deltaAllDropped = deltaAllDroppedAfter(deltaAllDropped, change, patch)
  return updateSection('standings', patch)
}

/**
 * «Igualar con Relativo» (R10): the columns both tables have take the relative's order and eyes
 * (with the options that go with the columns, as a reset brings them); then "Deshacer".
 */
const relative = useOptions('relative')
const matched = shallowRef('')
function matchRelative(): void {
  const done = offerSectionRestore('standings', zoneTitle(t.value, 'standings', 'columns'))
  const next = matchSharedColumns(opts.value.columns, relative.value.columns)
  void updateSection('standings', columnsEditPatch(opts.value, next, { kind: 'reset' }))
  done()
  matched.value = t.value.settings.columns.match.done(widgetTitle(t.value, 'relative'))
}
const compactOff = computed(() => opts.value.mode === 'full')
const densityChoices = computed(() => densityChoicesInherit(t.value, appearance.value.density))
const fixed = computed(() => fixedColumns(t.value))
</script>

<template>
  <PageSection :title="t.settings.common.content" resets="content">
    <ChoiceControl
      :label="t.settings.standings.mode"
      :current="opts.mode"
      :options="modeChoices"
      :apply="set('mode')"
    />
    <!-- Only in compact mode: hidden in full mode, their values kept. -->
    <fieldset v-if="!compactOff" class="st-fieldset compact">
      <legend class="st-label">{{ t.settings.standings.compact }}</legend>
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
    <ChoiceControl
      :label="t.settings.common.density"
      :current="opts.density"
      :options="densityChoices"
      :apply="set('density')"
    />
  </PageSection>

  <!-- The «Piloto» block: the same rows here as in the other driver widgets (R08). -->
  <DriverSection section="standings" />

  <CustomizeSection>
    <ElementEditor
      :title="zoneTitle(t, 'standings', 'columns')"
      :items="opts.columns"
      :spec="S.columns"
      :labels="elementTexts(t, 'standings', 'columns')"
      :fixed-before="fixed"
      :apply="applyColumns"
    >
      <!-- An element's option in its own row (R12): every row's stake, on the stake column. -->
      <template #extra="{ id, visible }">
        <ToggleControl
          v-if="id === 'delta' && visible"
          :label="t.settings.standings.deltaAll"
          :help="t.settings.standings.deltaAllHelp"
          :current="opts.iRatingDeltaAll"
          :apply="setDeltaAll"
        />
      </template>
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
          <button type="button" class="st-btn st-btn-sm" @click="matchRelative">
            {{ t.settings.columns.match.fromRelative }}
          </button>
        </div>
        <p class="st-sr-only" aria-live="polite">{{ matched }}</p>
      </template>
    </ElementEditor>

    <ElementEditor
      :title="zoneTitle(t, 'standings', 'classLine')"
      :items="opts.classLine"
      :spec="S.classLine"
      :labels="elementTexts(t, 'standings', 'classLine')"
      :apply="listSetter('standings', 'classLine')"
    />

    <InfoBarEditor
      v-for="[field] in INFO_BARS.standings"
      :key="field"
      section="standings"
      :field="field"
    />
  </CustomizeSection>
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
</style>
