<script setup lang="ts">
import { computed, useId } from 'vue'
import { keycaps } from '@shared/i18n'
import { EXIT_EDIT_ACCELERATOR, MAX_BINDINGS } from '@shared/shortcuts'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { useShortcuts } from '../../composables/useShortcuts'
import HelpText from '../controls/HelpText.vue'
import { resetShortcuts } from '../undo/restore'
import Keycaps from '../layout/Keycaps.vue'
import PageFrame from '../layout/PageFrame.vue'
import ShortcutRow from '../layout/ShortcutRow.vue'
import { buttonBindingCount, shortcutRows } from '../shortcutsView'
import { useShortcutCapture, windowCaptureDeps } from '../useShortcutCapture'

/**
 * The global shortcuts (settings.shortcuts and settings.shortcutsMore) as a table, the controls
 * screen of a game: one row per action, one column per binding (Atajo 1 · 2 · 3, the first the
 * one older versions read), each cell recorded by pressing a combination or a controller's
 * button, Reset in a column of its own; the fixed Esc is a row like the others. Above it the one
 * note that matters in the sim (keys are exclusive), under it a legend of how a cell is used and
 * the rest, closed. Recording ends whenever this page goes away (the capture's scope is the
 * page's). No live preview: there is nothing to draw.
 */
const t = useI18n()
const titleId = useId()
const shortcuts = useShortcuts()
const { settings, shortcutStatus } = useOverlayState()
const capture = useShortcutCapture(windowCaptureDeps())

/** The controllers' names: the saved ones, and those of the buttons just pressed here. */
const names = computed(() => ({
  ...settings.value?.buttonDeviceNames,
  ...capture.pressedNames.value
}))
const rows = computed(() =>
  shortcutRows(t.value, capture.bindings.value, shortcutStatus.value, names.value)
)
const escapeCaps = computed(() => keycaps(t.value, EXIT_EDIT_ACCELERATOR))
const deleteCaps = computed(() => keycaps(t.value, 'Delete'))

/**
 * The reset removes every button and every extra binding (none is a default): its description
 * and confirmation say so for the buttons.
 */
const buttonCount = computed(() => buttonBindingCount(shortcuts.value))
const resetDescription = computed(() => {
  const r = t.value.settings.shortcuts.resetAll
  return buttonCount.value > 0 ? r.descriptionButtons(buttonCount.value) : r.description
})
</script>

<template>
  <PageFrame class="sc-page" :labelledby="titleId">
    <template #top>
      <header class="page-head">
        <h1 :id="titleId" class="page-title">{{ t.settings.nav.shortcuts }}</h1>
        <HelpText
          tag="p"
          class="page-sub"
          :text="t.settings.shortcuts.sub"
          :more="t.settings.shortcuts.subMore"
        />
      </header>
    </template>

    <!-- The one thing that can break something in iRacing: above the table. -->
    <div class="sc-exclusive">
      <b>{{ t.settings.shortcuts.exclusive.lead }}</b
      >{{ ' '
      }}<HelpText
        tag="span"
        :text="t.settings.shortcuts.exclusive.text"
        :more="t.settings.shortcuts.exclusive.more"
      />
    </div>

    <!-- One column per binding, as the controls screen of a game: Acción | 1 | 2 | 3 | ↺. -->
    <div class="sc-table" role="table" :aria-labelledby="titleId">
      <div class="sc-headrow" role="row">
        <span class="sc-h sc-h-action" role="columnheader">{{
          t.settings.shortcuts.columns.action
        }}</span>
        <span v-for="n in MAX_BINDINGS" :key="n" class="sc-h" role="columnheader"
          >{{ t.settings.shortcuts.columns.slot(n)
          }}<small v-if="n === 1" class="sc-h-primary">
            · {{ t.settings.shortcuts.columns.primary }}</small
          ></span
        >
      </div>
      <ShortcutRow
        v-for="row in rows"
        :key="row.action"
        :row="row"
        :capture="capture"
        :names="names"
      />
      <!-- Esc: a row like the others, its first cell fixed. -->
      <div class="sc-item sc-fixed" role="row">
        <div class="sc-act" role="rowheader">
          <span class="st-label">{{ t.settings.shortcuts.escape.label }}</span>
          <span class="st-help">{{ t.settings.shortcuts.escape.help }}</span>
        </div>
        <div class="sc-cell sc-cell-fixed" role="cell" data-slot="0" data-n="1">
          <Keycaps :keys="escapeCaps" />
          <span class="sc-fixed-tag">{{ t.settings.shortcuts.escape.tag }}</span>
        </div>
        <div class="sc-cell is-empty" role="cell" data-slot="1" data-n="2">
          <span aria-hidden="true">—</span>
        </div>
        <div class="sc-cell is-empty" role="cell" data-slot="2" data-n="3">
          <span aria-hidden="true">—</span>
        </div>
      </div>
    </div>

    <!-- How a cell is used, once for the whole table. -->
    <p class="sc-legend">
      {{ t.settings.shortcuts.legend.click }} · <Keycaps :keys="deleteCaps" />
      {{ t.settings.shortcuts.legend.clear }} · <Keycaps :keys="escapeCaps" />
      {{ t.settings.shortcuts.legend.esc }} · {{ t.settings.shortcuts.legend.any }}
    </p>

    <details class="sc-notes">
      <summary>
        <b>{{ t.settings.shortcuts.notes.title }}</b> ·
        {{ t.settings.shortcuts.notes.summary }}
      </summary>
      <HelpText
        tag="p"
        class="st-help note"
        :text="t.settings.shortcuts.notes.buttons"
        :more="t.settings.shortcuts.notes.buttonsMore"
      />
      <p class="st-help note">{{ t.settings.shortcuts.notes.buttonBox }}</p>
    </details>

    <footer class="page-foot">
      <!-- One click, then "Deshacer" in the toast (R11): the buttons come back with it. -->
      <button type="button" class="st-btn" :title="resetDescription" @click="resetShortcuts">
        {{ t.settings.shortcuts.resetAll.label }}
      </button>
    </footer>

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

