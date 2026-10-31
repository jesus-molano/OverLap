<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { LANGUAGES, LANGUAGE_NAMES, type Language } from '@shared/i18n'
import {
  APPEARANCE_PARTS,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  type AppearancePart
} from '@shared/settings'
import { ACCENT_PRESETS, OPTION_SCHEMA } from '@shared/settingsSchema'
import type { SettingsPatch } from '@shared/types'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n, useLocale } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useOptions } from '../../composables/useWidgetSettings'
import BrandMark from '../../ui/BrandMark.vue'
import LicenseChip from '../../ui/LicenseChip.vue'
import NumberBadge from '../../ui/NumberBadge.vue'
import { createDriverStyles } from '../../view/styles'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions, type ChoiceOption } from '../controls/choice'
import {
  densityChoices,
  flagChoices,
  iRatingFormatChoices,
  nameExample,
  nameFormatChoices
} from '../controls/choices'
import { fromChoice, toChoice, type BoolChoice } from '../controls/choice'
import ColorControl from '../controls/ColorControl.vue'
import HelpText from '../controls/HelpText.vue'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { followGlobalPatch, ownBackgrounds } from '../backgrounds'
import { inheritDriverBlocks, ownDriverBlocks, type DriverBlockOptions } from '@shared/driverBlock'
import { optionSetter } from '../editor'
import { useNavigate } from '../navigate'
import {
  appearanceAtDefault,
  appearancePartAtDefault,
  followGlobal,
  resetAppearance,
  resetAppearancePart
} from '../undo/restore'
import ResetMenu from '../layout/ResetMenu.vue'
import type { ResetItem } from '../layout/resetItems'
import PageFrame from '../layout/PageFrame.vue'
import PageSection from '../layout/PageSection.vue'
import AppearancePresets from './AppearancePresets.vue'
import SampleStage from '../layout/SampleStage.vue'
import { fontScaleHelp as fontScaleHelpText } from '../appearanceHelp'
import { SAMPLE_CHIPS } from '../samples/sampleData'
import WidgetSample from '../samples/WidgetSample.vue'
import { dayUnreadable } from '../opacityNote'
import { SIZE_PRESETS, formatPercent, fromPercent, toPercent } from '../values'

/**
 * Global look shared by every widget (settings.appearance): live preview (fixed), then the options
 * (they scroll). When the overlay shows is on the «Visibilidad» page (R34). The default slot closes the scrolling
 * part (the window's foot).
 */
const appearance = useAppearance()
const t = useI18n()
const locale = useLocale()
const titleId = useId()
const set = optionSetter('appearance')
/** The «Piloto» block's flags as «Sí / No», the same control as on each widget (R08). */
const yesNo = computed(() => flagChoices(t.value))
/** The iRating's «2.5k» / «2.520» (request 10), the second in the language's thousands. */
const irFormatChoices = computed(() => iRatingFormatChoices(t.value))
const setFlag =
  (key: 'countryFlags' | 'penaltyFlags' | 'iRatingColor') =>
  (v: BoolChoice): Promise<unknown> =>
    set(key)(fromChoice(v))

const A = OPTION_SCHEMA.appearance
/** Slider readout in the current language; a new function only when the language changes. */
const percent = computed(() => (v: number) => formatPercent(t.value, v))

/** Each language in its own name, whatever the current one. */
const LANGUAGE_CHOICES: readonly ChoiceOption<Language>[] = LANGUAGES.map((value) => ({
  value,
  label: LANGUAGE_NAMES[value]
}))

