<script setup lang="ts">
import { computed } from 'vue'
import { WIDGET_SCALE_MAX, WIDGET_SCALE_MIN, WIDGET_SCALE_STEP } from '@shared/settings'
import { SHOW_IN_KINDS, WIDGET_FIELD_SCHEMA } from '@shared/settingsSchema'
import { WIDGET_DEFS, canHideInPits, type WidgetId } from '@shared/widgets'
import { useI18n, useLocale } from '../../composables/useI18n'
import { useOptions, useWidgetSettings } from '../../composables/useWidgetSettings'
import { useAppearance } from '../../composables/useAppearance'
import { useOverlayState } from '../../composables/useOverlay'
import { widgetOpacity } from '../../composables/useWidgetSurface'
import CheckGroup from '../controls/CheckGroup.vue'
import { behaviourNote } from '../controls/previewNote'
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
import { bgChoiceOf, storedBackground, type BgChoice } from '../backgrounds'
import { sendCommand, showInSetter, widgetSetter, type Setter } from '../editor'
import { freeScaleBounds, freeScalePercent } from '../freeScale'
import PageSection from '../layout/PageSection.vue'
import { replayNote, sessionScreenSwitch } from '../replayWidgets'
import { dayUnreadable } from '../opacityNote'
import { SIZE_PRESETS, formatPercent, fromPercent, toPercent } from '../values'

/**
 * "Ventana y visibilidad", the same order on every page: its size (scale, height, the edge it
 * grows from, or the free-size note), its background, when it is shown, and the lock last.
 */
const props = defineProps<{ widgetId: WidgetId }>()

const t = useI18n()

/** Acts during the session only: the same note as every such option (PreviewNote). */
const behaviour = computed(() => behaviourNote(t.value))
const prefs = useWidgetSettings(props.widgetId)
const def = computed(() => WIDGET_DEFS[props.widgetId])
const autoModel = computed(() => def.value.sizeModel === 'auto-height')

const set = widgetSetter(props.widgetId)
const setOpacity: Setter<number> = (pct) => set('backgroundOpacity')(fromPercent(pct))
/** The global background (Apariencia), what 'inherit' draws. */
const appearance = useAppearance()
const globalOpacity = computed(() => widgetOpacity('inherit', appearance.value.backgroundOpacity))
const ownOpacity = computed(() => bgChoiceOf(prefs.value.backgroundOpacity) === 'own')
/** The slider's value: the widget's own, or the global one it follows. */
const opacityNow = computed(() =>
  widgetOpacity(prefs.value.backgroundOpacity, appearance.value.backgroundOpacity)
)
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
  set('backgroundOpacity')(storedBackground(v, globalOpacity.value))
const OPACITY_PRESETS = [25, 50, 80, 100] as const
/** The preview on «Día» shows this background hard to read: said under the control. */
const windowOptions = useOptions('settingsWindow')
const dayNote = computed(() =>
  dayUnreadable(windowOptions.value.stageScene, opacityNow.value)
    ? t.value.settings.window.dayUnreadable
    : undefined
)
const setAutoHeight: Setter<BoolChoice> = (v) => set('autoHeight')(fromChoice(v))

/** A free-size widget's «Escala»: its window against the factory size (freeScale.ts). */
const { settings } = useOverlayState()
const bounds = computed(
  () => settings.value?.widgets[props.widgetId].bounds ?? def.value.defaultBounds
)
const freePercent = computed(() =>
  freeScalePercent(bounds.value, def.value.defaultBounds, appearance.value.fontScale)
)
const setFreeScale: Setter<number> = (pct) => {
  const next = freeScaleBounds(
    bounds.value,
    def.value.defaultBounds,
    pct,
    def.value.minSize,
    appearance.value.fontScale
  )
  sendCommand({ type: 'set-widget-bounds', widgetId: props.widgetId, bounds: next })
  return Promise.resolve()
}

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
/** Replays are a global rule (Visibilidad): only what it means for this widget. */
const visibility = useOptions('visibility')
const locale = useLocale()
const replay = computed(() => replayNote(t.value, locale.value, props.widgetId, visibility.value))
/** The overlay only in races (Visibilidad): practice and qualifying never show. */
const showInHelp = computed(() => {
  const w = t.value.settings.window
  if (nowhere.value) return w.showInNowhere
  return visibility.value.showWhen === 'race' ? w.showInRaceOnly : w.showInHelp
})
/**
 * The same switch on every page. Nothing to show on the session screen (out of the car, or with
 * the replay system on): off and disabled, saying why; nothing hides there: on and disabled.
 */
