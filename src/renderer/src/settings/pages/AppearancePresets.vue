<script setup lang="ts">
import { computed, shallowRef, useId, useTemplateRef } from 'vue'
import {
  APPEARANCE_PRESETS,
  contentsBack,
  matchingPreset,
  mergePatches,
  planStyle,
  setsContents,
  undoPatch,
  type AppearancePreset,
  type StylePlan
} from '@shared/appearancePresets'
import { DEFAULT_SETTINGS, applySettingsPatch } from '@shared/settings'
import type { Rect, SettingsPatch } from '@shared/types'
import type { WidgetId } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import Icon from '../../ui/Icon.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import { sendCommand, updateSettings } from '../editor'
import { foldGroups, styleChangeGroups, styleWhere } from '../styleChanges'
import { freeGrowth } from '../styleGrowth'
import { offerRestore } from '../undo/restore'
import { beforeComplete, forgetBeforeComplete, rememberBeforeComplete } from '../completeBefore'
import SiblingLink from '../layout/SiblingLink.vue'

/**
 * Apariencia's named styles (R56): one radio card each, the one the settings match checked; none
 * when tuned by hand («Personalizado»). Choosing one that would change what you set yourself (the
 * look tuned by hand, or the widgets' contents with «Completo») first says what changes and where
 * (ConfirmDialog); otherwise it applies at once. Either way "Deshacer" puts it all back.
 */
const t = useI18n()
const { settings } = useOverlayState()
const id = useId()
const titleId = `${id}-title`
const helpId = `${id}-help`
const group = useTemplateRef<HTMLElement>('group')

const now = computed(() => settings.value ?? DEFAULT_SETTINGS)
const current = computed(() => matchingPreset(now.value))
const text = computed(() => t.value.settings.appearance.presets)
const cards = computed(() => APPEARANCE_PRESETS.map((p) => ({ id: p, ...text.value.choices[p] })))

/** The style waiting for «Aplicar», with what it changes and the free windows that grow. */
const asking = shallowRef<{
  id: AppearancePreset
  plan: StylePlan
  grown: readonly WidgetId[]
  /**
   * Leaving «Completo»: its contents stay, said in the dialog, with the offer to take them away
   * when what the widgets showed before it is remembered (completeBefore.ts).
   */
  leaving: boolean
  back: SettingsPatch | null
} | null>(null)
/** «Quitar también lo que añadió Completo», ticked in the dialog. */
const takeBack = shallowRef(false)
const expanded = shallowRef(false)
const card = shallowRef<HTMLElement | null>(null)

const groups = computed(() =>
  asking.value === null
    ? []
    : styleChangeGroups(t.value, asking.value.plan.changes, asking.value.grown)
)
const folded = computed(() =>
  expanded.value ? { groups: groups.value, hidden: 0 } : foldGroups(groups.value)
)
const where = computed(() =>
  asking.value === null
    ? ''
    : styleWhere(t.value, now.value.savedLayouts, setsContents(asking.value.id))
)

/**
 * Applies `plan`, then grows the free windows its contents need (styleGrowth), with one
 * "Deshacer" for all of it: the settings first (which also puts back a window the text size
 * scaled), then each grown window as it was.
 */
async function apply(p: AppearancePreset, plan: StylePlan): Promise<void> {
  const before = now.value
  const back = undoPatch(before, plan.patch)
  // What the widgets showed before Completo, for a later style to offer back.
  if (setsContents(p)) rememberBeforeComplete(contentsBack(back))
  const sizes = new Map<WidgetId, Rect>()
  offerRestore(
    (m) => m.settings.appearance.presets.applied(m.settings.appearance.presets.choices[p].label),
    async () => {
      await updateSettings(back)
      for (const [id, bounds] of sizes) {
        sendCommand({ type: 'set-widget-bounds', widgetId: id, bounds })
      }
    }
  )
  await updateSettings(plan.patch)
  if (!setsContents(p)) return
  for (const [id, bounds] of Object.entries(freeGrowth(before, now.value))) {
    const widgetId = id as WidgetId
    sizes.set(widgetId, { ...before.widgets[widgetId].bounds })
    sendCommand({ type: 'set-widget-bounds', widgetId, bounds })
  }
}

/** The free windows that would grow with `plan` (said in the confirmation). */
function growing(plan: StylePlan): WidgetId[] {
  return Object.keys(freeGrowth(now.value, applySettingsPatch(now.value, plan.patch))) as WidgetId[]
}

/** The radios back to what the settings are (a cancelled choice left its own checked). */
function syncRadios(): void {
  for (const input of group.value?.querySelectorAll<HTMLInputElement>('.card-input') ?? []) {
    input.checked = input.value === current.value
  }
}

function choose(p: AppearancePreset, e: Event): void {
  const plan = planStyle(now.value, p)
  if (Object.keys(plan.patch).length === 0) return
  const leaving = current.value === 'complete' && !setsContents(p)
  if (!plan.confirm && !leaving) {
    void apply(p, plan)
    return
  }
  card.value = e.target instanceof HTMLElement ? e.target : null
  expanded.value = false
  takeBack.value = false
  asking.value = {
    id: p,
    plan,
    grown: setsContents(p) ? growing(plan) : [],
    leaving,
    back: leaving ? beforeComplete() : null
  }
}

