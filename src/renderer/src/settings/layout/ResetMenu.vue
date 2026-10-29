<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { widgetTitle } from '@shared/i18n'
import type { WidgetId } from '@shared/widgets'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import { resetBounds, resetWidget, resetWidgetAll } from '../undo/restore'

/**
 * A widget page's "Restablecer…" (R24), at the top beside "Visible": what each item resets, by
 * the name of its section, and one click each (the toast offers "Deshacer" and names the layout).
 * The same resets as the icons in the sections' heads, plus the position and everything at once.
 * A disclosure: Escape or a click elsewhere closes it, the focus goes back to its button.
 */
const props = defineProps<{ widgetId: WidgetId }>()

const t = useI18n()
const open = shallowRef(false)
const root = useTemplateRef<HTMLElement>('root')
const toggle = useTemplateRef<HTMLButtonElement>('toggle')

type Item = 'options' | 'window' | 'bounds' | 'all'
const ITEMS: readonly Item[] = ['options', 'window', 'bounds', 'all']
const items = computed(() => {
  const r = t.value.settings.widgetPage.reset
  return ITEMS.map((id) => ({ id, label: r[id].label, description: r[id].description }))
})

function run(item: Item): void {
  close(true)
  if (item === 'bounds') resetBounds(props.widgetId)
  else if (item === 'all') resetWidgetAll(props.widgetId)
  else resetWidget(props.widgetId, item)
}

function close(refocus: boolean): void {
  if (!open.value) return
  open.value = false
  if (refocus) toggle.value?.focus()
}

function onFocusOut(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null
  if (next === null || !root.value?.contains(next)) close(false)
}
</script>

<template>
  <div ref="root" class="reset-menu" @focusout="onFocusOut" @keydown.esc="close(true)">
    <button
      ref="toggle"
      type="button"
      class="st-btn st-btn-sm st-btn-ghost reset-toggle"
      :aria-expanded="open"
      :aria-label="t.settings.widgetPage.reset.menuLabel(widgetTitle(t, widgetId))"
      @click="open = !open"
    >
      <Icon name="reset" />{{ t.settings.widgetPage.reset.menu }}
    </button>
    <ul v-if="open" class="reset-list">
      <li v-for="item in items" :key="item.id">
        <button type="button" class="reset-item" @click="run(item.id)">
          <span class="reset-label">{{ item.label }}</span>
          <span class="reset-desc">{{ item.description }}</span>
        </button>
      </li>
      <li class="reset-note">{{ t.settings.widgetPage.reset.undoNote }}</li>
    </ul>
  </div>
</template>

<style scoped>
.reset-menu {
  position: relative;
}

.reset-toggle {
  gap: 6px;
}

.reset-list {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  right: 0;
  width: min(330px, 80vw);
  margin: 0;
  padding: 4px;
  border: 1px solid var(--st-border-hi);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  box-shadow: 0 0 0 1px rgb(0 0 0 / 35%);
  list-style: none;
}

.reset-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: var(--st-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.reset-item:hover,
.reset-item:focus-visible {
  background: var(--st-hover);
}

.reset-label {
  color: var(--ov-fg);
  font-size: 13px;
}

.reset-desc {
  color: var(--ov-fg-muted);
  font-size: 12px;
  line-height: 1.35;
}

.reset-note {
  padding: 6px 10px 4px;
  border-top: 1px solid var(--st-border);
  color: var(--ov-fg-dim);
  font-size: 11.5px;
}
</style>
