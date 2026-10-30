<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import { useDraft } from '../useDraft'

/**
 * Sidebar eye that shows and toggles a widget's visibility without opening its page. The eye is
 * the one symbol of visibility (R35), as on the edit chips: open when on, crossed out when off,
 * and faint when on but a rule hides it now (`held`: why, in lower case, 'oculto en práctica'),
 * which its tooltip says.
 */
const props = withDefaults(
  defineProps<{
    title: string
    current: boolean
    apply: (visible: boolean) => Promise<unknown>
    held?: string | null
  }>(),
  { held: null }
)

const { value, commit } = useDraft(
  () => props.current,
  (v) => props.apply(v)
)
const t = useI18n()
const isHeld = computed(() => value.value && props.held !== null)
const tip = computed(() => {
  const v = t.value.settings.visibility
  if (isHeld.value && props.held !== null) return v.held(props.title, props.held)
  return value.value ? v.hide(props.title) : v.show(props.title)
})
const label = computed(() => t.value.settings.visibility.label(props.title))
</script>

<template>
  <button
    type="button"
    role="switch"
    class="vis"
    :class="{ on: value, held: isHeld }"
    :aria-checked="value"
    :aria-label="label"
    :aria-description="isHeld ? tip : undefined"
    :title="tip"
    @click="commit(!value)"
  >
    <Icon :name="value ? 'eye' : 'eye-off'" class="eye" />
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
  color: var(--ov-fg-dim);
  font-size: var(--st-t-body);
  cursor: pointer;
}

.vis:hover {
  background: var(--st-hover);
  color: var(--ov-fg);
}

.vis.on {
  color: var(--ov-fg-muted);
}

/* On, but a rule hides it now: the same eye, faint and ringed with a hollow dashed circle. */
.vis.held {
  border: 1px dashed var(--st-border-strong);
  color: var(--ov-fg-dim);
}
</style>