const sessionScreen = computed(() =>
  sessionScreenSwitch(t.value, props.widgetId, visibility.value, prefs.value.showOnSessionScreen)
)

/** «Ocultar en boxes» means something here (not the alerts, whose job includes the pits). */
const pitsHide = computed(() => canHideInPits(props.widgetId))
/** «Crece hacia»: why it is off when the height does not follow the content. */
const anchorHelp = computed(() => {
  const w = t.value.settings.window
  if (!autoModel.value) return w.anchorFree
  return prefs.value.autoHeight ? w.anchorHelp : w.anchorFixed
})

const HEIGHT_VALUES: readonly BoolChoice[] = ['on', 'off']
const heightChoices = computed(() =>
  choiceOptions(HEIGHT_VALUES, t.value.settings.window.heightChoices)
)
const anchorChoices = computed(() =>
  choiceOptions(WIDGET_FIELD_SCHEMA.anchor.values, t.value.settings.window.anchorChoices)
)
/** Slider readout in the current language; a new function only when the language changes. */
const percent = computed(() => (v: number) => formatPercent(t.value, v))
</script>

<template>
  <PageSection :title="t.settings.window.title" resets="window">
    <!-- The same rows on every page (R09): a free-size widget scales its window, its height is
         the window's (the row is there, off, with the reason). -->
    <SliderControl
      :label="t.settings.window.scale"
      :help="autoModel ? t.settings.window.scaleHelp : t.settings.window.scaleFreeHelp"
      :current="autoModel ? prefs.scale : freePercent"
      :min="WIDGET_SCALE_MIN"
      :max="WIDGET_SCALE_MAX"
      :step="WIDGET_SCALE_STEP"
      :presets="SIZE_PRESETS"
      :format="percent"
      :apply="autoModel ? set('scale') : setFreeScale"
    />
    <ChoiceControl
      :label="t.settings.window.height"
      :help="autoModel ? t.settings.window.heightHelp : t.settings.window.heightFree"
      :current="autoModel ? toChoice(prefs.autoHeight) : 'off'"
      :options="heightChoices"
      :disabled="!autoModel"
      :apply="setAutoHeight"
    />
    <!-- Always the row, off with its reason where the height does not follow the content. -->
    <ChoiceControl
      :label="t.settings.window.anchor"
      :help="anchorHelp"
      :current="prefs.anchor"
      :options="anchorChoices"
      :disabled="!(autoModel && prefs.autoHeight)"
      :note="behaviour"
      :apply="set('anchor')"
    />
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
    <p v-if="dayNote" class="st-row st-help st-help-warn day-note" role="status">{{ dayNote }}</p>
    <CheckGroup
      :legend="t.settings.window.showIn"
      :help="showInHelp"
      :warn="nowhere"
      :note="behaviour"
    >
      <ToggleControl
        v-for="s in showIn"
        :key="s.kind"
        :label="s.label"
        :current="s.on"
        :apply="s.apply"
      />
    </CheckGroup>
    <!-- The same row on every page: off and disabled, saying why, where it has no meaning. -->
    <ToggleControl
      kind="switch"
      :label="t.settings.window.hideInPits"
      :help="pitsHide ? t.settings.window.hideInPitsHelp : t.settings.window.hideInPitsNo"
      :current="pitsHide && prefs.hideInPits"
      :disabled="!pitsHide"
      :note="behaviour"
      :apply="set('hideInPits')"
    />
    <ToggleControl
      kind="switch"
      :label="t.settings.window.sessionScreen"
      :help="sessionScreen.help"
      :current="sessionScreen.on"
      :disabled="sessionScreen.disabled"
      :note="behaviour"
      :apply="set('showOnSessionScreen')"
    />
    <p class="st-row st-help replay-note">{{ replay }}</p>
    <ToggleControl
      kind="switch"
      :label="t.settings.window.locked"
      :help="t.settings.window.lockedHelp"
      :current="prefs.locked"
      :note="behaviour"
      :apply="set('locked')"
    />
  </PageSection>
</template>

<style scoped>
.day-note,
.replay-note {
  display: block;
}
</style>
