<script setup lang="ts">
import { computed, nextTick, shallowRef, useId } from 'vue'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { MAX_LAYOUTS, MAX_LAYOUT_NAME, canAddLayout, layoutName } from '@shared/layouts'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useOptions } from '../../composables/useWidgetSettings'
import ToggleControl from '../controls/ToggleControl.vue'
import { optionSetter } from '../editor'
import ConfirmButton from '../layout/ConfirmButton.vue'
import PageFrame from '../layout/PageFrame.vue'
import PageSection from '../layout/PageSection.vue'
import {
  carRows,
  layoutCommands as cmd,
  layoutRows,
  noticeText,
  useLayoutState,
  type CarRow
} from '../layoutsView'

/**
 * The saved layouts (settings.savedLayouts): the list (apply, rename, duplicate, order, export,
 * delete), saving the widgets as they are under a new name, importing a file, and the automatic
 * switch with its car links (settings.layouts.autoSwitch). Main runs every command and
 * broadcasts the settings; this page only shows them.
 */
const t = useI18n()
const titleId = useId()
const saveId = useId()
const { settings } = useOverlayState()
const { currentCar, layoutNotice } = useLayoutState()
const options = useOptions('layouts')
const setAutoSwitch = optionSetter('layouts')('autoSwitch')

const lib = computed(() => settings.value?.savedLayouts ?? DEFAULT_SETTINGS.savedLayouts)
const rows = computed(() => layoutRows(t.value, lib.value))
const cars = computed(() => carRows(t.value, lib.value, currentCar.value))
const currentRow = computed<CarRow | null>(() => cars.value.find((c) => c.current) ?? null)
const otherCars = computed(() => cars.value.filter((c) => !c.current))
const roomLeft = computed(() => canAddLayout(lib.value))
const notice = computed(() => (layoutNotice.value ? noticeText(t.value, layoutNotice.value) : null))

const newName = shallowRef('')
const canSave = computed(() => roomLeft.value && layoutName(newName.value) !== null)

function save(): void {
  if (!canSave.value) return
  cmd.save(newName.value)
  newName.value = ''
}

/** The row being renamed (null: none) and its draft name. */
const renaming = shallowRef<string | null>(null)
const renameDraft = shallowRef('')

async function startRename(id: string, name: string): Promise<void> {
  renaming.value = id
  renameDraft.value = name
  await nextTick()
  const input = document.getElementById(`st-layout-rename-${id}`)
  if (input instanceof HTMLInputElement) {
    input.focus()
    input.select()
  }
}

function commitRename(id: string): void {
  if (renaming.value !== id) return
  if (layoutName(renameDraft.value) !== null) cmd.rename(id, renameDraft.value)
  renaming.value = null
}

function cancelRename(): void {
  renaming.value = null
}

function onLink(car: CarRow, e: Event): void {
  const v = e.target instanceof HTMLSelectElement ? e.target.value : ''
  cmd.link(car.car, v === '' ? null : v)
}