function confirmApply(): void {
  const a = asking.value
  asking.value = null
  if (a === null) return
  if (a.back !== null && takeBack.value) {
    forgetBeforeComplete()
    void apply(a.id, { ...a.plan, patch: mergePatches(a.back, a.plan.patch) })
    return
  }
  void apply(a.id, a.plan)
}

function cancel(): void {
  asking.value = null
  syncRadios()
}
</script>

<template>
  <section class="st-section presets" :aria-labelledby="titleId">
    <div class="st-section-head">
      <h2 :id="titleId" class="st-section-title">{{ text.title }}</h2>
      <span :id="helpId" class="st-section-note">{{ text.help }}</span>
    </div>
    <div
      ref="group"
      class="cards"
      role="radiogroup"
      :aria-labelledby="titleId"
      :aria-describedby="helpId"
    >
      <label v-for="c in cards" :key="c.id" class="card">
        <input
          type="radio"
          class="card-input"
          :name="id"
          :value="c.id"
          :checked="current === c.id"
          @change="choose(c.id, $event)"
        />
        <span class="card-head">
          <span class="card-name">{{ c.label }}</span>
          <Icon v-if="current === c.id" name="check" class="card-check" />
        </span>
        <span class="card-hint">{{ c.hint }}</span>
      </label>
    </div>
    <p class="st-help custom" role="status">
      {{ current === null ? text.custom : '' }}
    </p>
    <SiblingLink :text="text.seeLayouts" page="layouts" />
    <h2 class="st-section-title fine">{{ text.fine }}</h2>

    <ConfirmDialog
      v-if="asking"
      :title="text.confirm.title(text.choices[asking.id].label)"
      :apply-label="text.confirm.apply"
      :cancel-label="text.confirm.cancel"
      :return-focus="card"
      @apply="confirmApply"
      @cancel="cancel"
    >
      <p class="cd-intro">{{ text.confirm.intro }}</p>
      <div v-for="g in folded.groups" :key="g.title" class="cd-group">
        <h3 class="cd-group-title">{{ g.title }}</h3>
        <ul class="cd-lines">
          <li v-for="(line, i) in g.lines" :key="i">
            <template v-if="line.to !== undefined">
              {{ line.text }}: {{ line.from }}
              <Icon name="step-right" class="cd-to" />
              <span class="st-sr-only">{{ text.confirm.to }}</span>
              {{ line.to }}
            </template>
            <template v-else>{{ line.text }}</template>
          </li>
        </ul>
      </div>
      <button
        v-if="folded.hidden > 0 || expanded"
        type="button"
        class="st-btn st-btn-ghost st-btn-sm cd-more"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? text.confirm.less : text.confirm.more(folded.hidden) }}
      </button>
      <template v-if="asking.leaving">
        <p class="cd-intro">{{ text.confirm.completeStays }}</p>
        <label v-if="asking.back !== null" class="st-check cd-back">
          <input v-model="takeBack" type="checkbox" />
          <span>{{ text.confirm.takeBack }}</span>
        </label>
      </template>
      <!-- Stacked as the widget pages' «Guardando en» block: the caption, then where. -->
      <div class="cd-where">
        <Icon name="save" class="cd-where-icon" />
        <p class="cd-where-text">
          <span class="cd-where-label">{{ t.settings.widgetPage.target.savingIn }}</span>
          <span>{{ where }}</span>
        </p>
      </div>
    </ConfirmDialog>
  </section>
</template>

<style scoped>
.presets {
  margin-bottom: 8px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  cursor: pointer;
}

.card:hover {
  border-color: var(--st-border-hi);
}

.card:has(.card-input:checked) {
  border-color: var(--st-sel);
  background: var(--st-surface-hi);
}

.card:has(.card-input:focus-visible) {
  outline: 2px solid var(--st-focus);
  outline-offset: 2px;
}

.card-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-name {
  color: var(--ov-fg);
  font-size: var(--st-t-body);
  font-weight: var(--ov-w-strong);
}

.card-check {
  color: var(--st-sel);
}

.card-hint {
  color: var(--ov-fg-muted);
  font-size: var(--st-t-help);
  line-height: 1.4;
}

.custom {
  min-height: 1.4em;
  margin-top: 8px;
}

.fine {
  margin-top: 16px;
}

/* The dialog's body: slot content, so these scoped rules reach it through the teleport. */
.cd-intro {
  color: var(--ov-fg-muted);
}

.cd-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cd-group-title {
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: var(--st-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.cd-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding-left: 16px;
}

.cd-to {
  color: var(--ov-fg-dim);
  vertical-align: -0.125em;
}

.cd-more {
  align-self: flex-start;
}

.cd-back {
  align-self: flex-start;
}

.cd-where {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--st-border);
  color: var(--ov-fg-muted);
}

.cd-where-icon {
  flex: none;
  margin-top: 2px;
  color: var(--ov-fg-dim);
}

.cd-where-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  margin: 0;
}

.cd-where-label {
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: var(--st-t-caption);
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}
</style>
