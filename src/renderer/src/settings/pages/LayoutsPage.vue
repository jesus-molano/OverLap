<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { LAYOUT_EXAMPLES, type LayoutExample } from '@shared/layoutExamples'
import { MAX_LAYOUTS, MAX_LAYOUT_NAME, canAddLayout, layoutName } from '@shared/layouts'
import { useDeviceNames, useShortcuts } from '../../composables/useShortcuts'
import { bindingText } from '../shortcutsView'
import { LAYOUT_SORTS } from '@shared/settingsSchema'
import type { LayoutMode, LayoutSort } from '@shared/types'
import { useI18n, useLocale } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useOptions } from '../../composables/useWidgetSettings'
import HelpText from '../controls/HelpText.vue'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter, sendCommand } from '../editor'
import { offerRestore } from '../undo/restore'
import PageFrame from '../layout/PageFrame.vue'
import PageSection from '../layout/PageSection.vue'
import { usePersonalBests } from '../personalBests'
import {
  carRows,
  carsOfBests,
  linkSuggestion,
  layoutCommands as cmd,
  isFileNotice,
  layoutList,
  linkOptions,
  noticeText,
  revealOffset,
  rowToReveal,
  useLayoutState,
  type CarRow
} from '../layoutsView'
import { useDraft } from '../useDraft'
import LayoutItem from './LayoutItem.vue'
import LayoutModeChoice from './LayoutModeChoice.vue'

/**
 * The saved layouts (settings.savedLayouts): the list (apply, edit the name and what it restores,
 * duplicate, order, export, delete), saving the widgets and their options as they are under a new
 * name, importing a file (either as "Posición y opciones" or "Solo posición"), and the automatic
 * switch with its car links (settings.layouts.autoSwitch). Main runs every command and
 * broadcasts the settings; this page only shows them. With many layouts the list scrolls in a
 * box of its own (the sections below stay in reach) and can be searched; the one in use stays
 * pinned above it (layoutsView layoutList).
 */
const t = useI18n()
const locale = useLocale()
const titleId = useId()
const saveId = useId()
const searchId = useId()
const sortLabelId = useId()
const sortName = useId()
const saveModeId = useId()
const importModeId = useId()
const { settings } = useOverlayState()
const { currentCar, layoutNotice } = useLayoutState()
const options = useOptions('layouts')
const setAutoSwitch = optionSetter('layouts')('autoSwitch')
const { value: sort, commit: setSort } = useDraft<LayoutSort>(
  () => options.value.sort,
  optionSetter('layouts')('sort')
)

const lib = computed(() => settings.value?.savedLayouts ?? DEFAULT_SETTINGS.savedLayouts)
const query = shallowRef('')
const view = computed(() =>
  layoutList(t.value, lib.value, { sort: sort.value, query: query.value, locale: locale.value })
)
/** Cars you have a personal best in: linkable without getting in them again (R26). */
const bests = usePersonalBests()
const knownCars = computed(() => carsOfBests(bests.entries.value))
const cars = computed(() => carRows(t.value, lib.value, currentCar.value, knownCars.value))
/** The car you are in has no layout: «Vincular a «X»», the one in use (R26). */
const suggestion = computed(() => linkSuggestion(lib.value, currentCar.value))

function linkSuggested(): void {
  const s = suggestion.value
  const car = currentCar.value
  if (s && car) cmd.link(car, s.id)
}

