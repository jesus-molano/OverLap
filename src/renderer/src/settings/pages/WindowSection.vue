<script setup lang="ts">
import { computed } from 'vue'
import { WIDGET_SCALE_MAX, WIDGET_SCALE_MIN, WIDGET_SCALE_STEP } from '@shared/settings'
import { SHOW_IN_KINDS, WIDGET_FIELD_SCHEMA } from '@shared/settingsSchema'
import { WIDGET_DEFS, inCarOnly, type WidgetId } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import { useOptions, useWidgetSettings } from '../../composables/useWidgetSettings'
import CheckGroup from '../controls/CheckGroup.vue'
import ChoiceControl from '../controls/ChoiceControl.vue'
import { choiceOptions, fromChoice, toChoice, type BoolChoice } from '../controls/choice'
import SliderControl from '../controls/SliderControl.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { showInSetter, widgetSetter, type Setter } from '../editor'
import PageSection from '../layout/PageSection.vue'
import { replayNote } from '../replayWidgets'
import { formatPercent, fromPercent, toPercent } from '../values'

/** "Ventana": how the widget's window looks, sizes itself and when it is shown. */
const props = defineProps<{ widgetId: WidgetId }>()

const t = useI18n()
const prefs = useWidgetSettings(props.widgetId)
const def = computed(() => WIDGET_DEFS[props.widgetId])
const autoModel = computed(() => def.value.sizeModel === 'auto-height')

const set = widgetSetter(props.widgetId)
const setOpacity: Setter<number> = (pct) => set('backgroundOpacity')(fromPercent(pct))
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
const replay = computed(() => replayNote(t.value, props.widgetId, visibility.value.replays))
/** The session-screen exception only means something while the global rule hides there. */
const sessionScreenRule = computed(() => visibility.value.hideOnSessionScreen)
/** Out of the car it has nothing to show: no session-screen switch (its replay note says so). */
const sessionScreenSwitch = computed(() => !inCarOnly(props.widgetId))

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
    <ToggleControl
      kind="switch"
      :label="t.settings.window.locked"
      :help="t.settings.window.lockedHelp"
      :current="prefs.locked"
      :apply="set('locked')"
    />
    <SliderControl
      :label="t.settings.window.opacity"
      :help="t.settings.window.opacityHelp"
      :current="toPercent(prefs.backgroundOpacity)"
      :min="0"
      :max="100"
      :format="percent"
      :apply="setOpacity"
    />
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
    <CheckGroup
      :legend="t.settings.window.showIn"
      :help="nowhere ? t.settings.window.showInNowhere : t.settings.window.showInHelp"
      :warn="nowhere"
    >
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
  </PageSection>
</template>

<style scoped>
.size-note,
.replay-note {
  display: block;
}
</style>