// Worded again only when the language changes.
const accentPresets = computed(() => {
  const names = t.value.settings.appearance.color.accentNames
  return ACCENT_PRESETS.map((p) => ({ value: p.value, label: names[p.name] }))
})
const nameChoices = computed(() => nameFormatChoices(t.value))
const haloChoices = computed(() =>
  choiceOptions(A.textHalo.values, t.value.settings.appearance.text.haloChoices)
)
const densityOptions = computed(() => densityChoices(t.value))
const licenseChoices = computed(() =>
  choiceOptions(A.licenseStyle.values, t.value.settings.appearance.rows.licenseChoices)
)
const numberChoices = computed(() =>
  choiceOptions(A.numberStyle.values, t.value.settings.appearance.rows.numberChoices)
)
const brandMarkChoices = computed(() =>
  choiceOptions(A.brandMarks.values, t.value.settings.driverCell.brandChoices)
)
const brandLogoChoices = computed(() =>
  choiceOptions(A.brandLogos.values, t.value.settings.appearance.rows.brandLogoChoices)
)
const unitChoices = computed(() =>
  choiceOptions(A.units.values, t.value.settings.appearance.other.unitChoices)
)
const OPACITY_PRESETS = [25, 50, 80, 100] as const
/** The preview on «Día» shows the global background hard to read: said under it. */
const windowOptions = useOptions('settingsWindow')
const dayNote = computed(() =>
  dayUnreadable(windowOptions.value.stageScene, appearance.value.backgroundOpacity)
    ? t.value.settings.window.dayUnreadable
    : undefined
)
const setBackground = (pct: number): Promise<void> => set('backgroundOpacity')(fromPercent(pct))
/**
 * The widgets that keep their own background (every one after an update from 2.2: the look
 * stays) do not follow the slider above: said, with one button to set them all to «Global».
 */
const { settings } = useOverlayState()
const ownBg = computed(() => (settings.value ? ownBackgrounds(settings.value.widgets) : []))
const followedMsg = ref('')
/** One click, then "Deshacer" (R11): each widget's own background comes back. */
async function followGlobalBg(): Promise<void> {
  const ids = ownBg.value
  const widgets = settings.value?.widgets
  if (ids.length === 0 || widgets === undefined) return
  const before: NonNullable<SettingsPatch['widgets']> = {}
  for (const id of ids) before[id] = { backgroundOpacity: widgets[id].backgroundOpacity }
  await followGlobal(ids, (m) => m.settings.appearance.color.background, followGlobalPatch(ids), {
    widgets: before
  })
  followedMsg.value = t.value.settings.appearance.color.followGlobalDone
}
/**
 * The driver widgets with a «Piloto» block of their own (all of them after an update: what they
 * drew stays) do not follow the rows above: said, with one button to set them all to «Global».
 */
const ownBlocks = computed(() => (settings.value ? ownDriverBlocks(settings.value) : []))
const followedBlocksMsg = ref('')
/** One click, then "Deshacer" (R11): each widget's own «Piloto» values come back. */
async function followBlocks(): Promise<void> {
  const ids = ownBlocks.value
  const s = settings.value
  if (ids.length === 0 || s === null) return
  const before: Record<string, DriverBlockOptions> = {}
  for (const id of ids) {
    const { nameFormat, brandMarks, countryFlags, showFlags, iRatingFormat, iRatingColor } = s[id]
    before[id] = {
      nameFormat,
      brandMarks,
      countryFlags,
      showFlags,
      iRatingFormat,
      iRatingColor
    }
  }
  await followGlobal(
    ids,
    (m) => m.settings.driverBlock.title,
    inheritDriverBlocks(ids),
    before as SettingsPatch
  )
  followedBlocksMsg.value = t.value.settings.appearance.rows.followGlobalDone
}

/**
 * "Restablecer…" (R24): each section of the page, then all of it (the language never changes),
 * the same resets as the ↺ in the sections' heads. One click, then "Deshacer".
 */
const resetItems = computed<ResetItem[]>(() => {
  const a = t.value.settings.appearance
  // «Cuándo se ve el overlay» is on the «Visibilidad» page now (R34), with its reset.
  const items: ResetItem[] = APPEARANCE_PARTS.filter((part) => part !== 'screen').map((part) => ({
    id: part,
    label: a[part].title,
    description: a.reset[part],
    run: () => resetAppearancePart(part),
    disabled: partAtDefault(part)
  }))
  const s = settings.value
  items.push({
    id: 'all',
    ...a.reset.all,
    run: resetAppearance,
    disabled: s !== null && appearanceAtDefault(s)
  })
  return items
})
/** That section as it comes: its ↺ and its menu item dimmed, saying so (R47). */
const partAtDefault = (part: AppearancePart): boolean =>
  settings.value !== null && appearancePartAtDefault(settings.value, part)
const resetLabel = (part: AppearancePart): string =>
  t.value.settings.appearance.reset.sectionLabel(t.value.settings.appearance[part].title)
/** Which widgets the text size changes, by name (the auto-height ones). */
const fontScaleHelp = computed(() => fontScaleHelpText(t.value, locale.value))

