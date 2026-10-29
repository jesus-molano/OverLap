<script setup lang="ts">
import { computed, useId } from 'vue'
import { LANGUAGES, LANGUAGE_NAMES, type Language } from '@shared/i18n'
import { FONT_SCALE_MAX, FONT_SCALE_MIN } from '@shared/settings'
import { ACCENT_PRESETS, OPTION_SCHEMA, SHOW_WHEN } from '@shared/settingsSchema'
import type { ShowWhen } from '@shared/types'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n, useLocale } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import BrandMark from '../../ui/BrandMark.vue'
import LicenseChip from '../../ui/LicenseChip.vue'
import NumberBadge from '../../ui/NumberBadge.vue'
import { createDriverStyles } from '../../view/styles'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions, type ChoiceOption } from '../controls/choice'
import { densityChoices, nameExample, nameFormatChoices } from '../controls/choices'
import ColorControl from '../controls/ColorControl.vue'
import HelpText from '../controls/HelpText.vue'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter, resetAppearance } from '../editor'
import ConfirmButton from '../layout/ConfirmButton.vue'
import PageFrame from '../layout/PageFrame.vue'
import PageSection from '../layout/PageSection.vue'
import SampleStage from '../layout/SampleStage.vue'
import { fontScaleHelp as fontScaleHelpText } from '../appearanceHelp'
import { outOfCarHidesSessionScreen, replaysHelp as replaysHelpText } from '../replayWidgets'
import { SAMPLE_CHIPS } from '../samples/sampleData'
import WidgetSample from '../samples/WidgetSample.vue'
import { dayUnreadable } from '../opacityNote'
import { formatPercent, fromPercent, toPercent } from '../values'

/**
 * Global look shared by every widget (settings.appearance), and when the overlay shows and hides
 * with what iRacing shows (settings.visibility, plus the standings' session-screen exception):
 * live preview (fixed), then the options (they scroll). The default slot closes the scrolling
 * part (the window's foot).
 */
const appearance = useAppearance()
const visibility = useOptions('visibility')
const t = useI18n()
const locale = useLocale()
const titleId = useId()
const set = optionSetter('appearance')
const setVisibility = optionSetter('visibility')

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
const brandLogoChoices = computed(() =>
  choiceOptions(A.brandLogos.values, t.value.settings.appearance.rows.brandLogoChoices)
)
const unitChoices = computed(() =>
  choiceOptions(A.units.values, t.value.settings.appearance.other.unitChoices)
)
/** The tray's words for each choice (core.showWhen), with this page's tooltips. */
const showWhenChoices = computed<ChoiceOption<ShowWhen>[]>(() =>
  SHOW_WHEN.map((value) => ({
    value,
    label: t.value.core.showWhen[value],
    hint: t.value.settings.appearance.screen.showWhenHints[value]
  }))
)
const showWhenHelp = computed(
  () => t.value.settings.appearance.screen.showWhenHelp[visibility.value.showWhen]
)
/**
 * Hiding on the session screen changes nothing while out of the car hides it already (the
 * overlay only for the car, replays hidden): then it is not offered. Each widget's own
 * "Mostrar en la pantalla de sesión" is on its page.
 */
const sessionScreenOffered = computed(() => !outOfCarHidesSessionScreen(visibility.value))
const replayChoices = computed(() =>
  choiceOptions(
    OPTION_SCHEMA.visibility.replays.values,
    t.value.settings.appearance.screen.replayChoices
  )
)
const replaysHelp = computed(() => replaysHelpText(t.value, locale.value, visibility.value))
const FONT_PRESETS = [90, 100, 115, 130] as const
const OPACITY_PRESETS = [25, 50, 80, 100] as const
/** The preview on «Día» shows the global background hard to read: said under it. */
const windowOptions = useOptions('settingsWindow')
const dayNote = computed(() =>
  dayUnreadable(windowOptions.value.stageScene, appearance.value.backgroundOpacity)
    ? t.value.settings.window.dayUnreadable
    : undefined
)
const setBackground = (pct: number): Promise<void> => set('backgroundOpacity')(fromPercent(pct))
/** Which widgets the text size changes, by name (the auto-height ones). */
const fontScaleHelp = computed(() => fontScaleHelpText(t.value, locale.value))

const styles = createDriverStyles()
const licText = SAMPLE_CHIPS.licText
const carNumber = SAMPLE_CHIPS.carNumber
const licStyle = styles.lic(SAMPLE_CHIPS.licColor)
const numStyle = styles.cls(SAMPLE_CHIPS.classColor)
const example = computed(() => nameExample(t.value, appearance.value.nameFormat))
</script>

