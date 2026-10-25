<script setup lang="ts">
import { useId } from 'vue'
import { useDraft } from '../useDraft'

const props = withDefaults(
  defineProps<{
    label: string
    help?: string
    current: boolean
    apply: (value: boolean) => Promise<unknown>
    /** `switch`: row with the label on the left; `checkbox`: compact, label after the box. */
    kind?: 'switch' | 'checkbox'
    disabled?: boolean
    /** Help shown in the warning colour (e.g. a rule that hides the widget everywhere). */
    warn?: boolean
  }>(),
  { help: undefined, kind: 'checkbox', disabled: false, warn: false }
)

const id = useId()
const helpId = `${id}-help`
const { value, commit } = useDraft(
  () => props.current,
  (v) => props.apply(v)
)

function onChange(e: Event): void {
  if (e.target instanceof HTMLInputElement) commit(e.target.checked)
}
</script>

<template>
  <div v-if="kind === 'switch'" class="st-row">
    <label :for="id" class="st-row-text" :class="{ 'st-disabled': disabled }">
      <span class="st-label">{{ label }}</span>
      <span v-if="help" :id="helpId" class="st-help" :class="{ 'st-help-warn': warn }">{{
        help
      }}</span>
    </label>
    <input
      :id="id"
      type="checkbox"
      role="switch"
      class="st-switch"
      :checked="value"
      :disabled="disabled"
      :aria-describedby="help ? helpId : undefined"
      @change="onChange"
    />
  </div>
  <label v-else class="st-check" :class="{ 'st-disabled': disabled }">
    <input
      type="checkbox"
      :checked="value"
      :disabled="disabled"
      :aria-describedby="help ? helpId : undefined"
      @change="onChange"
    />
    <span class="st-check-text">
      <span>{{ label }}</span>
      <span v-if="help" :id="helpId" class="st-help" :class="{ 'st-help-warn': warn }">{{
        help
      }}</span>
    </span>
  </label>
</template>
