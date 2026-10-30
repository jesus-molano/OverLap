<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue'
import { useI18n } from '../../composables/useI18n'
import Icon from '../../ui/Icon.vue'
import type { ResetItem } from './resetItems'

/**
 * A page's "Restablecer…" (R24), at the end of its title line on every page that resets something
 * (a widget, Apariencia, Atajos): what each item resets, by the name of its section, and one click
 * each (the toast offers "Deshacer" and names the layout). The same resets as the icons in the
 * sections' heads, plus the page's "everything". A disclosure: Escape or a click elsewhere closes
 * it, the focus goes back to its button.
 */
defineProps<{
  /** The menu's name for screen readers ('Restablecer Relativo'). */
  label: string
  items: readonly ResetItem[]
}>()

const t = useI18n()
const open = shallowRef(false)
const root = useTemplateRef<HTMLElement>('root')
const toggle = useTemplateRef<HTMLButtonElement>('toggle')

function run(item: ResetItem): void {
  close(true)
  item.run()
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
      :aria-label="label"
      @click="open = !open"
    >
      <Icon name="reset" />{{ t.settings.widgetPage.reset.menu }}
    </button>
    <ul v-if="open" class="reset-list">
      <li v-for="item in items" :key="item.id">
        <button type="button" class="reset-item" @click="run(item)">
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
  gap: 8px;
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
  padding: 8px 12px;
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
  font-size: var(--st-t-ui);
}

.reset-desc {
  color: var(--ov-fg-muted);
  font-size: var(--st-t-help);
  line-height: 1.35;
}

.reset-note {
  padding: 8px 12px 4px;
  border-top: 1px solid var(--st-border);
  color: var(--ov-fg-dim);
  font-size: var(--st-t-help);
}
</style>
