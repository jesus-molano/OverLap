<script setup lang="ts">
import { computed } from 'vue'
import {
  STANDINGS_GAP_MODES,
  STANDINGS_MODES,
  STANDINGS_ROWS_MAX,
  STANDINGS_ROWS_MIN
} from '@shared/settings'
import type { StandingsOptions } from '@shared/types'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { inherit } from '../../view/appearance'
import { deltaAllPatch, gapModePatch } from '../columns'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions } from '../controls/choice'
import { densityChoicesInherit, nameExample, nameFormatChoicesInherit } from '../controls/choices'
import StepperControl from '../controls/StepperControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter, updateSection, type Setter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import ConditionsFooterSection from './ConditionsFooterSection.vue'
import StandingsColumns from './StandingsColumns.vue'

const opts = useOptions('standings')
const appearance = useAppearance()
const t = useI18n()
const set = optionSetter('standings')

type S = StandingsOptions

const modeChoices = computed(() =>
  choiceOptions(STANDINGS_MODES, t.value.settings.standings.modeChoices)
)
const modeHelp = computed(() => t.value.settings.standings.modeChoices[opts.value.mode].hint)
const gapChoices = computed(() =>
  choiceOptions(STANDINGS_GAP_MODES, t.value.settings.standings.gapChoices)
)

// Options that also change the column list (see columns.ts).
const setGapMode: Setter<S['gapMode']> = (gapMode) =>
  updateSection('standings', gapModePatch(opts.value, gapMode))
const setDeltaAll: Setter<boolean> = (on) =>
  updateSection('standings', deltaAllPatch(opts.value, on))

const compactOff = computed(() => opts.value.mode === 'full')
const nameChoices = computed(() => nameFormatChoicesInherit(t.value, appearance.value.nameFormat))
const nameHelp = computed(() =>
  nameExample(t.value, inherit(opts.value.nameFormat, appearance.value.nameFormat))
)
const densityChoices = computed(() => densityChoicesInherit(t.value, appearance.value.density))
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
    <CheckGroup :legend="t.settings.standings.header" :help="t.settings.standings.headerHelp">
      <ToggleControl
        :label="t.settings.common.iRating"
        :current="opts.headerIRating"
        :apply="set('headerIRating')"
      />
      <ToggleControl
        :label="t.settings.standings.safetyRating"
        :current="opts.headerSafetyRating"
        :apply="set('headerSafetyRating')"
      />
      <ToggleControl
        :label="t.settings.standings.incidents"
        :help="t.settings.standings.incidentsHelp"
        :current="opts.headerIncidents"
        :apply="set('headerIncidents')"
      />
    </CheckGroup>
    <CheckGroup :legend="t.settings.standings.classLine">
      <ToggleControl
        :label="t.settings.standings.sof"
        :current="opts.showSof"
        :apply="set('showSof')"
      />
      <ToggleControl
        :label="t.settings.standings.carCount"
        :current="opts.showCarCount"
        :apply="set('showCarCount')"
      />
    </CheckGroup>
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

  <StandingsColumns />

  <ConditionsFooterSection section="standings" />
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
</style>
