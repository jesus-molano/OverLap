<script setup lang="ts">
import { computed, shallowRef, useId } from 'vue'
import { normalizeHexColor } from '@shared/colors'
import { useI18n } from '../../composables/useI18n'
import { useDraft } from '../useDraft'
import { hexDigits } from '../values'

/**
 * A colour: preset swatches (radios), the system picker and a hex field. The picker streams
 * through the settings throttle while it is dragged; the hex field applies on Enter or blur
 * and goes back to the current colour when the text is not a colour.
 */
const props = withDefaults(
  defineProps<{
    label: string
    help?: string
    /** '#rrggbb'. */
    current: string
    presets: readonly { readonly value: string; readonly label: string }[]
    apply: (value: string) => Promise<unknown>
    disabled?: boolean
  }>(),
  { help: undefined, disabled: false }
)

const t = useI18n()
const id = useId()
const labelId = `${id}-label`
const helpId = `${id}-help`
const { value, input, commit } = useDraft(
  () => props.current,
  (v) => props.apply(v)
)

const swatches = computed(() =>
  props.presets.map((p) => ({ ...p, style: { background: p.value } }))
)
const isPreset = computed(() => props.presets.some((p) => p.value === value.value))
const pickerLabel = computed(() => t.value.settings.controls.customColorLabel(props.label))
const hexLabel = computed(() => t.value.settings.controls.hexLabel(props.label))

/** Text being typed in the hex field; null while it shows the current colour. */
const typed = shallowRef<string | null>(null)
const text = computed(() => typed.value ?? hexDigits(value.value))
const invalid = computed(() => typed.value !== null && normalizeHexColor(typed.value) === null)

function pickerValue(e: Event): string | null {
  return e.target instanceof HTMLInputElement ? normalizeHexColor(e.target.value) : null
}

function onPick(e: Event): void {
  const v = pickerValue(e)
  if (v !== null) input(v)
}

function onPickDone(e: Event): void {
  const v = pickerValue(e)
  if (v !== null) commit(v)
}

function onType(e: Event): void {
  if (e.target instanceof HTMLInputElement) typed.value = e.target.value
}

function applyTyped(): void {
  if (typed.value === null) return
  const v = normalizeHexColor(typed.value)
  typed.value = null
  if (v !== null && v !== value.value) commit(v)
}

function revertTyped(): void {
  typed.value = null
}
</script>

<template>
  <div class="st-row st-row-stack">
    <div class="st-row-head" :class="{ 'st-disabled': disabled }">
      <span :id="labelId" class="st-label">{{ label }}</span>
    </div>
    <div class="colors">
      <div
        class="swatches"
        role="radiogroup"
        :aria-labelledby="labelId"
        :aria-describedby="help ? helpId : undefined"
      >
        <label v-for="s in swatches" :key="s.value" class="swatch" :title="s.label">
          <input
            type="radio"
            class="swatch-input"
            :name="id"
            :value="s.value"
            :checked="value === s.value"
            :disabled="disabled"
            :aria-label="s.label"
            @change="commit(s.value)"
          />
          <span class="swatch-dot" :style="s.style" />
        </label>
      </div>
      <span class="custom" :class="{ 'is-custom': !isPreset }">
        <input
          type="color"
          class="picker"
          :value="value"
          :disabled="disabled"
          :aria-label="pickerLabel"
          :title="t.settings.controls.customColor"
          @input="onPick"
          @change="onPickDone"
        />
        <span class="hash" aria-hidden="true">#</span>
        <input
          type="text"
          class="st-field hex"
          maxlength="7"
          spellcheck="false"
          autocomplete="off"
          :value="text"
          :disabled="disabled"
          :aria-label="hexLabel"
          :aria-invalid="invalid"
          @input="onType"
          @change="applyTyped"
          @blur="applyTyped"
          @keydown.enter.prevent="applyTyped"
          @keydown.esc="revertTyped"
        />
      </span>
    </div>
    <span v-if="help" :id="helpId" class="st-help">{{ help }}</span>
  </div>
</template>

<style scoped>
.colors {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.swatch {
  position: relative;
  display: inline-flex;
  padding: 3px;
  border-radius: 50%;
  cursor: pointer;
}

.swatch-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.swatch-dot {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.swatch:hover .swatch-dot {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}

/* Ring outside the dot: selected (white) and keyboard focus (focus colour). */
.swatch:has(.swatch-input:checked) {
  box-shadow: 0 0 0 2px var(--ov-fg);
}

.swatch:has(.swatch-input:focus-visible) {
  outline: 2px solid var(--st-focus);
  outline-offset: 2px;
}

.swatch:has(.swatch-input:disabled) {
  opacity: 0.45;
  cursor: default;
}

.custom {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border-radius: var(--st-radius);
}

/* Same geometry as a preset swatch: a 22 px dot, its ring 3 px outside when selected. */
.picker {
  flex: none;
  width: 28px;
  height: 28px;
  margin-right: 4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  cursor: pointer;
}

.custom.is-custom .picker {
  box-shadow: 0 0 0 2px var(--ov-fg);
}

.picker:disabled {
  opacity: 0.45;
  cursor: default;
}

.picker::-webkit-color-swatch-wrapper {
  padding: 3px;
}

.picker::-webkit-color-swatch {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
}

.picker:hover:not(:disabled)::-webkit-color-swatch {
  border-color: rgba(255, 255, 255, 0.45);
}

.hash {
  color: var(--ov-fg-dim);
  font-variant-numeric: tabular-nums;
}

.hex {
  width: 6.2em;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 13px;
  text-transform: lowercase;
}
</style>
