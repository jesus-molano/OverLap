<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef, useId, useTemplateRef, watch } from 'vue'
import {
  LANGUAGES,
  LANGUAGE_NAMES,
  acceleratorText,
  widgetTitle,
  type Language
} from '@shared/i18n'
import { OPTION_SCHEMA } from '@shared/settingsSchema'
import { WIDGET_GROUPS, WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { useAppearance } from '../composables/useAppearance'
import { useI18n } from '../composables/useI18n'
import { useShortcuts } from '../composables/useShortcuts'
import ChoiceControl from './controls/ChoiceControl.vue'
import { choiceOptions, type ChoiceOption } from './controls/choice'
import { optionSetter, sendCommand, updateSettings } from './editor'
import NavIcon from './layout/NavIcon.vue'
import {
  WELCOME_STEPS,
  WELCOME_WIDGETS,
  welcomeCanGoOn,
  welcomeWidgetsPatch,
  type WelcomeStep
} from './welcome'

/**
 * The welcome of a first run (R07): main opens the settings window on it
 * (settingsWindow.welcome). Three steps: the language and the units; which widgets to start with
 * (the core ones ticked, R07 / H-25); where everything is (the tray, the shortcuts) with
 * «Probar con datos de ejemplo», which shows the widgets over the desktop in edit mode. «Saltar»
 * (or Esc) leaves it at any step; it never shows again either way.
 */
const t = useI18n()
const appearance = useAppearance()
const shortcuts = useShortcuts()
const titleId = useId()
const box = useTemplateRef<HTMLElement>('box')
const step = shallowRef<WelcomeStep>('start')
const at = computed(() => WELCOME_STEPS.indexOf(step.value))
const last = computed(() => at.value === WELCOME_STEPS.length - 1)

const setAppearance = optionSetter('appearance')
const setWelcome = optionSetter('settingsWindow')('welcome')

const LANGUAGE_CHOICES: readonly ChoiceOption<Language>[] = LANGUAGES.map((value) => ({
  value,
  label: LANGUAGE_NAMES[value]
}))
const unitChoices = computed(() =>
  choiceOptions(
    OPTION_SCHEMA.appearance.units.values,
    t.value.settings.appearance.other.unitChoices
  )
)

/** The widgets ticked: the core ones, until you change them. */
const picked = shallowRef<ReadonlySet<WidgetId>>(new Set(WELCOME_WIDGETS))
const groups = computed(() =>
  WIDGET_GROUPS.map((g) => ({
    id: g.id,
    title: t.value.core.widgetGroups[g.id],
    widgets: g.widgets.map((id) => ({ id, name: widgetTitle(t.value, id) }))
  }))
)

function toggle(id: WidgetId, on: boolean): void {
  const next = new Set(picked.value)
  if (on) next.add(id)
  else next.delete(id)
  picked.value = next
}

/** The three shortcuts that matter on day one, as they are set now. */
const keys = computed(() => {
  const w = t.value.settings.welcome.keys
  const first = (list: readonly string[]): string => acceleratorText(t.value, list[0] ?? '')
  return [
    { id: 'edit', keys: first(shortcuts.value.toggleEditMode), label: w.edit },
    { id: 'overlay', keys: first(shortcuts.value.toggleOverlay), label: w.overlay },
    { id: 'settings', keys: first(shortcuts.value.openSettings), label: w.settings }
  ].filter((k) => k.keys !== '')
})

const trying = shallowRef(false)

/** The widgets over the desktop, with their sample data: edit mode (Esc leaves it). */
function tryIt(): void {
  trying.value = true
  sendCommand({ type: 'set-edit-mode', on: true })
}

async function next(): Promise<void> {
  if (blocked.value) return
  if (step.value === 'widgets') await updateSettings(welcomeWidgetsPatch(picked.value))
  if (last.value) {
    finish()
    return
  }
  step.value = WELCOME_STEPS[at.value + 1] ?? step.value
}

function back(): void {
  step.value = WELCOME_STEPS[at.value - 1] ?? step.value
}

function finish(): void {
  void setWelcome(false)
}

function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  e.preventDefault()
  e.stopPropagation()
  finish()
}

/** Each step starts with the focus on its title, so a screen reader reads it from the top. */
async function focusTitle(): Promise<void> {
  await nextTick()
  box.value?.querySelector<HTMLElement>('.wl-title')?.focus()
}
watch(step, () => void focusTitle())
onMounted(() => void focusTitle())

const allOff = computed(() => WIDGET_IDS.every((id) => !picked.value.has(id)))
/** With nothing ticked, «Siguiente» waits: a first run with nothing on screen is what R07 ends. */
const blocked = computed(() => !welcomeCanGoOn(step.value, picked.value))
const noneId = useId()
</script>

