<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
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
import ClassOrderControl from './ClassOrderControl.vue'
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
import { useNoRoom } from '../preview/useNoRoom'
import { offerSectionRestore } from '../undo/restore'
import { DEEP_POSITION, previewField, type PreviewField } from '../../widgets/standings/preview'

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
  // The position too: shown or hidden as the relative's (R10).
  const showPosition = relative.value.columns.some((c) => c.id === 'pos' && c.visible)
  void updateSection('standings', {
    ...columnsEditPatch(opts.value, next, { kind: 'reset' }),
    showPosition
  })
  done()
  matched.value = t.value.settings.columns.match.done(widgetTitle(t.value, 'relative'))
}
const compactOff = computed(() => opts.value.mode === 'full')
const densityChoices = computed(() => densityChoicesInherit(t.value, appearance.value.density))
/** The row's fixed start (R10): the position with its eye, as the relative's; the driver locked. */
const setShowPosition = set('showPosition')
const fixed = computed(() =>
  fixedColumns(t.value).map((f) =>
    f.key === 'pos'
      ? {
          ...f,
          visible: opts.value.showPosition,
          toggle: (v: boolean) => void setShowPosition(v)
        }
      : f
  )
)
/** «Ambos» draws the gap to the leader in its column: «No cabe» while the width drops it. */
const noRoom = useNoRoom()
const gapNote = computed(() =>
  opts.value.gapMode === 'both' ? noRoom.value('standings.columns.gapLeader') : undefined
)

/**
 * The sample draws the field the option changed last needs (previewField, as Delta's session):
 * the top rows and the rows around you, with you further down (two blocks, each count seen);
 * the SoF or the car count of an info bar, your class alone (with several classes they are the
 * class lines'); the class line, the other leaders or the class order, every class again. Said
 * under Contenido. Always a third class here (threeClasses), for the class order.
 */
function sampleField(next: Partial<PreviewField>): void {
  previewField.value = { ...previewField.value, ...next }
}
// The page's sample has a third class (GTP), so «Orden de las clases» has an order to show (9).
sampleField({ threeClasses: true })
function withField<V>(next: Partial<PreviewField>, apply: Setter<V>): Setter<V> {
  return (v) => {
    sampleField(next)
    return apply(v)
  }
}
const setTopRows = withField({ deep: true }, set('topRows'))
const setAroundRows = withField({ deep: true }, set('aroundRows'))
const setOtherRows = withField({ singleClass: false }, set('otherClassRows'))
const setClassLine = withField({ singleClass: false }, listSetter('standings', 'classLine'))
/** Where the bars have the SoF and the car count: a change there draws your class alone. */
const barsClassItems = computed(() =>
  INFO_BARS.standings
    .map(([field]) =>
      opts.value[field]
        .filter((e) => e.id === 'sof' || e.id === 'carCount')
        .map((e) => `${e.id}:${e.visible ? 1 : 0}`)
        .join(',')
    )
    .join('|')
)
watch(barsClassItems, () => sampleField({ singleClass: true }))
const sampleNotes = computed(() => {
  const s = t.value.settings.standings
  const f = previewField.value
  return [
    ...(f.deep && !compactOff.value ? [s.previewDeep(DEEP_POSITION)] : []),
    ...(f.singleClass ? [s.previewSingle] : [])
  ]
})
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
          :apply="setTopRows"
        />
        <StepperControl
          :label="t.settings.standings.aroundRows"
          :help="t.settings.standings.aroundRowsHelp"
          :current="opts.aroundRows"
          :min="STANDINGS_ROWS_MIN"
          :max="STANDINGS_ROWS_MAX"
          :apply="setAroundRows"
        />
        <StepperControl
          :label="t.settings.standings.otherClassRows"
          :help="t.settings.standings.otherClassRowsHelp"
          :current="opts.otherClassRows"
          :min="S.otherClassRows.min"
          :max="S.otherClassRows.max"
          :apply="setOtherRows"
        />
      </div>
    </fieldset>
    <ClassOrderControl @changed="sampleField({ singleClass: false })" />
    <ChoiceControl
      :label="t.settings.common.density"
      :current="opts.density"
      :options="densityChoices"
      :apply="set('density')"
    />
    <p v-for="n in sampleNotes" :key="n" class="st-row st-help sd-sample-note">{{ n }}</p>
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
      <!--
        An element's option in its own row (R12): which gap on the gap column, every row's stake
        on the stake column.
      -->
      <template #extra="{ id, visible }">
        <ChoiceControl
          v-if="id === 'gap' && visible"
          :label="t.settings.standings.gap"
          :help="t.settings.standings.gapHelp"
          :current="opts.gapMode"
          :options="gapChoices"
          :note="gapNote"
          :apply="setGapMode"
        />
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
      :apply="setClassLine"
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
.sd-sample-note {
  display: block;
}

.compact-body {
  clear: both;
  display: flex;
  flex-direction: column;
  padding-left: 12px;
  border-left: 2px solid var(--st-border-hi);
}

.compact-body > :deep(.st-row) {
  padding: 8px 0;
}

.compact-body > * + * {
  border-top: 1px solid var(--st-border);
}
</style>