<template>
  <PageFrame :labelledby="titleId">
    <template #top>
      <header class="page-head">
        <h1 :id="titleId" class="page-title">{{ t.settings.nav.appearance }}</h1>
        <HelpText
          tag="p"
          class="page-sub"
          :text="t.settings.appearance.sub"
          :more="t.settings.appearance.subMore"
        />
      </header>

      <SampleStage class="stage">
        <WidgetSample widget-id="standings" global />
      </SampleStage>
    </template>

    <!-- Two columns in a wide window (settings.css .st-cols). -->
    <div class="st-cols">
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

      <PageSection :title="t.settings.appearance.color.title">
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
        <p v-if="dayNote" class="st-row st-help st-help-warn day-note" role="status">
          {{ dayNote }}
        </p>
        <ToggleControl
          kind="switch"
          :label="t.settings.appearance.color.colorBlind"
          :help="t.settings.appearance.color.colorBlindHelp"
          :current="appearance.colorBlind"
          :apply="set('colorBlind')"
        />
      </PageSection>

      <PageSection :title="t.settings.appearance.text.title">
        <SliderControl
          :label="t.settings.appearance.text.fontScale"
          :help="fontScaleHelp.help"
          :more="fontScaleHelp.more"
          :current="appearance.fontScale"
          :min="FONT_SCALE_MIN"
          :max="FONT_SCALE_MAX"
          :step="OPTION_SCHEMA.appearance.fontScale.step"
          :presets="FONT_PRESETS"
          :format="percent"
          :apply="set('fontScale')"
        />
        <ChoiceControl
          :label="t.settings.common.nameFormat"
          :help="example"
          :current="appearance.nameFormat"
          :options="nameChoices"
          :apply="set('nameFormat')"
        />
        <ChoiceControl
          :label="t.settings.appearance.text.halo"
          :help="t.settings.appearance.text.haloHelp"
          :current="appearance.textHalo"
          :options="haloChoices"
          :apply="set('textHalo')"
        />
      </PageSection>

      <PageSection :title="t.settings.appearance.rows.title">
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

      <PageSection :title="t.settings.appearance.screen.title">
        <ChoiceControl
          stack
          :label="t.settings.appearance.screen.showWhen"
          :help="showWhenHelp"
          :current="visibility.showWhen"
          :options="showWhenChoices"
          :apply="setVisibility('showWhen')"
        />
        <ChoiceControl
          :label="t.settings.appearance.screen.replays"
          :help="replaysHelp.help"
          :more="replaysHelp.more"
          :current="visibility.replays"
          :options="replayChoices"
          :apply="setVisibility('replays')"
        />
        <!-- The session screen, after the two rules that decide whether it hides already. -->
        <ToggleControl
          v-if="sessionScreenOffered"
          kind="switch"
          :label="t.settings.appearance.screen.sessionScreen"
          :help="t.settings.appearance.screen.sessionScreenHelp"
          :current="visibility.hideOnSessionScreen"
          :apply="setVisibility('hideOnSessionScreen')"
        />
        <ToggleControl
          kind="switch"
          :label="t.settings.appearance.screen.simUi"
          :help="t.settings.appearance.screen.simUiHelp"
          :current="visibility.hideWithSimUi"
          :apply="setVisibility('hideWithSimUi')"
        />
        <ToggleControl
          kind="switch"
          :label="t.settings.appearance.screen.garage"
          :help="t.settings.appearance.screen.garageHelp"
          :current="visibility.hideInGarage"
          :apply="setVisibility('hideInGarage')"
        />
        <ToggleControl
          kind="switch"
          :label="t.settings.appearance.screen.waiting"
          :help="t.settings.appearance.screen.waitingHelp"
          :current="visibility.showWhileWaiting"
          :apply="setVisibility('showWhileWaiting')"
        />
      </PageSection>

      <PageSection :title="t.settings.appearance.other.title">
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

    <footer class="page-foot">
      <ConfirmButton
        :label="t.settings.appearance.reset.label"
        :confirm-label="t.settings.confirm.reset"
        :description="t.settings.appearance.reset.description"
        :action="resetAppearance"
      />
    </footer>

    <template #foot>
      <slot />
    </template>
  </PageFrame>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 14px;
}

.page-title {
  font-family: var(--ov-font-num);
  font-size: 22px;
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.page-sub {
  max-width: 46em;
  color: var(--ov-fg-muted);
  font-size: 12.5px;
}

.stage {
  margin-bottom: 22px;
}

.day-note {
  display: block;
}

.opt-chip {
  font-size: 11px;
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

.page-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--st-border);
}
</style>
