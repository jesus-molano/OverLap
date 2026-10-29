<script setup lang="ts">
/**
 * The settings window's "Deshacer" toast (undo.ts): «SoF» oculto · Deshacer, at the foot of the
 * page for a few seconds after an element is hidden (a click in the live sample, its eye in the
 * list) or moved in the sample. The pointer over it or the focus in it holds it; Ctrl+Z undoes
 * while it is shown (never in a text field: there it is the field's own undo). It goes away by
 * itself, by its ×, when a newer action replaces it, or when there is nothing left to undo.
 *
 * Screen readers hear the change once, from the region below, with the shortcut; the toast's
 * buttons sit in a named group, reachable with Tab, and the focus goes back where it was when
 * the toast closes under it.
 */
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { UNDO_MS, isTextTarget, isUndoKey, undoSlot, undoneList, type HoldReason } from './undo'

const t = useI18n()
const slot = undoSlot
const detach = slot.attach()

const shown = slot.shown
const text = computed(() => {
  const s = shown.value
  if (s === null) return ''
  const u = t.value.settings.elements.undo
  return s.offer.kind === 'hide' ? u.hidden(s.offer.label) : u.moved(s.offer.label)
})

/** Nothing left to undo (shown again, reordered since): the offer goes. */
const stale = computed(() => {
  const s = shown.value
  return s !== null && undoneList(s.offer, s.offer.current()) === null
})
watch(stale, (v) => {
  if (v) close()
})

// The announcement: emptied first, so the same words twice are read twice.
const live = shallowRef('')
watch(
  () => shown.value?.seq,
  async (seq) => {
    live.value = ''
    if (seq === undefined) return
    await nextTick()
    if (shown.value?.seq === seq)
      live.value = `${text.value}. ${t.value.settings.elements.undo.keyHint}`
  }
)

const card = useTemplateRef<HTMLElement>('card')
/** Where the focus came from into the toast: it goes back there when the toast closes. */
let returnTo: HTMLElement | null = null

function focusInside(): boolean {
  const el = card.value
  return el !== null && el.contains(document.activeElement)
}

function restoreFocus(had: boolean): void {
  const back = returnTo
  returnTo = null
  if (had && back !== null && back.isConnected) back.focus()
}

function close(): void {
  const had = focusInside()
  slot.dismiss()
  restoreFocus(had)
}

function undo(): void {
  const had = focusInside()
  slot.undo()
  restoreFocus(had)
}

function hold(reason: HoldReason): void {
  slot.hold(reason)
}
function release(reason: HoldReason): void {
  slot.release(reason)
}

function onFocusIn(e: FocusEvent): void {
  const from = e.relatedTarget
  if (from instanceof HTMLElement && !(card.value?.contains(from) ?? false)) returnTo = from
  hold('focus')
}
function onFocusOut(e: FocusEvent): void {
  const to = e.relatedTarget
  if (to instanceof Node && (card.value?.contains(to) ?? false)) return
  release('focus')
}

function onKey(e: KeyboardEvent): void {
  if (shown.value === null || e.defaultPrevented || e.repeat || !isUndoKey(e)) return
  if (isTextTarget(e.target)) return
  e.preventDefault()
  undo()
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  detach()
})

watch(
  () => shown.value?.seq,
  () => {
    // A new toast (or none): the old one's focus bookkeeping is over.
    if (!focusInside()) returnTo = null
  }
)
</script>

<template>
  <div class="undo-dock">
    <p class="st-sr-only" role="status" aria-live="polite" aria-atomic="true">{{ live }}</p>
    <Transition name="undo">
      <div
        v-if="shown"
        :key="shown.seq"
        ref="card"
        class="undo"
        :class="{ 'is-held': slot.held.value }"
        role="group"
        :aria-label="t.settings.elements.undo.group"
        :style="{ '--undo-ms': `${UNDO_MS}ms` }"
        @pointerenter="hold('hover')"
        @pointerleave="release('hover')"
        @focusin="onFocusIn"
        @focusout="onFocusOut"
        @keydown.esc.stop="close"
      >
        <span class="undo-text">{{ text }}</span>
        <button
          type="button"
          class="st-btn st-btn-sm undo-btn"
          aria-keyshortcuts="Control+Z"
          @click="undo"
        >
          {{ t.settings.elements.undo.action }}
          <kbd class="undo-kbd" aria-hidden="true">Ctrl Z</kbd>
        </button>
        <button
          type="button"
          class="st-btn st-btn-ghost st-btn-icon undo-close"
          :aria-label="t.settings.elements.undo.dismiss"
          :title="t.settings.elements.undo.dismiss"
          @click="close"
        >
          <span aria-hidden="true">×</span>
        </button>
        <span class="undo-bar" aria-hidden="true" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Over the foot of the page column, centred on it; only the card itself takes the pointer. */
.undo-dock {
  position: absolute;
  right: 0;
  bottom: 18px;
  left: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  padding-inline: 16px;
  pointer-events: none;
}

.undo {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  min-height: 44px;
  padding: 6px 6px 6px 14px;
  overflow: hidden;
  border: 1px solid var(--st-border-strong);
  border-radius: var(--st-radius);
  background: var(--st-surface-hi);
  /* Raised off the page with 0-blur edges only (ui/styleBudget.test.ts). */
  box-shadow:
    var(--st-lit),
    0 0 0 1px rgba(0, 0, 0, 0.55),
    0 3px 0 rgba(0, 0, 0, 0.45);
  color: var(--ov-fg);
  font-size: 13px;
  pointer-events: auto;
}

.undo-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.undo-btn {
  flex: none;
  font-weight: var(--ov-w-strong);
}

.undo-kbd {
  padding: 0 4px;
  border-bottom-width: 1px;
  color: var(--ov-fg-muted);
  font-size: 10px;
  font-weight: normal;
}

.undo-close {
  flex: none;
  font-size: 17px;
  line-height: 1;
}

/* The time left: a hairline along the foot that runs out, and stops while the toast is held. */
.undo-bar {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--ov-fg-dim);
  transform-origin: left center;
  animation: undo-run var(--undo-ms) linear forwards;
}

.undo.is-held .undo-bar {
  animation-play-state: paused;
}

@keyframes undo-run {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}

.undo-enter-active,
.undo-leave-active {
  transition:
    opacity 120ms ease-out,
    transform 120ms ease-out;
}

.undo-enter-from,
.undo-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* A replaced toast fades where it was, under the new one. */
.undo-leave-active {
  position: absolute;
}

/* A narrow window: no shortcut on the button (the toast keeps to one line). */
@media (max-width: 479px) {
  .undo-kbd {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .undo-enter-active,
  .undo-leave-active {
    transition: none;
  }

  .undo-enter-from,
  .undo-leave-to {
    transform: none;
  }

  .undo-bar {
    display: none;
  }
}
</style>