/** A delete button's confirmed action. */
function removeAction(id: string): () => void {
  return () => cmd.remove(id)
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
        <ul class="list" :aria-label="t.settings.layouts.listTitle">
          <li v-for="r in rows" :key="r.id" class="item" :class="{ 'is-active': r.active }">
            <div class="order">
              <button
                type="button"
                class="st-btn st-btn-ghost st-btn-icon"
                :disabled="!r.canMoveUp"
                :aria-label="t.settings.layouts.moveUp(r.name)"
                :title="t.settings.layouts.moveUp(r.name)"
                @click="cmd.move(r.id, -1)"
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M4 10l4-4 4 4" class="chev" />
                </svg>
              </button>
              <button
                type="button"
                class="st-btn st-btn-ghost st-btn-icon"
                :disabled="!r.canMoveDown"
                :aria-label="t.settings.layouts.moveDown(r.name)"
                :title="t.settings.layouts.moveDown(r.name)"
                @click="cmd.move(r.id, 1)"
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M4 6l4 4 4-4" class="chev" />
                </svg>
              </button>
            </div>

            <form
              v-if="renaming === r.id"
              class="rename"
              @submit.prevent="commitRename(r.id)"
              @keydown.esc.stop="cancelRename"
            >
              <label :for="`st-layout-rename-${r.id}`" class="st-sr-only">{{
                t.settings.layouts.nameLabel
              }}</label>
              <input
                :id="`st-layout-rename-${r.id}`"
                v-model="renameDraft"
                type="text"
                class="st-field name-field"
                :maxlength="MAX_LAYOUT_NAME"
                autocomplete="off"
                spellcheck="false"
              />
              <button type="submit" class="st-btn st-btn-sm">
                {{ t.settings.layouts.saveName }}
              </button>
              <button type="button" class="st-btn st-btn-sm st-btn-ghost" @click="cancelRename">
                {{ t.settings.layouts.cancel }}
              </button>
            </form>
            <div v-else class="st-row-text">
              <span class="st-label name">
                <span v-if="r.active" class="tag">{{ t.settings.layouts.inUse }}</span>
                {{ r.name }}
              </span>
              <span v-if="r.cars" class="st-help cars">{{ r.cars }}</span>
            </div>

            <div v-if="renaming !== r.id" class="actions">
              <button
                v-if="!r.active"
                type="button"
                class="st-btn st-btn-sm"
                :aria-label="t.settings.layouts.applyLabel(r.name)"
                @click="cmd.apply(r.id)"
              >
                {{ t.settings.layouts.apply }}
              </button>
              <button
                type="button"
                class="st-btn st-btn-sm st-btn-ghost"
                :aria-label="t.settings.layouts.renameLabel(r.name)"
                @click="startRename(r.id, r.name)"
              >
                {{ t.settings.layouts.rename }}
              </button>
              <button
                type="button"
                class="st-btn st-btn-sm st-btn-ghost"
                :disabled="!roomLeft"
                :aria-label="t.settings.layouts.duplicateLabel(r.name)"
                @click="cmd.duplicate(r.id, t.settings.layouts.copyName(r.name))"
              >
                {{ t.settings.layouts.duplicate }}
              </button>
              <button
                type="button"
                class="st-btn st-btn-sm st-btn-ghost"
                :aria-label="t.settings.layouts.exportLabel(r.name)"
                @click="cmd.exportOne(r.id)"
              >
                {{ t.settings.layouts.export }}
              </button>
              <ConfirmButton
                v-if="r.canDelete"
                small
                :label="t.settings.layouts.delete.label"
                :confirm-label="t.settings.layouts.delete.confirm"
                :description="t.settings.layouts.delete.description(r.name)"
                :action="removeAction(r.id)"
              />
              <button
                v-else
                type="button"
                class="st-btn st-btn-sm"
                disabled
                :title="t.settings.layouts.deleteActive"
              >
                {{ t.settings.layouts.delete.label }}
              </button>
            </div>
          </li>
        </ul>
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
            <option v-for="l in lib.list" :key="l.id" :value="l.id">{{ l.name }}</option>
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
                <option v-for="l in lib.list" :key="l.id" :value="l.id">{{ l.name }}</option>
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

.list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  min-height: 52px;
  padding: 8px 0;
}

.item + .item {
  border-top: 1px solid var(--st-border);
}

/* The one in use: the accent rail, as your own row in the widgets. */
.item.is-active {
  padding-left: 10px;
  box-shadow: inset var(--ov-bar-w) 0 0 var(--ov-accent);
}

.order {
  display: flex;
  flex: none;
  flex-direction: column;
}

.order .st-btn-icon {
  width: 22px;
  min-height: 18px;
}

.chev {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.st-row-text {
  flex: 1 1 10em;
  min-width: 0;
}

.name,
.cars {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: var(--ov-radius-chip);
  background: var(--ov-accent);
  color: var(--ov-accent-fg);
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-solid);
  letter-spacing: var(--ov-track-tag);
  text-transform: uppercase;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.rename {
  display: flex;
  flex: 1 1 14em;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.name-field {
  flex: 1 1 12em;
  min-width: 0;
}

.save {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
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
