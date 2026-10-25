<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { useDraft } from '../useDraft'

/** Sidebar dot that shows and toggles a widget's visibility without opening its page. */
const props = defineProps<{
  title: string
  current: boolean
  apply: (visible: boolean) => Promise<unknown>
}>()

const { value, commit } = useDraft(
  () => props.current,
  (v) => props.apply(v)
)
const t = useI18n()
const tip = computed(() => {
  const v = t.value.settings.visibility
  return value.value ? v.hide(props.title) : v.show(props.title)
})
const label = computed(() => t.value.settings.visibility.label(props.title))
</script>

<template>
  <button
    type="button"
    role="switch"
    class="vis"
    :class="{ on: value }"
    :aria-checked="value"
    :aria-label="label"
    :title="tip"
    @click="commit(!value)"
  >
    <span class="dot" aria-hidden="true" />
  </button>
</template>

<style scoped>
.vis {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: var(--st-radius-sm);
  background: transparent;
  cursor: pointer;
}

.vis:hover {
  background: var(--st-hover);
}

.dot {
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--ov-fg-dim);
  border-radius: 50%;
}

.vis.on .dot {
  border-color: var(--st-ok);
  background: var(--st-ok);
}
</style>