<template>
  <div class="wl-backdrop">
    <div
      ref="box"
      class="wl"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      @keydown="onKey"
    >
      <p class="wl-steps">{{ t.settings.welcome.step(at + 1, WELCOME_STEPS.length) }}</p>

      <template v-if="step === 'start'">
        <h2 :id="titleId" class="wl-title" tabindex="-1">{{ t.settings.welcome.start.title }}</h2>
        <p class="wl-text">{{ t.settings.welcome.start.text }}</p>
        <div class="wl-card">
          <ChoiceControl
            :label="t.settings.appearance.language.label"
            :current="appearance.language"
            :options="LANGUAGE_CHOICES"
            :apply="setAppearance('language')"
          >
            <template #option="{ option }">
              <span :lang="option.value">{{ option.label }}</span>
            </template>
          </ChoiceControl>
          <ChoiceControl
            :label="t.settings.appearance.other.units"
            :help="t.settings.appearance.other.unitsHelp"
            :current="appearance.units"
            :options="unitChoices"
            :apply="setAppearance('units')"
          />
        </div>
      </template>

      <template v-else-if="step === 'widgets'">
        <h2 :id="titleId" class="wl-title" tabindex="-1">
          {{ t.settings.welcome.widgets.title }}
        </h2>
        <p class="wl-text">{{ t.settings.welcome.widgets.text }}</p>
        <div class="wl-groups">
          <fieldset v-for="g in groups" :key="g.id" class="wl-group">
            <legend class="wl-group-title">{{ g.title }}</legend>
            <label v-for="w in g.widgets" :key="w.id" class="st-check wl-widget">
              <input
                type="checkbox"
                :checked="picked.has(w.id)"
                @change="toggle(w.id, ($event.target as HTMLInputElement).checked)"
              />
              <NavIcon :page="w.id" />
              <span>{{ w.name }}</span>
            </label>
          </fieldset>
        </div>
        <p v-if="allOff" :id="noneId" class="st-help st-help-warn" role="status">
          {{ t.settings.welcome.widgets.none }}
        </p>
      </template>

      <template v-else>
        <h2 :id="titleId" class="wl-title" tabindex="-1">{{ t.settings.welcome.where.title }}</h2>
        <ul class="wl-points">
          <li>{{ t.settings.welcome.where.tray }}</li>
          <li>{{ t.settings.welcome.where.car }}</li>
        </ul>
        <dl v-if="keys.length > 0" class="wl-keys">
          <template v-for="k in keys" :key="k.id">
            <dt>
              <kbd>{{ k.keys }}</kbd>
            </dt>
            <dd>{{ k.label }}</dd>
          </template>
        </dl>
        <div class="wl-try">
          <button type="button" class="st-btn" @click="tryIt">
            {{ t.settings.welcome.where.try }}
          </button>
          <p class="st-help">
            {{ trying ? t.settings.welcome.where.trying : t.settings.welcome.where.tryHelp }}
          </p>
        </div>
      </template>

      <footer class="wl-foot">
        <button type="button" class="st-btn st-btn-ghost wl-skip" @click="finish">
          {{ t.settings.welcome.skip }}
        </button>
        <span class="wl-gap" />
        <button v-if="at > 0" type="button" class="st-btn" @click="back">
          {{ t.settings.welcome.back }}
        </button>
        <button
          type="button"
          class="st-btn wl-next"
          :disabled="blocked"
          :aria-describedby="blocked ? noneId : undefined"
          @click="next"
        >
          {{ last ? t.settings.welcome.done : t.settings.welcome.next }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* Over the whole window: the settings behind it, dimmed, wait until it is done. */
.wl-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(6 8 10 / 72%);
}

.wl {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(560px, 100%);
  max-height: calc(100vh - 32px);
  padding: 24px 24px 16px;
  overflow-y: auto;
  border: 1px solid var(--st-border-strong);
  border-radius: var(--st-radius);
  background: var(--st-bg);
  box-shadow:
    var(--st-lit),
    0 0 0 1px rgb(0 0 0 / 50%);
}

.wl-steps {
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: var(--st-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.wl-title {
  font-family: var(--ov-font-num);
  font-size: var(--st-t-page);
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.wl-title:focus {
  outline: none;
}

.wl-text {
  color: var(--ov-fg-muted);
  font-size: var(--st-t-ui);
}

.wl-card {
  padding: 0 16px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
}

.wl-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.wl-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 12px 12px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
}

.wl-group-title {
  padding: 0 4px;
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: var(--st-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.wl-widget {
  align-items: center;
  font-size: var(--st-t-ui);
}

.wl-points {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding-left: 16px;
  font-size: var(--st-t-ui);
}

.wl-keys {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  font-size: var(--st-t-ui);
}

.wl-keys dd {
  margin: 0;
  color: var(--ov-fg-muted);
}

.wl-try {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 12px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
}

.wl-try .st-help {
  flex: 1 1 16em;
}

.wl-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.wl-gap {
  flex: 1 1 auto;
}

/* The way on: neutral ink, raised (the accent means you, never an action); above .st-btn. */
.wl .wl-next {
  border-color: var(--st-sel);
  background: var(--st-sel);
  color: var(--st-sel-fg);
  font-weight: var(--ov-w-strong);
}

.wl .wl-next:hover:not(:disabled) {
  background: #ffffff;
}
</style>