/** Linking turned «Según el coche» on: said under it, with "Deshacer" (R26). */
const autoOnText = computed(() => {
  const n = layoutNotice.value
  return n !== null && n.kind === 'auto-switch-on'
    ? t.value.settings.layouts.autoOn(n.carName)
    : null
})
// Main keeps what «Deshacer» undoes (the switch off, and the layout it applied put back), so
// the tray can undo it too.
watch(layoutNotice, (n) => {
  if (n === null || n.kind !== 'auto-switch-on' || n.undo === null) return
  const id = n.undo
  offerRestore(
    (m) => m.settings.layouts.autoOnUndo,
    () => sendCommand({ type: 'undo-notice', id })
  )
})
const currentRow = computed<CarRow | null>(() => cars.value.find((c) => c.current) ?? null)
const otherCars = computed(() => cars.value.filter((c) => !c.current))
const links = computed(() => linkOptions(lib.value, locale.value))
const roomLeft = computed(() => canAddLayout(lib.value))
const notice = computed(() => {
  const n = layoutNotice.value
  return n !== null && isFileNotice(n) ? noticeText(t.value, n) : null
})

/** The example layouts (R57): added, never applied; then how to switch to them. */
const shortcuts = useShortcuts()
const deviceNames = useDeviceNames()
const examples = computed(() =>
  LAYOUT_EXAMPLES.map((kind) => ({ kind, ...t.value.settings.layouts.examples[kind] }))
)
const addedExample = shallowRef<LayoutExample | null>(null)
const addedText = computed(() => {
  const kind = addedExample.value
  if (kind === null) return null
  const first = shortcuts.value.nextLayout[0]
  const keys = first === undefined ? null : bindingText(t.value, first, deviceNames.value)
  const e = t.value.settings.layouts.examples
  return e.added(e[kind].name, keys)
})
function addExample(kind: LayoutExample): void {
  cmd.example(kind, t.value.settings.layouts.examples[kind].name)
  addedExample.value = kind
}

const newName = shallowRef('')
/**
 * «Vincular a <coche actual>» in the save form (R26): ticked while the car you are in has no
 * layout yet and «Según el coche» is on already; with it off, saving never turns it on unless
 * you tick this (one the car has stays unless you tick it).
 */
const linkNew = shallowRef(false)
watch(
  () => [currentRow.value?.layoutId ?? '', options.value.autoSwitch] as const,
  ([id, auto]) => (linkNew.value = id === '' && auto),
  { immediate: true }
)
/** What the next layout saved, and the next one imported, restore. */
const saveMode = shallowRef<LayoutMode>('full')
const importMode = shallowRef<LayoutMode>('full')
const canSave = computed(() => roomLeft.value && layoutName(newName.value) !== null)

function save(): void {
  if (!canSave.value) return
  const car = currentCar.value
  cmd.save(newName.value, saveMode.value, linkNew.value && car !== null ? car : undefined)
  newName.value = ''
}

/** The row being edited (null: none). */
const renaming = shallowRef<string | null>(null)

function onRename(id: string, open: boolean): void {
  if (open) renaming.value = id
  else if (renaming.value === id) renaming.value = null
}

const searchInput = useTemplateRef<HTMLInputElement>('search')

function clearSearch(): void {
  query.value = ''
  searchInput.value?.focus()
}

/** Esc empties the search (and goes no further); with nothing typed it passes on. */
function onSearchEsc(e: KeyboardEvent): void {
  if (query.value === '') return
  e.preventDefault()
  e.stopPropagation()
  query.value = ''
}

// A layout saved, duplicated or imported, or another one put in use: its row scrolled into the
// list's box (the box only, never the page: a notice under "Archivos" stays in view). Keyed by a
// string, so the settings broadcast on every change (a drag in edit mode) does not call back.
const listBox = useTemplateRef<HTMLElement>('listBox')
const listRows = useTemplateRef<HTMLElement>('listRows')
const libKey = computed(
  () => `${lib.value.activeId}\n${lib.value.list.map((l) => l.id).join('\n')}`
)
let shownLib = { ids: lib.value.list.map((l) => l.id), activeId: lib.value.activeId }
watch(libKey, async () => {
  const next = { ids: lib.value.list.map((l) => l.id), activeId: lib.value.activeId }
  const id = rowToReveal(shownLib, next)
  shownLib = next
  if (id === null) return
  await nextTick()
  const box = listBox.value
  const row = box?.querySelector(`[data-layout-id="${CSS.escape(id)}"]`)
  if (!box || !(row instanceof HTMLElement)) return
  box.scrollTop += revealOffset(box.getBoundingClientRect(), row.getBoundingClientRect())
})

