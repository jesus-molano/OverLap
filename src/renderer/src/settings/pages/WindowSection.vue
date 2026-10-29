<script setup lang="ts">
import { computed } from 'vue'
import { WIDGET_SCALE_MAX, WIDGET_SCALE_MIN, WIDGET_SCALE_STEP } from '@shared/settings'
import { SHOW_IN_KINDS, WIDGET_FIELD_SCHEMA } from '@shared/settingsSchema'
import { WIDGET_DEFS, canShowOnSessionScreen, type WidgetId } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import { useOptions, useWidgetSettings } from '../../composables/useWidgetSettings'
import { useAppearance } from '../../composables/useAppearance'
import { widgetOpacity } from '../../composables/useWidgetSurface'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import {
  choiceOptions,
  fromChoice,
  toChoice,
  type BoolChoice,
  type ChoiceOption
} from '../controls/choice'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { showInSetter, widgetSetter, type Setter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import { replayNote, sessionScreenRuleOn } from '../replayWidgets'
import { formatPercent, fromPercent, toPercent } from '../values'

/**
 * "Ventana y visibilidad", the same order on every page: its size (scale, height, the edge it
 * grows from, or the free-size note), its background, when it is shown, and the lock last.
 */
const props = defineProps<{ widgetId: WidgetId }>()

const t = useI18n()
const prefs = useWidgetSettings(props.widgetId)
const def = computed(() => WIDGET_DEFS[props.widgetId])
const autoModel = computed(() => def.value.sizeModel === 'auto-height')

const set = widgetSetter(props.widgetId)
const setOpacity: Setter<number> = (pct) => set('backgroundOpacity')(fromPercent(pct))
/** The global background (Apariencia), what 'inherit' draws. */
const appearance = useAppearance()
const globalOpacity = computed(() => widgetOpacity('inherit', appearance.value.backgroundOpacity))
const ownOpacity = computed(() => prefs.value.backgroundOpacity !== 'inherit')
/** The slider's value: the widget's own, or the global one it follows. */
const opacityNow = computed(() =>
  widgetOpacity(prefs.value.backgroundOpacity, appearance.value.backgroundOpacity)
)
type BgChoice = 'inherit' | 'own'
const bgChoices = computed<ChoiceOption<BgChoice>[]>(() => {
  const w = t.value.settings.window
  return [
    {
      value: 'inherit',
      label: t.value.settings.choices.inherit(
        formatPercent(t.value, toPercent(globalOpacity.value))
      ),
      hint: w.backgroundInheritHint
    },
    { value: 'own', label: w.backgroundOwn.label, hint: w.backgroundOwn.hint }
  ]
})
/** "Propio" starts from the value it showed (the global one); "Global" follows Apariencia. */
const setBackground: Setter<BgChoice> = (v) =>
  set('backgroundOpacity')(v === 'inherit' ? 'inherit' : globalOpacity.value)
const OPACITY_PRESETS = [25, 50, 80, 100] as const
const setAutoHeight: Setter<BoolChoice> = (v) => set('autoHeight')(fromChoice(v))

const showIn = computed(() => {
  const labels = t.value.settings.window.showInKinds
  return SHOW_IN_KINDS.map((kind) => ({
    kind,
    label: labels[kind],
    on: prefs.value.showIn[kind],
    apply: showInSetter(props.widgetId, kind)
  }))
})
const nowhere = computed(() => SHOW_IN_KINDS.every((k) => !prefs.value.showIn[k]))
/** Replays are a global rule (Apariencia > Visibilidad): only what it means for this widget. */
const visibility = useOptions('visibility')
const replay = computed(() => replayNote(t.value, props.widgetId, visibility.value))
/** The overlay only in races (Apariencia > Visibilidad): practice and qualifying never show. */
const showInHelp = computed(() => {
  const w = t.value.settings.window
  if (nowhere.value) return w.showInNowhere
  return visibility.value.showWhen === 'race' ? w.showInRaceOnly : w.showInHelp
})
/** The session-screen exception only means something while a global rule hides there. */
const sessionScreenRule = computed(() => sessionScreenRuleOn(visibility.value))
/**
 * Nothing to show on the session screen (out of the car, or with the replay system on): no
 * session-screen switch (its replay note says so).
 */
const sessionScreenSwitch = computed(() => canShowOnSessionScreen(props.widgetId))

const HEIGHT_VALUES: readonly BoolChoice[] = ['on', 'off']
const heightChoices = computed(() =>
  choiceOptions(HEIGHT_VALUES, t.value.settings.window.heightChoices)
)
const anchorChoices = computed(() =>
  choiceOptions(WIDGET_FIELD_SCHEMA.anchor.values, t.value.settings.window.anchorChoices)
)
const SCALE_PRESETS = [80, 100, 125, 150] as const
/** Slider readout in the current language; a new function only when the language changes. */
const percent = computed(() => (v: number) => formatPercent(t.value, v))
</script>

<template>
  <PageSection :title="t.settings.window.title">
    <template v-if="autoModel">
      <SliderControl
        :label="t.settings.window.scale"
        :help="t.settings.window.scaleHelp"
        :current="prefs.scale"
        :min="WIDGET_SCALE_MIN"
        :max="WIDGET_SCALE_MAX"
        :step="WIDGET_SCALE_STEP"
        :presets="SCALE_PRESETS"
        :format="percent"
        :apply="set('scale')"
      />
      <ChoiceControl
        :label="t.settings.window.height"
        :help="t.settings.window.heightHelp"
        :current="toChoice(prefs.autoHeight)"
        :options="heightChoices"
        :apply="setAutoHeight"
      />
      <ChoiceControl
        :label="t.settings.window.anchor"
        :help="prefs.autoHeight ? t.settings.window.anchorHelp : t.settings.window.anchorOff"
        :current="prefs.anchor"
        :options="anchorChoices"
        :disabled="!prefs.autoHeight"
        :apply="set('anchor')"
      />
    </template>
    <p v-else class="st-row st-help size-note">
      {{ t.settings.window.sizeNote }}
    </p>
    <ChoiceControl
      :label="t.settings.window.background"
      :help="ownOpacity ? undefined : t.settings.window.opacityHelp"
      :current="ownOpacity ? 'own' : 'inherit'"
      :options="bgChoices"
      :apply="setBackground"
    />
    <SliderControl
      v-if="ownOpacity"
      :label="t.settings.window.opacity"
      :help="t.settings.window.opacityHelp"
      :current="toPercent(opacityNow)"
      :min="0"
      :max="100"
      :presets="OPACITY_PRESETS"
      :format="percent"
      :apply="setOpacity"
    />
    <CheckGroup :legend="t.settings.window.showIn" :help="showInHelp" :warn="nowhere">
      <ToggleControl
        v-for="s in showIn"
        :key="s.kind"
        :label="s.label"
        :current="s.on"
        :apply="s.apply"
      />
    </CheckGroup>
    <ToggleControl
      kind="switch"
      :label="t.settings.window.hideInPits"
      :help="t.settings.window.hideInPitsHelp"
      :current="prefs.hideInPits"
      :apply="set('hideInPits')"
    />
    <ToggleControl
      v-if="sessionScreenSwitch"
      kind="switch"
      :label="t.settings.window.sessionScreen"
      :help="
        sessionScreenRule ? t.settings.window.sessionScreenHelp : t.settings.window.sessionScreenOff
      "
      :current="prefs.showOnSessionScreen || !sessionScreenRule"
      :disabled="!sessionScreenRule"
      :apply="set('showOnSessionScreen')"
    />
    <p class="st-row st-help replay-note">{{ replay }}</p>
    <ToggleControl
      kind="switch"
      :label="t.settings.window.locked"
      :help="t.settings.window.lockedHelp"
      :current="prefs.locked"
      :apply="set('locked')"
    />
  </PageSection>
</template>

<style scoped>
.size-note,
.replay-note {
  display: block;
}
</style>