/* A table, not running text: wider than the other pages (cells of about 200 px). */
.sc-page {
  --st-page-max: 960px;
}

/* A neutral note (not a warning): what keys do to iRacing. */
.sc-exclusive {
  margin-bottom: 12px;
  padding: 9px 12px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  color: var(--ov-fg-muted);
  font-size: 12.5px;
  line-height: 1.45;
}

.sc-exclusive b {
  color: var(--ov-fg);
}

.sc-table {
  container: sc / inline-size;
  padding: 4px 14px 2px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  box-shadow: var(--st-lit);
}

/* The column heads, in the small capitals of the section titles, over the cells. */
.sc-headrow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) 30px;
  gap: 8px;
  padding: 10px 0 8px;
}

.sc-h {
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
  white-space: nowrap;
}

.sc-h-action {
  display: none;
}

.sc-h-primary {
  font-size: 10px;
  font-weight: normal;
  letter-spacing: 0;
  text-transform: none;
}

@container sc (min-width: 600px) {
  .sc-headrow {
    grid-template-columns: minmax(170px, 1.15fr) repeat(3, minmax(0, 1fr)) 30px;
  }

  .sc-h-action {
    display: block;
  }
}

@container sc (max-width: 399px) {
  .sc-headrow {
    display: none;
  }
}

/* Esc: a fixed cell, its keys and "FIJO" inside, without a field's fill. */
.sc-cell-fixed {
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 8px;
  background: transparent;
}

.sc-fixed-tag {
  color: var(--ov-fg-dim);
  font-family: var(--ov-font-small);
  font-size: 11px;
  font-weight: var(--ov-w-strong);
  letter-spacing: var(--ov-track-caps);
  text-transform: uppercase;
}

.sc-legend {
  margin-top: 10px;
  color: var(--ov-fg-muted);
  font-size: 12px;
  line-height: 1.8;
}

.sc-notes {
  margin-top: 14px;
  padding: 10px 14px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
  color: var(--ov-fg-muted);
  font-size: 12.5px;
}

.sc-notes summary {
  cursor: pointer;
}

.sc-notes summary b {
  color: var(--ov-fg);
}

/* Prose in the block: the help colour, at reading size. */
.note {
  display: block;
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.5;
}

.page-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--st-border);
}
</style>

<!-- The table, its rows (ShortcutRow) and the fixed Esc row: one grid for all of them. -->
<style>
/*
 * The row's grid (the table, ShortcutsPage, is the container `sc`). A middle-sized table (the
 * window as it opens, 760 px...): the action and Reset on the first line, the three cells under
 * it in their three columns. A wide one: one line, Acción | 1 | 2 | 3 | ↺. A narrow one (zoom,
 * large fonts): one cell per line, numbered.
 */
.sc-table .sc-item {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) 30px;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--st-border);
}