// The box is a Tab stop (a region you scroll with the keys) only while it has something to
// scroll; `scrolled` shades its top edge, under the pinned row, once rows have gone under it.
const overflowing = shallowRef(false)
const scrolled = shallowRef(false)
const scrollable = computed(() => view.value.many && overflowing.value)

function measureBox(): void {
  const box = listBox.value
  overflowing.value = box !== null && box.scrollHeight > box.clientHeight + 1
  scrolled.value = box !== null && box.scrollTop > 0
}

// The rows' height changes with the search, the window's width (rows wrap) and the library.
const boxSizes = new ResizeObserver(measureBox)
watch(
  [listBox, listRows],
  ([box, rows], _prev, onCleanup) => {
    for (const el of [box, rows]) if (el) boxSizes.observe(el)
    measureBox()
    onCleanup(() => boxSizes.disconnect())
  },
  { flush: 'post' }
)
onBeforeUnmount(() => boxSizes.disconnect())

/**
 * «Traer aquí» (R51): main moves every widget on another display to this window's one and says
 * how many (the tray's, to the mouse's screen, is said too); when some moved, "Deshacer" asks
 * main to put each back where it was (main keeps where: the tray can undo it as well).
 */
function gather(): void {
  layoutNotice.value = null
  sendCommand({ type: 'gather-widgets' })
}

const gatheredText = computed(() => {
  const n = layoutNotice.value
  if (n === null || n.kind !== 'gathered') return null
  const g = t.value.settings.layouts.screens
  if (n.to === 'cursor') return n.count > 0 ? g.gatheredCursor(n.count) : g.noneCursor
  return n.count > 0 ? g.gathered(n.count) : g.none
})

watch(layoutNotice, (n) => {
  if (n === null || n.kind !== 'gathered' || n.undo === null) return
  const id = n.undo
  const cursor = n.to === 'cursor'
  offerRestore(
    (m) => (cursor ? m.settings.layouts.screens.undoCursor : m.settings.layouts.screens.undo),
    () => sendCommand({ type: 'undo-notice', id })
  )
})

function onLink(car: CarRow, e: Event): void {
  const v = e.target instanceof HTMLSelectElement ? e.target.value : ''
  cmd.link(car.car, v === '' ? null : v)
}
</script>

