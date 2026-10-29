<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'
import { useDraft } from '../useDraft'
import type { ChoiceOption } from './choice'
import HelpText from './HelpText.vue'

/**
 * One value out of a few, as a segmented control of native radios (arrow keys move the
 * selection, as in any radio group). The `option` slot can render a richer option label.
 */
const props = withDefaults(
  defineProps<{
    label: string
    help?: string
    /** The rest of the help, behind its ⓘ (HelpText). */
    more?: string
    current: T
    options: readonly ChoiceOption<T>[]
    apply: (value: T) => Promise<unknown>
    disabled?: boolean
    /** Label above the options instead of beside them (long option lists). */
    stack?: boolean
  }>(),
  { help: undefined, more: undefined, disabled: false, stack: false }
)

defineSlots<{ option?(props: { option: ChoiceOption<T> }): unknown }>()

const id = useId()
const labelId = `${id}-label`
const helpId = `${id}-help`
const { value, commit } = useDraft(
  () => props.current,
  (v) => props.apply(v)
)
</script>

<template>
  <div class="st-row st-row-wrap" :class="{ 'st-row-stack': stack }">
    <span class="st-row-text" :class="{ 'st-disabled': disabled }">
      <span :id="labelId" class="st-label">{{ label }}</span>
      <HelpText v-if="help" :id="helpId" class="st-help" :text="help" :more="more" />
    </span>
    <div
      class="st-seg"
      role="radiogroup"
      :aria-labelledby="labelId"
      :aria-describedby="help ? helpId : undefined"
    >
      <label v-for="o in options" :key="o.value" class="st-seg-item" :title="o.hint">
        <input
          type="radio"
          class="st-seg-input"
          :name="id"
          :value="o.value"
          :checked="value === o.value"
          :disabled="disabled"
          @change="commit(o.value)"
        />
        <span class="st-seg-text">
          <slot name="option" :option="o">{{ o.label }}</slot>
        </span>
      </label>
    </div>
  </div>
</template>
