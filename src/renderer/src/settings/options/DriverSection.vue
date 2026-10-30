<script setup lang="ts">
import { computed } from 'vue'
import type { DriverBlockSection } from '@shared/driverBlock'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import ChoiceControl from '../controls/ChoiceControl.vue'
import {
  brandChoicesInherit,
  flagChoicesInherit,
  fromFlagChoice,
  nameFormatChoicesInherit,
  toFlagChoice,
  type FlagChoice
} from '../controls/choices'
import { optionSetter, type Setter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import { useNoRoom } from '../preview/useNoRoom'

/**
 * The «Piloto» block (R08): the same four rows, in the same place (after Contenido) and order, on
 * the pages of the four widgets that draw drivers (Relativo, Posiciones, Batalla, Tráfico): name
 * format, make logo, country flag, penalty flags. Each one «Global (…)» by default, Apariencia's
 * value, or its own.
 */
const props = defineProps<{ section: DriverBlockSection }>()

const t = useI18n()
const appearance = useAppearance()
const opts = useOptions(props.section)
// The four fields have the same type in the four sections.
const set = optionSetter(props.section) as unknown as <V>(field: string) => Setter<V>
const setName = set<string>('nameFormat')
const setBrand = set<string>('brandMarks')
const setCountry = set<boolean | 'inherit'>('countryFlags')
const setPenalty = set<boolean | 'inherit'>('showFlags')
const setCountryChoice: Setter<FlagChoice> = (v) => setCountry(fromFlagChoice(v))
const setPenaltyChoice: Setter<FlagChoice> = (v) => setPenalty(fromFlagChoice(v))

const nameChoices = computed(() => nameFormatChoicesInherit(t.value, appearance.value.nameFormat))
const brandChoices = computed(() => brandChoicesInherit(t.value, appearance.value.brandMarks))
const countryChoices = computed(() => flagChoicesInherit(t.value, appearance.value.countryFlags))
const penaltyChoices = computed(() => flagChoicesInherit(t.value, appearance.value.penaltyFlags))
/** The mark and the flag the preview has no room for at the widget's width (Posiciones). */
const noRoom = useNoRoom()
</script>

<template>
  <PageSection :title="t.settings.driverBlock.title" resets="driver">
    <ChoiceControl
      :label="t.settings.common.nameFormat"
      stack
      :current="opts.nameFormat"
      :options="nameChoices"
      :apply="setName"
    />
    <ChoiceControl
      :label="t.settings.driverCell.brandMarks"
      :help="t.settings.driverCell.brandMarksHelp"
      :current="opts.brandMarks"
      :options="brandChoices"
      :note="noRoom(`${section}.driver.brandMarks`)"
      :apply="setBrand"
    />
    <ChoiceControl
      :label="t.settings.driverCell.countryFlags"
      :help="t.settings.driverCell.countryFlagsHelp"
      :current="toFlagChoice(opts.countryFlags)"
      :options="countryChoices"
      :note="noRoom(`${section}.driver.countryFlags`)"
      :apply="setCountryChoice"
    />
    <ChoiceControl
      :label="t.settings.common.penaltyFlags"
      :help="t.settings.common.penaltyFlagsHelp"
      :current="toFlagChoice(opts.showFlags)"
      :options="penaltyChoices"
      :apply="setPenaltyChoice"
    />
  </PageSection>
</template>