<template>
  <PageFrame :labelledby="titleId">
    <template #top>
      <header class="page-head">
        <h1 :id="titleId" class="page-title">{{ t.settings.nav.layouts }}</h1>
        <HelpText
          tag="p"
          class="page-sub"
          :text="t.settings.layouts.sub"
          :more="t.settings.layouts.subMore"
        />
      </header>
    </template>

    <div class="st-cols">
      <PageSection :title="t.settings.layouts.listTitle" :note="t.settings.layouts.listNote">
        <div v-if="view.total > 1" class="st-row st-row-wrap tools">
          <div v-if="view.many" class="find" role="search">
            <label :for="searchId" class="st-sr-only">{{ t.settings.layouts.search }}</label>
            <span class="search-box">
              <input
                :id="searchId"
                ref="search"
                v-model="query"
                type="search"
                class="st-field search"
                :placeholder="t.settings.layouts.searchPlaceholder"
                autocomplete="off"
                spellcheck="false"
                @keydown.esc="onSearchEsc"
              />
              <button
                v-if="query !== ''"
                type="button"
                class="st-btn st-btn-ghost st-btn-icon clear"
                :aria-label="t.settings.layouts.clearSearch"
                :title="t.settings.layouts.clearSearch"
                @click="clearSearch"
              >
                <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" class="cross" />
                </svg>
              </button>
            </span>
            <span class="st-help count" aria-live="polite">{{
              view.query !== '' ? t.settings.layouts.matches(view.shown, view.total) : ''
            }}</span>
          </div>
          <div class="sort-by">
            <span :id="sortLabelId" class="st-label">{{ t.settings.layouts.sort }}</span>
            <div class="st-seg" role="radiogroup" :aria-labelledby="sortLabelId">
              <label
                v-for="s in LAYOUT_SORTS"
                :key="s"
                class="st-seg-item"
                :title="t.settings.layouts.sortHints[s]"
              >
                <input
                  type="radio"
                  class="st-seg-input"
                  :name="sortName"
                  :value="s"
                  :checked="sort === s"
                  @change="setSort(s)"
                />
                <span class="st-seg-text">{{ t.settings.layouts.sorts[s] }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="lists">
          <div v-if="view.pinned" class="pinned" :class="{ 'is-scroll': view.many }">
            <div class="pinned-body">
              <ul class="list" :aria-label="t.settings.layouts.inUse">
                <LayoutItem
                  :row="view.pinned"
                  order="space"
                  :around-active="true"
                  :room-left="roomLeft"
                  :renaming="renaming === view.pinned.id"
                  @rename="(open: boolean) => onRename(lib.activeId, open)"
                />
              </ul>
              <p v-if="!view.pinnedMatches" class="st-help apart-note">
                {{ t.settings.layouts.pinnedNoMatch }}
              </p>
            </div>
          </div>

          <!-- Many layouts: a box of its own, about LAYOUT_LIST_ROWS rows tall (Tab, keys, wheel). -->
          <div
            ref="listBox"
            class="list-box"
            :class="{ 'is-scroll': view.many, 'is-scrolled': scrollable && scrolled }"
            :tabindex="scrollable ? 0 : undefined"
            :role="scrollable ? 'region' : undefined"
            :aria-label="scrollable ? t.settings.layouts.listTitle : undefined"
            @scroll.passive="measureBox"
          >
            <ul
              v-if="view.rows.length > 0"
              ref="listRows"
              class="list"
              :aria-label="scrollable ? undefined : t.settings.layouts.listTitle"
            >
              <LayoutItem
                v-for="r in view.rows"
                :key="r.id"
                :row="r"
                :order="view.reorder ? 'move' : 'space'"
                :around-active="view.aroundActive"
                :room-left="roomLeft"
                :renaming="renaming === r.id"
                @rename="(open: boolean) => onRename(r.id, open)"
              />
            </ul>
            <p v-else-if="view.query !== ''" class="st-help empty">
              {{ t.settings.layouts.noMatch(view.query) }}
            </p>
          </div>
        </div>
      </PageSection>

      <PageSection :title="t.settings.layouts.saveTitle">
        <form class="st-row st-row-stack" @submit.prevent="save">
          <label :for="saveId" class="st-row-text">
            <span class="st-label">{{ t.settings.layouts.nameLabel }}</span>
            <span class="st-help">{{
              roomLeft ? t.settings.layouts.saveHelp : t.settings.layouts.full(MAX_LAYOUTS)
            }}</span>
          </label>
          <div class="save">
            <input
              :id="saveId"
              v-model="newName"
              type="text"
              class="st-field name-field"
              :maxlength="MAX_LAYOUT_NAME"
              :placeholder="t.settings.layouts.savePlaceholder"
              :disabled="!roomLeft"
              autocomplete="off"
              spellcheck="false"
            />
            <button type="submit" class="st-btn" :disabled="!canSave">
              {{ t.settings.layouts.save }}
            </button>
          </div>
          <label v-if="currentRow" class="st-check link-new">
            <input v-model="linkNew" type="checkbox" :disabled="!roomLeft" />
            <span>{{ t.settings.layouts.linkNew(currentRow.label) }}</span>
          </label>
          <div class="mode">
            <span :id="saveModeId" class="st-label">{{ t.settings.layouts.modeLabel }}</span>
            <LayoutModeChoice v-model="saveMode" :labelledby="saveModeId" :disabled="!roomLeft" />
            <span class="st-help">{{ t.settings.layouts.modeHints[saveMode] }}</span>
          </div>
        </form>
      </PageSection>

      <PageSection
        :title="t.settings.layouts.examples.title"
        :note="t.settings.layouts.examples.note"
      >
        <div v-for="e in examples" :key="e.kind" class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ e.name }}</span>
            <span class="st-help">{{ e.hint }}</span>
          </div>
          <button
            type="button"
            class="st-btn"
            :disabled="!roomLeft"
            :aria-label="t.settings.layouts.examples.addLabel(e.name)"
            @click="addExample(e.kind)"
          >
            {{ t.settings.layouts.examples.add }}
          </button>
        </div>
        <p v-if="addedText" class="st-row st-help" role="status">{{ addedText }}</p>
      </PageSection>

      <PageSection :title="t.settings.layouts.autoTitle">
        <ToggleControl
          kind="switch"
          :label="t.settings.layouts.auto"
          :help="t.settings.layouts.autoHelp"
          :more="t.settings.layouts.autoMore"
          :current="options.autoSwitch"
          :apply="setAutoSwitch"
        />

        <div class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ t.settings.layouts.currentCar }}</span>
            <span class="st-help">{{
              currentRow ? currentRow.label : t.settings.layouts.noCar
            }}</span>
          </div>
          <select
            v-if="currentRow"
            class="st-field link"
            :value="currentRow.layoutId"
            :aria-label="t.settings.layouts.linkLabel(currentRow.label)"
            @change="onLink(currentRow, $event)"
          >
            <option value="">{{ t.settings.layouts.noLink }}</option>
            <option v-for="l in links" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </div>
        <div v-if="suggestion && currentRow" class="st-row st-row-wrap suggest">
          <span class="st-help">{{
            t.settings.layouts.linkSuggestHelp(currentRow.label, suggestion.name)
          }}</span>
          <button type="button" class="st-btn st-btn-sm" @click="linkSuggested">
            {{ t.settings.layouts.linkSuggest(suggestion.name) }}
          </button>
        </div>
        <p v-if="autoOnText" class="st-row st-help" role="status">{{ autoOnText }}</p>

        <div class="st-row st-row-stack">
          <span class="st-label">{{ t.settings.layouts.seenCars }}</span>
          <p v-if="otherCars.length === 0" class="st-help">{{ t.settings.layouts.noSeenCars }}</p>
          <ul v-else class="cars-list">
            <li v-for="c in otherCars" :key="c.car.carId" class="car">
              <span class="car-name">{{ c.label }}</span>
              <select
                class="st-field link"
                :value="c.layoutId"
                :aria-label="t.settings.layouts.linkLabel(c.label)"
                @change="onLink(c, $event)"
              >
                <option value="">{{ t.settings.layouts.noLink }}</option>
                <option v-for="l in links" :key="l.id" :value="l.id">{{ l.name }}</option>
              </select>
            </li>
          </ul>
        </div>
        <p v-if="!options.autoSwitch && lib.links.length > 0" class="st-row st-help st-help-warn">
          {{ t.settings.layouts.autoOff }}
        </p>
      </PageSection>

      <PageSection :title="t.settings.layouts.screens.title">
        <div class="st-row st-row-wrap">
          <div class="st-row-text">
            <span class="st-label">{{ t.settings.layouts.screens.gather }}</span>
            <span class="st-help">{{ t.settings.layouts.screens.gatherHelp }}</span>
          </div>
          <button type="button" class="st-btn" @click="gather">
            {{ t.settings.layouts.screens.button }}
          </button>
        </div>
        <p v-if="gatheredText" class="st-row st-help" role="status">{{ gatheredText }}</p>
      </PageSection>

      <PageSection :title="t.settings.layouts.filesTitle">
        <div class="st-row st-row-wrap">
          <HelpText
            class="st-help files-help"
            :text="t.settings.layouts.filesHelp"
            :more="t.settings.layouts.filesMore"
          />
        </div>
        <div class="st-row st-row-wrap">
          <div class="mode import-mode">
            <span :id="importModeId" class="st-label">{{ t.settings.layouts.importMode }}</span>
            <LayoutModeChoice
              v-model="importMode"
              :labelledby="importModeId"
              :disabled="!roomLeft"
            />
            <span class="st-help">{{ t.settings.layouts.modeHints[importMode] }}</span>
          </div>
          <button
            type="button"
            class="st-btn"
            :disabled="!roomLeft"
            @click="cmd.importOne(importMode)"
          >
            {{ t.settings.layouts.import }}
          </button>
        </div>
        <p
          v-if="notice"
          class="st-row st-help"
          :class="{ 'st-help-warn': notice.error }"
          role="status"
        >
          {{ notice.text }}
        </p>
      </PageSection>
    </div>

    <template #foot>
      <slot />
    </template>
  </PageFrame>
