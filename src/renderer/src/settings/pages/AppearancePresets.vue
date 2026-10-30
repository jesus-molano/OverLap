<script setup lang="ts">
import { computed, useId } from 'vue'
import {
  APPEARANCE_PRESETS,
  matchingPreset,
  presetFieldsOf,
  presetValues,
  type AppearancePreset
} from '@shared/appearancePresets'
import { useAppearance } from '../../composables/useAppearance'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import { updateSettings } from '../editor'
import { offerRestore } from '../undo/restore'

/**
 * Apariencia's named looks (R56): one radio card each, the one the look matches checked; none
 * when it was tuned by hand («Personalizado»). Choosing one sets the global look at once, with
 * "Deshacer" (the look as it was). The controls below are the fine tuning.
 */
const appearance = useAppearance()
const t = useI18n()
const id = useId()
const titleId = `${id}-title`
const helpId = `${id}-help`

const current = computed(() => matchingPreset(appearance.value))
const cards = computed(() =>
  APPEARANCE_PRESETS.map((p) => ({ id: p, ...t.value.settings.appearance.presets.choices[p] }))
)

function choose(p: AppearancePreset): void {
  if (current.value === p) return
  const before = presetFieldsOf(appearance.value)
  void updateSettings({ appearance: presetValues(p) })
  offerRestore(
    (m) => m.settings.appearance.presets.applied(m.settings.appearance.presets.choices[p].label),
    () => void updateSettings({ appearance: before })
  )
}
</script>

<template>
  <section class="st-section presets" :aria-labelledby="titleId">
    <div class="st-section-head">
      <h2 :id="titleId" class="st-section-title">{{ t.settings.appearance.presets.title }}</h2>
      <span :id="helpId" class="st-section-note">{{ t.settings.appearance.presets.help }}</span>
    </div>
    <div class="cards" role="radiogroup" :aria-labelledby="titleId" :aria-describedby="helpId">
      <label v-for="c in cards" :key="c.id" class="card">
        <input
          type="radio"
          class="card-input"
          :name="id"
          :value="c.id"
          :checked="current === c.id"
          @change="choose(c.id)"
        />
        <span class="card-head">
          <span class="card-name">{{ c.label }}</span>
          <Icon v-if="current === c.id" name="check" class="card-check" />
        </span>
        <span class="card-hint">{{ c.hint }}</span>
      </label>
    </div>
    <p class="st-help custom" role="status">
      {{ current === null ? t.settings.appearance.presets.custom : '' }}
    </p>
    <h2 class="st-section-title fine">{{ t.settings.appearance.presets.fine }}</h2>
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
</style>