.sc-table .sc-act {
  display: flex;
  flex-direction: column;
  grid-row: 1;
  grid-column: 1 / 4;
  gap: 2px;
  min-width: 0;
}

.sc-table .sc-cell[data-slot='0'] {
  grid-row: 2;
  grid-column: 1;
}

.sc-table .sc-cell[data-slot='1'] {
  grid-row: 2;
  grid-column: 2;
}

.sc-table .sc-cell[data-slot='2'] {
  grid-row: 2;
  grid-column: 3;
}

.sc-table .sc-reset-cell {
  display: flex;
  grid-row: 1;
  grid-column: 4;
  justify-content: center;
}

.sc-table .sc-msg.at-0 {
  grid-column: 1 / -1;
}

.sc-table .sc-msg.at-1 {
  grid-column: 2 / -1;
}

.sc-table .sc-msg.at-2 {
  grid-column: 3 / -1;
}

@container sc (min-width: 600px) {
  .sc-table .sc-item {
    grid-template-columns: minmax(170px, 1.15fr) repeat(3, minmax(0, 1fr)) 30px;
  }

  .sc-table .sc-act {
    grid-column: 1;
  }

  .sc-table .sc-cell[data-slot='0'] {
    grid-row: 1;
    grid-column: 2;
  }

  .sc-table .sc-cell[data-slot='1'] {
    grid-row: 1;
    grid-column: 3;
  }

  .sc-table .sc-cell[data-slot='2'] {
    grid-row: 1;
    grid-column: 4;
  }

  .sc-table .sc-reset-cell {
    grid-column: 5;
  }

  .sc-table .sc-msg.at-0 {
    grid-column: 2 / -1;
  }

  .sc-table .sc-msg.at-1 {
    grid-column: 3 / -1;
  }

  .sc-table .sc-msg.at-2 {
    grid-column: 4 / -1;
  }
}

/* Narrow: one cell per line, numbered, each message right under its cell. */
@container sc (max-width: 399px) {
  .sc-table .sc-item {
    grid-template-columns: minmax(0, 1fr) 30px;
    padding-left: 16px;
  }

  .sc-table .sc-act {
    grid-column: 1;
  }

  .sc-table .sc-reset-cell {
    grid-column: 2;
  }

  .sc-table .sc-item > .sc-cell,
  .sc-table .sc-item > .sc-msg {
    grid-row: auto;
    grid-column: 1 / -1;
  }

  .sc-table .sc-cell[data-slot='0'] {
    order: 1;
  }

  .sc-table .sc-msg.at-0 {
    order: 2;
  }

  .sc-table .sc-cell[data-slot='1'] {
    order: 3;
  }

  .sc-table .sc-msg.at-1 {
    order: 4;
  }

  .sc-table .sc-cell[data-slot='2'] {
    order: 5;
  }

  .sc-table .sc-msg.at-2 {
    order: 6;
  }

  .sc-table .sc-cell::before {
    content: attr(data-n);
    position: absolute;
    top: 50%;
    left: -14px;
    color: var(--ov-fg-dim);
    font-size: 11px;
    transform: translateY(-50%);
  }
}

/* A cell: the same well as a field, one height whatever it holds. */
.sc-table .sc-cell {
  position: relative;
  display: flex;
  min-width: 0;
  height: 42px;
  border: 1px solid var(--st-border-hi);
  border-radius: var(--st-radius-sm);
  background: var(--st-field);
}