</template>

<style scoped>
.page-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 14px;
}

.page-title {
  font-family: var(--ov-font-num);
  font-size: 22px;
  font-weight: var(--ov-w-strong);
  line-height: 1.2;
}

.page-sub {
  max-width: 46em;
  color: var(--ov-fg-muted);
  font-size: 12.5px;
}

.link-new {
  font-size: 13px;
}

.find {
  display: flex;
  flex: 1 1 16em;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

/* The clear button sits inside the field, over its right end. Wrapped onto a line of its own
   (a narrow window), the field takes that line. */
.search-box {
  position: relative;
  display: flex;
  flex: 1 1 18em;
  min-width: 0;
}

.search {
  width: 100%;
  min-width: 0;
  padding-right: 28px;
}

/* Our own clear button instead of the native cross, which Tab cannot reach. */
.search::-webkit-search-cancel-button {
  display: none;
}

.clear {
  position: absolute;
  top: 50%;
  right: 3px;
  width: 22px;
  min-height: 22px;
  transform: translateY(-50%);
}

.cross {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.count {
  flex: none;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.sort-by {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-left: auto;
}

.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The pinned one stands apart from the rest: a gap and a stronger, thicker line, then the others. */
.pinned {
  margin-bottom: 6px;
}

.pinned-body {
  border-bottom: 2px solid var(--st-border-hi);
}

.apart-note {
  padding: 0 0 8px 10px;
}

/*
 * Pulled into the card's right padding, so the thin scrollbar sits there. The pinned block keeps
 * the same (empty) gutter, so both lists share one width whatever the scrollbar's and their
 * buttons line up.
 */
.pinned.is-scroll,
.list-box.is-scroll {
  margin-right: -13px;
  padding-right: 2px;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.pinned.is-scroll {
  overflow-y: hidden;
}

/*
 * About LAYOUT_LIST_ROWS rows (the pinned one above counts as one), then it scrolls; never more
 * than half a short window, so the sections below stay in reach. Narrow, the rows wrap to twice
 * their height and fewer fit: the box keeps its height rather than pushing the sections down.
 */
.list-box.is-scroll {
  max-height: min(calc(7.5 * 53px), 50vh);
  overflow-y: auto;
}

/* Rows gone under the pinned one: its edge shaded, as a lid over them. */
.list-box.is-scrolled {
  box-shadow: inset 0 6px 2px -3px rgba(0, 0, 0, 0.45);
}

.list-box.is-scroll:focus-visible {
  outline-offset: -2px;
}

.empty {
  padding: 14px 0 14px 10px;
}

.save {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.name-field {
  flex: 1 1 12em;
  min-width: 0;
}

.link {
  flex: 0 1 14em;
  min-width: 0;
}

.cars-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.car {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.car-name {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.files-help {
  flex: 1 1 16em;
}

/* What a layout saved or imported restores: the label, the choice, and what it means. */
.mode {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  width: 100%;
}

.import-mode {
  flex: 1 1 auto;
  width: auto;
}
</style>
