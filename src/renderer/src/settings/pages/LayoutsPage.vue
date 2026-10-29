<script setup lang="ts">
import { computed, nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { MAX_LAYOUTS, MAX_LAYOUT_NAME, canAddLayout, layoutName } from '@shared/layouts'
import { LAYOUT_SORTS } from '@shared/settingsSchema'
import type { LayoutSort } from '@shared/types'
import { useI18n, useLocale } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useOptions } from '../../composables/useWidgetSettings'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter } from '../editor'
import PageFrame from '../layout/PageFrame.vue'
import PageSection from '../layout/PageSection.vue'
import {
  carRows,
  layoutCommands as cmd,
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

/**
 * The saved layouts (settings.savedLayouts): the list (apply, rename, duplicate, order, export,
 * delete), saving the widgets as they are under a new name, importing a file, and the automatic
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
const cars = computed(() => carRows(t.value, lib.value, currentCar.value))
const currentRow = computed<CarRow | null>(() => cars.value.find((c) => c.current) ?? null)
const otherCars = computed(() => cars.value.filter((c) => !c.current))
const links = computed(() => linkOptions(lib.value, locale.value))
const roomLeft = computed(() => canAddLayout(lib.value))
const notice = computed(() => (layoutNotice.value ? noticeText(t.value, layoutNotice.value) : null))

const newName = shallowRef('')
const canSave = computed(() => roomLeft.value && layoutName(newName.value) !== null)

function save(): void {
  if (!canSave.value) return
  cmd.save(newName.value)
  newName.value = ''
}

/** The row being renamed (null: none). */
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
// list's box (the box only, never the page: a notice under "Archivos" stays in view).
const listBox = useTemplateRef<HTMLElement>('listBox')
watch(
  () => ({ ids: lib.value.list.map((l) => l.id), activeId: lib.value.activeId }),
  async (next, prev) => {
    const id = rowToReveal(prev, next)
    if (id === null) return
    await nextTick()
    const box = listBox.value
    const row = box?.querySelector(`[data-layout-id="${CSS.escape(id)}"]`)
    if (!box || !(row instanceof HTMLElement)) return
    box.scrollTop += revealOffset(box.getBoundingClientRect(), row.getBoundingClientRect())
  }
)

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
        <p class="page-sub">{{ t.settings.layouts.sub }}</p>
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
          <div class="sort-by" :class="{ 'is-alone': !view.many }">
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
          <div v-if="view.pinned" class="pinned">
            <ul class="list" :aria-label="t.settings.layouts.inUse">
              <LayoutItem
                :row="view.pinned"
                :order="view.reorder ? 'space' : 'none'"
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

          <!-- Many layouts: a box of its own, about LAYOUT_LIST_ROWS rows tall (Tab, keys, wheel). -->
          <div
            ref="listBox"
            class="list-box"
            :class="{ 'is-scroll': view.many }"
            :tabindex="view.many ? 0 : undefined"
            :role="view.many ? 'region' : undefined"
            :aria-label="view.many ? t.settings.layouts.listTitle : undefined"
          >
            <ul
              v-if="view.rows.length > 0"
              class="list"
              :aria-label="view.many ? undefined : t.settings.layouts.listTitle"
            >
              <LayoutItem
                v-for="r in view.rows"
                :key="r.id"
                :row="r"
                :order="view.reorder ? 'move' : 'none'"
                :around-active="view.pinned !== null"
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
        </form>
      </PageSection>

      <PageSection :title="t.settings.layouts.autoTitle">
        <ToggleControl
          kind="switch"
          :label="t.settings.layouts.auto"
          :help="t.settings.layouts.autoHelp"
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

      <PageSection :title="t.settings.layouts.filesTitle">
        <div class="st-row st-row-wrap">
          <span class="st-help files-help">{{ t.settings.layouts.filesHelp }}</span>
          <button type="button" class="st-btn" :disabled="!roomLeft" @click="cmd.importOne()">
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

.find {
  display: flex;
  flex: 1 1 16em;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

/* The clear button sits inside the field, over its right end. */
.search-box {
  position: relative;
  display: flex;
  flex: 0 1 18em;
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

/* No search beside it: label left, choices right, as any option row. */
.sort-by.is-alone {
  flex: 1 1 auto;
  justify-content: space-between;
}

.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The pinned one stands apart from the rest: a stronger line, then the others. */
.pinned {
  border-bottom: 1px solid var(--st-border-hi);
}

.apart-note {
  padding: 0 0 8px 10px;
}

/*
 * About LAYOUT_LIST_ROWS rows (the pinned one above counts as one), then it scrolls. Pulled into
 * the card's right padding, so the thin scrollbar sits there and the rows keep the pinned one's
 * width (their buttons line up).
 */
.list-box.is-scroll {
  max-height: calc(7.5 * 53px);
  margin-right: -13px;
  padding-right: 2px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
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
</style>