.sc-table .sc-cell-main {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 0;
  padding: 0 8px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sc-table .sc-cell-main:hover {
  background: var(--st-hover);
}

.sc-table .sc-lines {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.sc-table .sc-keys {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* A combination stays on one line in its cell. */
.sc-table .sc-cell .caps {
  flex-wrap: nowrap;
}

/* The middle-sized table (cells of about 135 px): compact keys, so Ctrl Shift H still fits. */
@container sc (max-width: 599px) {
  .sc-table .sc-cell .cap {
    min-width: 1.6em;
    padding: 1px 4px;
    font-size: 11.5px;
  }

  .sc-table .sc-cell .caps {
    gap: 3px;
  }

  .sc-table .sc-cell-main {
    padding: 0 6px;
  }
}

/* The × to empty it: on hover or focus, over the end of the cell. */
.sc-table .sc-x {
  position: absolute;
  top: 50%;
  right: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: var(--st-radius-sm);
  background: var(--st-field);
  color: var(--ov-fg-dim);
  font-size: 12px;
  opacity: 0;
  transform: translateY(-50%);
  cursor: pointer;
}

.sc-table .sc-cell:hover .sc-x,
.sc-table .sc-cell:focus-within .sc-x {
  opacity: 1;
}

.sc-table .sc-x:hover {
  background: var(--st-hover);
  color: var(--ov-fg);
}

/* A controller's button: the wheel glyph, the button, and its controller under it. */
.sc-table .sc-button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-right: 18px;
  font-size: 12.5px;
}

.sc-table .sc-button-icon {
  flex: none;
  color: var(--ov-fg-muted);
  font-size: 14px;
}

.sc-table .sc-button-name {
  color: var(--ov-fg);
  font-family: var(--ov-font-num);
  font-weight: var(--ov-w-strong);
  white-space: nowrap;
}

/* The second line: the controller (cut; its full name is the cell's title) or a warning. */
.sc-table .sc-sub,
.sc-table .sc-tag {
  min-width: 0;
  overflow: hidden;
  color: var(--ov-fg-muted);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sc-table .sc-tag .ov-icon {
  margin-right: 4px;
  vertical-align: -1px;
}

.sc-table .sc-tag-warn,
.sc-table .sc-warn-icon {
  color: var(--ov-warn);
}

.sc-table .sc-warn-icon {
  font-size: 13px;
}

/* Not working (unplugged, or held by another application): kept, dimmed, outlined in warning. */
.sc-table .sc-cell.is-off,
.sc-table .sc-cell.is-warned {
  border-color: color-mix(in srgb, var(--ov-warn) 60%, transparent);
}

.sc-table .sc-cell.is-off .sc-button-name,
.sc-table .sc-cell.is-off .sc-button-icon,
.sc-table .sc-cell.is-off .cap {
  color: var(--ov-fg-dim);
}

/* Recording: dashed in the focus colour (red while the last press was refused). */
.sc-table .sc-cell.is-recording {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--st-focus) 70%, transparent);
  background: color-mix(in srgb, var(--st-focus) 8%, var(--st-field));
}

.sc-table .sc-cell.is-refused {
  border-color: var(--ov-danger);
}

.sc-table .sc-prompt {
  color: var(--ov-fg);
  font-size: 12.5px;
  font-weight: var(--ov-w-strong);
}

.sc-table .sc-prompt-short {
  display: none;
}

/* A cell under about 160 px: the short prompt. */
@container sc (max-width: 719px) {
  .sc-table .sc-prompt-long {
    display: none;
  }

  .sc-table .sc-prompt-short {
    display: inline;
  }
}

/* Empty: dashed; the first one assigns, the next ones only hold their column. */
.sc-table .sc-cell.is-assign,
.sc-table .sc-cell.is-empty {
  border-style: dashed;
  background: transparent;
}

.sc-table .sc-cell.is-empty {
  align-items: center;
  justify-content: center;
  border-color: var(--st-border);
}

.sc-table .sc-empty {
  color: var(--ov-fg-dim);
}

.sc-table .sc-cell.is-assign .sc-cell-main {
  justify-content: center;
}

.sc-table .sc-assign {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ov-fg-muted);
  font-size: 12.5px;
}

/* Saved: a short flash of the border (none with reduced motion). */
@media (prefers-reduced-motion: no-preference) {
  .sc-table .sc-cell.is-flash {
    animation: sc-flash 600ms ease-out;
  }
}

@keyframes sc-flash {
  from {
    border-color: var(--st-focus);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--st-focus) 35%, transparent);
  }
}

/* Reset: an icon, in its own column. */
.sc-table .sc-reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--st-radius-sm);
  background: transparent;
  color: var(--ov-fg-muted);
  font-size: 14px;
  cursor: pointer;
}

.sc-table .sc-reset:hover:not(:disabled) {
  background: var(--st-hover);
  color: var(--ov-fg);
}

.sc-table .sc-reset:disabled {
  opacity: 0.4;
  cursor: default;
}

/* A sentence about a cell, from its column, pointing up at it. */
.sc-table .sc-msg {
  margin-top: -2px;
  color: var(--ov-fg-muted);
  font-size: 12px;
  line-height: 1.4;
}

.sc-table .sc-msg.is-warn {
  color: var(--ov-warn);
}

.sc-table .sc-msg.is-error {
  color: var(--ov-danger);
}

.sc-table .sc-msg-mark {
  margin-right: 5px;
  font-size: 9px;
}
</style>
