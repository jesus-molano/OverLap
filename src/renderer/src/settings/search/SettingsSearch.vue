<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  shallowRef,
  useId,
  useTemplateRef,
  watch
} from 'vue'
import Icon from '../../ui/Icon.vue'
import { FOCUS_SEARCH_EVENT } from './focusSearch'
import { useI18n } from '../../composables/useI18n'
import { pageTitle } from '../nav'
import { useNavigate } from '../navigate'
import { useOverlayState } from '../../composables/useOverlay'
import { searchIndex, settingsKey, wantIndex } from './searchIndex'
import { searchSettings, type SearchResult } from './settingsSearch'

/**
 * «Buscar ajuste» (R33), at the top of the sidebar (and of the narrow window's bar): type a few
 * words, pick a result (arrows and Enter, or a click) and the window goes to its page, opens
 * what hides it and points it out. A combobox with its list in a popover under it (the top
 * layer: the sidebar never cuts it). The pages are harvested the first time it gets the focus.
 */
const t = useI18n()
const navigate = useNavigate()
const listId = useId()
const input = useTemplateRef<HTMLInputElement>('input')
const panel = useTemplateRef<HTMLElement>('panel')
const query = shallowRef('')
const active = shallowRef(0)
const open = shallowRef(false)

const results = computed<SearchResult[]>(() =>
  searchIndex.value === null
    ? []
    : searchSettings(searchIndex.value, query.value, (p) => pageTitle(t.value, p))
)
const preparing = computed(() => searchIndex.value === null && query.value.trim() !== '')
const empty = computed(
  () => searchIndex.value !== null && query.value.trim() !== '' && results.value.length === 0
)
const shown = computed(
  () => open.value && (results.value.length > 0 || preparing.value || empty.value)
)

/** 'Combustible › Pie' under each result: its page and where on it. */
function whereOf(r: SearchResult): string {
  const page = pageTitle(t.value, r.page)
  if (r.kind === 'page') return t.value.settings.search.page
  const where = r.context === '' ? page : `${page} › ${r.context}`
  // Not on the page now: another setting there shows it.
  return r.gated === true ? `${where} · ${t.value.settings.search.gated}` : where
}

function place(): void {
  const i = input.value
  const p = panel.value
  if (!i || !p) return
  const r = i.getBoundingClientRect()
  const w = Math.max(r.width, Math.min(380, window.innerWidth - 16))
  p.style.width = `${Math.round(w)}px`
  p.style.left = `${Math.round(Math.max(8, Math.min(r.left, window.innerWidth - w - 8)))}px`
  p.style.top = `${Math.round(r.bottom + 4)}px`
}

watch(shown, async (on) => {
  await nextTick()
  const p = panel.value
  if (!p) return
  if (on) {
    if (!p.matches(':popover-open')) p.showPopover()
    place()
  } else if (p.matches(':popover-open')) p.hidePopover()
})
watch(results, () => (active.value = 0))

const { settings } = useOverlayState()
/** Harvested again when a setting changed what the pages show since the last time (R33). */
function onFocus(): void {
  wantIndex(settingsKey(settings.value))
  open.value = true
}

function onBlur(): void {
  // A click on a result lands first (pointerdown keeps the focus on the field).
  open.value = false
}

function go(r: SearchResult | undefined): void {
  if (!r) return
  open.value = false
  query.value = ''
  input.value?.blur()
  navigate(r.page, { text: r.text, context: r.context, kind: r.kind })
}

function onKey(e: KeyboardEvent): void {
  const n = results.value.length
  if (e.key === 'ArrowDown' && n > 0) {
    e.preventDefault()
    open.value = true
    active.value = (active.value + 1) % n
  } else if (e.key === 'ArrowUp' && n > 0) {
    e.preventDefault()
    active.value = (active.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    go(results.value[active.value])
  } else if (e.key === 'Escape') {
    if (query.value === '' && !open.value) return
    e.preventDefault()
    e.stopPropagation()
    if (open.value && query.value !== '') query.value = ''
    else open.value = false
  }
}

const optionId = (i: number): string => `${listId}-${i}`

// «Ayuda rápida» (R40) sends the user here: the one field mounted (sidebar or narrow bar).
const focusField = (): void => input.value?.focus()
onMounted(() => window.addEventListener(FOCUS_SEARCH_EVENT, focusField))
onUnmounted(() => window.removeEventListener(FOCUS_SEARCH_EVENT, focusField))
</script>

<template>
  <div class="search" role="search">
    <span class="search-icon" aria-hidden="true">
      <Icon name="search" />
    </span>
    <input
      ref="input"
      v-model="query"
      type="search"
      class="st-field search-field"
      role="combobox"
      :placeholder="t.settings.search.placeholder"
      :aria-label="t.settings.search.label"
      :aria-expanded="shown"
      :aria-controls="listId"
      aria-autocomplete="list"
      :aria-activedescendant="shown && results.length > 0 ? optionId(active) : undefined"
      autocomplete="off"
      spellcheck="false"
      @focus="onFocus"
      @blur="onBlur"
      @input="open = true"
      @keydown="onKey"
    />
    <div ref="panel" popover="manual" class="search-panel">
      <p v-if="preparing" class="search-note">{{ t.settings.search.preparing }}</p>
      <p v-else-if="empty" class="search-note">{{ t.settings.search.none(query.trim()) }}</p>
      <ul :id="listId" role="listbox" class="search-list" :aria-label="t.settings.search.label">
        <li
          v-for="(r, i) in results"
          :id="optionId(i)"
          :key="`${r.page}\n${r.text}\n${r.context}`"
          role="option"
          class="search-item"
          :aria-selected="i === active"
          @pointerdown.prevent
          @pointerenter="active = i"
          @click="go(r)"
        >
          <span class="search-text">{{ r.text }}</span>
          <span class="search-where">{{ whereOf(r) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.search-icon {
  position: absolute;
  left: 9px;
  display: inline-flex;
  color: var(--ov-fg-dim);
  pointer-events: none;
}

.search-icon .ov-icon {
  width: 14px;
  height: 14px;
}

/* Above html.ov-settings .st-field's padding: room for the magnifier. */
.search .search-field {
  width: 100%;
  min-width: 0;
  padding-left: 32px;
  font-size: var(--st-t-ui);
}

.search-panel {
  position: fixed;
  inset: auto;
  max-height: min(420px, 70vh);
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  border: 1px solid var(--st-border-strong);
  border-radius: var(--st-radius);
  background: var(--st-surface-hi);
  box-shadow:
    var(--st-lit),
    0 0 0 1px rgb(0 0 0 / 35%);
  color: var(--ov-fg);
}

.search-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 12px;
  border-radius: var(--st-radius-sm);
  cursor: pointer;
}

.search-item[aria-selected='true'] {
  background: var(--st-hover);
}

.search-text {
  font-size: var(--st-t-ui);
  font-weight: var(--ov-w-strong);
}

.search-where,
.search-note {
  color: var(--ov-fg-muted);
  font-size: var(--st-t-help);
}

.search-note {
  padding: 8px 12px;
}
</style>
