<script setup lang="ts">
import { nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { MAX_LAYOUT_NAME, layoutName } from '@shared/layouts'
import type { LayoutMode } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import ConfirmButton from '../layout/ConfirmButton.vue'
import { layoutCommands as cmd, type LayoutRow } from '../layoutsView'
import LayoutModeChoice from './LayoutModeChoice.vue'

/**
 * One saved layout of LayoutsPage: its order chevrons, name, what it restores and linked cars (or
 * the edit form: name and mode), and its actions. The page says which row is being edited (one
 * at a time).
 */
const props = defineProps<{
  row: LayoutRow
  /**
   * 'move': the chevrons; 'space': their room kept empty (the pinned row, another order, a
   * search), so the names never shift sideways as you type or change the order.
   */
  order: 'move' | 'space'
  /** The one in use is pinned apart: a move skips it (moveLayout aroundActive). */
  aroundActive: boolean
  roomLeft: boolean
  renaming: boolean
}>()

const emit = defineEmits<{ rename: [open: boolean] }>()

const t = useI18n()
const inputId = useId()
const modeId = useId()
const tagId = useId()
const input = useTemplateRef<HTMLInputElement>('input')
const draft = shallowRef('')
const draftMode = shallowRef<LayoutMode>('full')

watch(
  () => props.renaming,
  async (open) => {
    if (!open) return
    draft.value = props.row.name
    draftMode.value = props.row.mode
    await nextTick()
    input.value?.focus()
    input.value?.select()
  }
)

function commit(): void {
  if (!props.renaming) return
  if (layoutName(draft.value) !== null && draft.value !== props.row.name) {
    cmd.rename(props.row.id, draft.value)
  }
  if (draftMode.value !== props.row.mode) cmd.setMode(props.row.id, draftMode.value)
  emit('rename', false)
}

function remove(): void {
  cmd.remove(props.row.id)
}
</script>

<template>
  <li class="item" :class="{ 'is-active': row.active }" :data-layout-id="row.id">
    <div v-if="order === 'move'" class="order">
      <button
        type="button"
        class="st-btn st-btn-ghost st-btn-icon"
        :disabled="!row.canMoveUp"
        :aria-label="t.settings.layouts.moveUp(row.name)"
        :title="t.settings.layouts.moveUp(row.name)"
        @click="cmd.move(row.id, -1, aroundActive)"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M4 10l4-4 4 4" class="chev" />
        </svg>
      </button>
      <button
        type="button"
        class="st-btn st-btn-ghost st-btn-icon"
        :disabled="!row.canMoveDown"
        :aria-label="t.settings.layouts.moveDown(row.name)"
        :title="t.settings.layouts.moveDown(row.name)"
        @click="cmd.move(row.id, 1, aroundActive)"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M4 6l4 4 4-4" class="chev" />
        </svg>
      </button>
    </div>
    <!-- Nothing to move here: the room kept, the name lines up with the others'. -->
    <div v-else class="order order-space" aria-hidden="true" />

    <form
      v-if="renaming"
      class="rename"
      @submit.prevent="commit"
      @keydown.esc.stop="emit('rename', false)"
    >
      <div class="rename-line">
        <!-- Still the one in use while it is edited: the tag stays. -->
        <span v-if="row.active" :id="tagId" class="tag">{{ t.settings.layouts.inUse }}</span>
        <label :for="inputId" class="st-sr-only">{{ t.settings.layouts.nameLabel }}</label>
        <input
          :id="inputId"
          ref="input"
          v-model="draft"
          :aria-describedby="row.active ? tagId : undefined"
          type="text"
          class="st-field name-field"
          :maxlength="MAX_LAYOUT_NAME"
          autocomplete="off"
          spellcheck="false"
        />
        <button type="submit" class="st-btn st-btn-sm">
          {{ t.settings.layouts.saveName }}
        </button>
        <button type="button" class="st-btn st-btn-sm st-btn-ghost" @click="emit('rename', false)">
          {{ t.settings.layouts.cancel }}
        </button>
      </div>
      <div class="rename-line">
        <span :id="modeId" class="st-label">{{ t.settings.layouts.modeLabel }}</span>
        <LayoutModeChoice v-model="draftMode" :labelledby="modeId" />
        <span class="st-help">{{ t.settings.layouts.modeHints[draftMode] }}</span>
      </div>
      <p v-if="row.mode === 'full' && draftMode === 'position'" class="st-help st-help-warn">
        {{ row.active ? t.settings.layouts.dropOptionsActive : t.settings.layouts.dropOptions }}
      </p>
    </form>
    <div v-else class="st-row-text">
      <span class="st-label name" :title="row.name">
        <span v-if="row.active" class="tag">{{ t.settings.layouts.inUse }}</span>
        {{ row.name }}
      </span>
      <span class="st-help meta" :title="row.cars || undefined">
        {{ t.settings.layouts.modes[row.mode]
        }}<template v-if="row.cars"> · {{ row.cars }}</template>
      </span>
    </div>

    <div v-if="!renaming" class="actions">
      <!-- The one in use keeps an invisible Aplicar: its buttons line up with the others'. -->
      <button
        type="button"
        class="st-btn st-btn-sm"
        :class="{ 'is-placeholder': row.active }"
        :disabled="row.active"
        :aria-hidden="row.active ? 'true' : undefined"
        :aria-label="t.settings.layouts.applyLabel(row.name)"
        @click="cmd.apply(row.id)"
      >
        {{ t.settings.layouts.apply }}
      </button>
      <button
        type="button"
        class="st-btn st-btn-sm st-btn-ghost"
        :aria-label="t.settings.layouts.editLabel(row.name)"
        @click="emit('rename', true)"
      >
        {{ t.settings.layouts.edit }}
      </button>
      <button
        type="button"
        class="st-btn st-btn-sm st-btn-ghost"
        :disabled="!roomLeft"
        :aria-label="t.settings.layouts.duplicateLabel(row.name)"
        @click="cmd.duplicate(row.id, t.settings.layouts.copyName(row.name))"
      >
        {{ t.settings.layouts.duplicate }}
      </button>
      <button
        type="button"
        class="st-btn st-btn-sm st-btn-ghost"
        :aria-label="t.settings.layouts.exportLabel(row.name)"
        @click="cmd.exportOne(row.id)"
      >
        {{ t.settings.layouts.export }}
      </button>
      <ConfirmButton
        v-if="row.canDelete"
        small
        :label="t.settings.layouts.delete.label"
        :confirm-label="t.settings.layouts.delete.confirm"
        :description="t.settings.layouts.delete.description(row.name)"
        :action="remove"
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
</template>

<style scoped>
.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  min-height: 52px;
  padding: 8px 0 8px 10px;
}

.item + .item {
  border-top: 1px solid var(--st-border);
}

/* The one in use: the EN USO tag and a slightly lighter row; no coloured edge. */
.item.is-active {
  border-radius: 6px;
  background: var(--st-surface-hi);
}

.is-placeholder {
  visibility: hidden;
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

.order-space {
  width: 22px;
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
.meta {
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
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding-right: 8px;
}

.rename-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.name-field {
  flex: 1 1 12em;
  min-width: 0;
}
</style>