const styles = createDriverStyles()
const licText = SAMPLE_CHIPS.licText
const carNumber = SAMPLE_CHIPS.carNumber
const licStyle = styles.lic(SAMPLE_CHIPS.licColor)
const numStyle = styles.cls(SAMPLE_CHIPS.classColor)
const example = computed(() => nameExample(t.value, appearance.value.nameFormat))

/** Accesibilidad's links to «Texto»'s reading aids: the search result's way there. */
const navigate = useNavigate()
const readLinks = computed(() => {
  const x = t.value.settings.appearance.text
  return [x.fontScale, x.halo].map((text) => ({ text, context: x.title, kind: 'label' as const }))
})
</script>

<template>
  <PageFrame :labelledby="titleId">
    <template #top>
      <header class="page-head">
        <div class="page-titles">
          <h1 :id="titleId" class="page-title">{{ t.settings.nav.appearance }}</h1>
          <HelpText
            tag="p"
            class="page-sub"
            :text="t.settings.appearance.sub"
            :more="t.settings.appearance.subMore"
          />
        </div>
        <ResetMenu :label="t.settings.appearance.reset.menuLabel" :items="resetItems" />
      </header>

      <SampleStage class="stage">
        <WidgetSample widget-id="standings" global />
      </SampleStage>
    </template>

    <!-- Named looks first (R56); the sections below are the fine tuning. -->
    <AppearancePresets />

    <!--
      Two groups, each in two fixed columns in a wide window (settings.css .st-grid2), so no column
      runs empty: the style's fine tuning (Color and Texto, then Filas y pilotos), and what no style
      touches (Idioma and Otros, then Accesibilidad).
    -->
    <div class="st-grid2">
      <div class="st-col">
        <PageSection
          :title="t.settings.appearance.color.title"
          :reset-label="resetLabel('color')"
          :reset-disabled="partAtDefault('color')"
          @reset="resetAppearancePart('color')"
        >
          <ColorControl
            :label="t.settings.appearance.color.accent"
            :help="t.settings.appearance.color.accentHelp"
            :current="appearance.accent"
            :presets="accentPresets"
            :apply="set('accent')"
          />
          <SliderControl
            :label="t.settings.appearance.color.background"
            :help="t.settings.appearance.color.backgroundHelp"
            :current="toPercent(appearance.backgroundOpacity)"
            :min="0"
            :max="100"
            :presets="OPACITY_PRESETS"
            :format="percent"
            :apply="setBackground"
          />
          <div v-if="ownBg.length > 0" class="st-row own-bg">
            <p class="st-help">{{ t.settings.appearance.color.ownBackgrounds(ownBg.length) }}</p>
            <button type="button" class="st-btn st-btn-sm" @click="followGlobalBg">
              {{ t.settings.appearance.color.followGlobal }}
            </button>
          </div>
          <p class="st-sr-only" aria-live="polite">{{ followedMsg }}</p>
          <p v-if="dayNote" class="st-row st-help st-help-warn day-note" role="status">
            {{ dayNote }}
          </p>
        </PageSection>
        <PageSection
          :title="t.settings.appearance.text.title"
          :reset-label="resetLabel('text')"
          :reset-disabled="partAtDefault('text')"
          @reset="resetAppearancePart('text')"
        >
          <SliderControl
            :label="t.settings.appearance.text.fontScale"
            :help="fontScaleHelp.help"
            :more="fontScaleHelp.more"
            :current="appearance.fontScale"
            :min="FONT_SCALE_MIN"
            :max="FONT_SCALE_MAX"
            :step="OPTION_SCHEMA.appearance.fontScale.step"
            :presets="SIZE_PRESETS"
            :format="percent"
            :apply="set('fontScale')"
          />
          <ChoiceControl
            :label="t.settings.appearance.text.halo"
            :help="t.settings.appearance.text.haloHelp"
            :current="appearance.textHalo"
            :options="haloChoices"
            :apply="set('textHalo')"
          />
        </PageSection>
      </div>
      <div class="st-col">
        <PageSection
          :title="t.settings.appearance.rows.title"
          :reset-label="resetLabel('rows')"
          :reset-disabled="partAtDefault('rows')"
          @reset="resetAppearancePart('rows')"
        >
          <ChoiceControl
            :label="t.settings.common.density"
            :help="t.settings.appearance.rows.densityHelp"
            :current="appearance.density"
            :options="densityOptions"
            :apply="set('density')"
          />
          <ToggleControl
            kind="switch"
            :label="t.settings.appearance.rows.stripes"
            :current="appearance.stripes"
            :apply="set('stripes')"
          />
          <ChoiceControl
            :label="t.settings.common.license"
            :current="appearance.licenseStyle"
            :options="licenseChoices"
            :apply="set('licenseStyle')"
          >
            <template #option="{ option }">
              <LicenseChip
                class="opt-chip"
                :text="licText"
                :colors="licStyle"
                :variant="option.value"
              />
              {{ option.label }}
            </template>
          </ChoiceControl>
          <ChoiceControl
            :label="t.settings.appearance.rows.number"
            :current="appearance.numberStyle"
            :options="numberChoices"
            :apply="set('numberStyle')"
          >
            <template #option="{ option }">
              <span v-if="option.value === 'stripe'" class="opt-stripe" aria-hidden="true" />
              <NumberBadge
                class="opt-chip"
                :number="carNumber"
                :cls-style="numStyle"
                :variant="option.value === 'chip' ? 'filled' : 'plain'"
              />
              {{ option.label }}
            </template>
          </ChoiceControl>
          <!-- The «Piloto» block's globals (R08): what each driver widget on «Global» draws. -->
          <ChoiceControl
            :label="t.settings.common.nameFormat"
            :help="example"
            :current="appearance.nameFormat"
            :options="nameChoices"
            :apply="set('nameFormat')"
          />
          <ChoiceControl
            :label="t.settings.driverCell.brandMarks"
            :help="t.settings.appearance.rows.blockHelp"
            :current="appearance.brandMarks"
            :options="brandMarkChoices"
            :apply="set('brandMarks')"
          />
          <ChoiceControl
            :label="t.settings.driverCell.countryFlags"
            :help="t.settings.driverCell.countryFlagsHelp"
            :current="toChoice(appearance.countryFlags)"
            :options="yesNo"
            :apply="setFlag('countryFlags')"
          />
          <ChoiceControl
            :label="t.settings.common.penaltyFlags"
            :help="t.settings.common.penaltyFlagsHelp"
            :current="toChoice(appearance.penaltyFlags)"
            :options="yesNo"
            :apply="setFlag('penaltyFlags')"
          />
          <ChoiceControl
            :label="t.settings.driverCell.iRatingFormat"
            :help="t.settings.driverCell.iRatingFormatHelp"
            :current="appearance.iRatingFormat"
            :options="irFormatChoices"
            :apply="set('iRatingFormat')"
          />
          <ChoiceControl
            :label="t.settings.driverCell.iRatingColor"
            :help="t.settings.driverCell.iRatingColorHelp"
            :current="toChoice(appearance.iRatingColor)"
            :options="yesNo"
            :apply="setFlag('iRatingColor')"
          />
          <div v-if="ownBlocks.length > 0" class="st-row own-bg">
            <p class="st-help">{{ t.settings.appearance.rows.ownBlocks(ownBlocks.length) }}</p>
            <button type="button" class="st-btn st-btn-sm" @click="followBlocks">
              {{ t.settings.appearance.rows.followGlobal }}
            </button>
          </div>
          <p class="st-sr-only" aria-live="polite">{{ followedBlocksMsg }}</p>
          <ChoiceControl
            :label="t.settings.appearance.rows.brandLogos"
            :help="t.settings.appearance.rows.brandLogosHelp"
            :current="appearance.brandLogos"
            :options="brandLogoChoices"
            :apply="set('brandLogos')"
          >
            <template #option="{ option }">
              <BrandMark class="opt-brand" brand="ferrari" :logos="option.value" />
              {{ option.label }}
            </template>
          </ChoiceControl>
        </PageSection>
      </div>
    </div>

    <h2 class="st-section-title group-title">{{ t.settings.appearance.general }}</h2>
    <div class="st-grid2">
      <div class="st-col">
        <PageSection :title="t.settings.appearance.language.title">
          <ChoiceControl
            :label="t.settings.appearance.language.label"
            :help="t.settings.appearance.language.help"
            :current="appearance.language"
            :options="LANGUAGE_CHOICES"
            :apply="set('language')"
          >
            <template #option="{ option }">
              <span :lang="option.value">{{ option.label }}</span>
            </template>
          </ChoiceControl>
        </PageSection>
        <PageSection
          :title="t.settings.appearance.other.title"
          :reset-label="resetLabel('other')"
          :reset-disabled="partAtDefault('other')"
          @reset="resetAppearancePart('other')"
        >
          <ChoiceControl
            :label="t.settings.appearance.other.units"
            :help="t.settings.appearance.other.unitsHelp"
            :current="appearance.units"
            :options="unitChoices"
            :apply="set('units')"
          />
          <ToggleControl
            kind="switch"
            :label="t.settings.appearance.other.simPill"
            :help="t.settings.appearance.other.simPillHelp"
            :current="appearance.showSimPill"
            :apply="set('showSimPill')"
          />
        </PageSection>
      </div>
      <div class="st-col">
        <!-- Every need in one place (R15, R27, R29, R36), each off until chosen. -->
        <PageSection
          :title="t.settings.appearance.access.title"
          :reset-label="resetLabel('access')"
          :reset-disabled="partAtDefault('access')"
          @reset="resetAppearancePart('access')"
        >
          <ToggleControl
            kind="switch"
            :label="t.settings.appearance.color.colorBlind"
            :help="t.settings.appearance.color.colorBlindHelp"
            :more="t.settings.appearance.color.colorBlindMore"
            :current="appearance.colorBlind"
            :apply="set('colorBlind')"
          />
          <ToggleControl
            kind="switch"
            :label="t.settings.appearance.access.largeLabels"
            :help="t.settings.appearance.access.largeLabelsHelp"
            :more="t.settings.appearance.access.largeLabelsMore"
            :current="appearance.largeLabels"
            :apply="set('largeLabels')"
          />
          <ToggleControl
            kind="switch"
            :label="t.settings.appearance.access.noFlashing"
            :help="t.settings.appearance.access.noFlashingHelp"
            :more="t.settings.appearance.access.noFlashingMore"
            :current="appearance.noFlashing"
            :apply="set('noFlashing')"
          />
          <SliderControl
            :label="t.settings.appearance.access.settingsZoom"
            :help="t.settings.appearance.access.settingsZoomHelp"
            :more="t.settings.appearance.access.settingsZoomMore"
            :current="appearance.settingsZoom"
            :min="A.settingsZoom.min"
            :max="A.settingsZoom.max"
            :step="A.settingsZoom.step"
            :presets="SIZE_PRESETS"
            :format="percent"
            :apply="set('settingsZoom')"
          />
          <!-- The two reading aids of «Texto», one click away (pointed out there, as a search result). -->
          <p class="st-row access-links">
            <span class="st-help">{{ t.settings.appearance.access.readBetter }}</span>
            <span class="access-go">
              <button
                v-for="l in readLinks"
                :key="l.text"
                type="button"
                class="st-btn st-btn-sm st-btn-ghost"
                data-nofind
                @click="navigate('appearance', l)"
              >
                {{ l.text }}
              </button>
            </span>
          </p>
        </PageSection>
      </div>
    </div>

    <template #foot>
      <slot />
    </template>
  </PageFrame>
</template>

<style scoped>
/* The title and its line, then "Restablecer…" at the end (as on a widget page). */
.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 24px;
  margin-bottom: 16px;
}

.page-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.page-title {
  font-family: var(--ov-font-num);
  font-size: var(--st-t-page);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.page-sub {
  max-width: 46em;
  color: var(--ov-fg-muted);
  font-size: var(--st-t-ui);
}

.stage {
  margin-bottom: 24px;
}

.day-note {
  display: block;
}

.own-bg {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.own-bg .st-help {
  margin: 0;
}

.group-title {
  margin: 24px 0 12px;
}

.access-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
}

.access-links .st-help {
  flex: 1 1 16em;
  margin: 0;
}

.access-go {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.opt-chip {
  font-size: var(--st-t-caption);
}

.opt-brand {
  width: 22px;
  height: 16px;
}

.opt-stripe {
  width: 3px;
  height: 14px;
  margin-right: -2px;
  border-radius: 1px;
  background: var(--cls, #33ceff);
}
</style>
