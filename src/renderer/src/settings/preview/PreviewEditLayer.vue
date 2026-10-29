<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useId, watch, watchEffect } from 'vue'
import type { CustomizeZoneId } from '@shared/types'
import { useI18n } from '../../composables/useI18n'
import type { InlineStyle } from '../../view/styles'
import type { Side } from '../elements/listOps'
import {
  GHOST_ZONES,
  canDrag,
  dropInBar,
  dropInLine,
  droppedList,
  elAction,
  isDragDistance,
  marksCss,
  pickEl,
  sameEl,
  union,
  type BarBoxes,
  type Box,
  type Drop,
  type ElAction,
  type ElRef,
  type Slot
} from './previewEdit'
import { injectPreviewEdit, type ZoneHandle } from './usePreviewEdit'

/**
 * The pointer side of editing in the sample (usePreviewEdit.ts): listeners on the sample's root
 * (one set, by delegation: what is under the pointer is the nearest `data-el` of a zone with an
 * editor), the outline of the hovered element with its name and what a click or a drag does,
 * the drop line of a drag, and a short note when the rules refuse something. The outlines and
 * the ghosts are one stylesheet over the sample (marksCss), so nothing in the widget is queried
 * or touched while you point; a drag measures its zone once, when it starts.
 *
 * A press that does not travel is a click: it shows or hides the element (a ghost is shown
 * where it is drawn). One that travels is a drag: the element lands before or after its
 * neighbours (an info bar: on the side the pointer is on), through the zone's editor, so the
 * patch, the rules and the announcement are the list's own. Either opens the zone's accordion.
 * Escape cancels a drag.
 */
const props = defineProps<{
  /** The sample's root (the widget is drawn inside it). */
  sample: HTMLElement | null
  /** The stage: what the layer is positioned in. */
  stage: HTMLElement | null
}>()

const pe = injectPreviewEdit()
const t = useI18n()
const scope = `pe${useId().replace(/[^a-zA-Z0-9]/g, '')}`
const scopeSel = `[data-pe="${scope}"]`

/** The name and what the pointer does, over the element. */
interface Tip {
  readonly style: InlineStyle
  readonly below: boolean
  readonly title: string
  readonly text: string
}
const tip = shallowRef<Tip | null>(null)
const lineStyle = shallowRef<InlineStyle | null>(null)
const note = shallowRef<string | null>(null)
let noteTimer: ReturnType<typeof setTimeout> | undefined

function say(text: string): void {
  clearTimeout(noteTimer)
  note.value = text
  noteTimer = setTimeout(() => (note.value = null), 2600)
}

// ---- The stylesheet: outlines, light, ghosts ----------------------------------------------

let sheet: HTMLStyleElement | null = null
onMounted(() => {
  sheet = document.createElement('style')
  sheet.dataset.previewEdit = scope
  document.head.appendChild(sheet)
})
watchEffect(() => {
  if (pe === null) return
  const css = marksCss(scopeSel, {
    hover: pe.dragged.value === null ? pe.hover.value : null,
    lit: pe.dragged.value === null ? pe.lit.value : null,
    dragged: pe.dragged.value,
    ghosts: pe.ghosts.value
  })
  if (sheet !== null && sheet.textContent !== css) sheet.textContent = css
})

// ---- Hit-testing ---------------------------------------------------------------------------

interface Hit {
  readonly el: ElRef
  readonly node: Element
  readonly handle: ZoneHandle
}

function hitAt(target: EventTarget | null): Hit | null {
  const root = props.sample
  if (pe === null || root === null || !(target instanceof Element)) return null
  const zones = pe.zones.value
  const nodes: Element[] = []
  let n = target.closest('[data-el]')
  while (n !== null && root.contains(n)) {
    nodes.push(n)
    n = n.parentElement?.closest('[data-el]') ?? null
  }
  const el = pickEl(
    nodes.map((x) => x.getAttribute('data-el')),
    (z) => zones.has(z)
  )
  if (el === null) return null
  const node = nodes.find((x) => x.getAttribute('data-el') === `${el.zone}.${el.id}`) ?? target
  const handle = zones.get(el.zone)
  return handle === undefined ? null : { el, node, handle }
}

const actionOf = (h: Hit): ElAction => elAction(h.handle.spec, h.handle.list(), h.el.id)

// ---- Positions (client px to the stage's) --------------------------------------------------

function stageBox(): DOMRect | null {
  return props.stage?.getBoundingClientRect() ?? null
}

const TIP_HALF_W = 120

function tipFor(box: Box, title: string, text: string): Tip | null {
  const s = stageBox()
  if (s === null) return null
  const below = box.top - s.top < 46
  const x = Math.min(
    Math.max((box.left + box.right) / 2 - s.left, TIP_HALF_W),
    Math.max(TIP_HALF_W, s.width - TIP_HALF_W)
  )
  const y = below ? box.bottom - s.top + 6 : box.top - s.top - 6
  return { style: { left: `${x}px`, top: `${y}px` }, below, title, text }
}

function showTip(h: Hit): void {
  const r = h.node.getBoundingClientRect()
  const action = actionOf(h)
  tip.value = tipFor(r, h.handle.label(h.el.id), t.value.settings.preview.actions[action])
}

function lineFor(line: Box): InlineStyle | null {
  const s = stageBox()
  if (s === null) return null
  return {
    left: `${line.left - s.left}px`,
    top: `${line.top - s.top}px`,
    width: `${Math.max(2, line.right - line.left)}px`,
    height: `${Math.max(2, line.bottom - line.top)}px`
  }
}

// ---- Pointer ---------------------------------------------------------------------------------

interface Press {
  readonly pointerId: number
  readonly hit: Hit
  readonly x: number
  readonly y: number
  readonly action: ElAction
  /** Set once it travelled: a drag (or a refused one, for a fixed order). */
  moving: boolean
  slots: Slot[]
  bar: BarBoxes | null
  drop: Drop | null
}
let press: Press | null = null
let lastTarget: EventTarget | null = null

function setHover(next: Hit | null): void {
  if (pe === null) return
  if (!sameEl(pe.hover.value, next?.el ?? null)) pe.hover.value = next?.el ?? null
  if (next === null) tip.value = null
  else showTip(next)
  setCursor(next === null ? '' : canDrag(actionOf(next)) ? 'grab' : 'pointer')
}

function setCursor(c: string): void {
  const root = props.sample
  if (root !== null && root.style.cursor !== c) root.style.cursor = c
}

/** Every element of `zone` as drawn now, and an info bar's boxes: once per drag. */
function measure(zone: CustomizeZoneId, split: boolean): { slots: Slot[]; bar: BarBoxes | null } {
  const root = props.sample
  if (root === null) return { slots: [], bar: null }
  const byId = new Map<string, { boxes: Box[]; side?: Side }>()
  for (const node of root.querySelectorAll(`[data-el^="${zone}."]`)) {
    const id = (node.getAttribute('data-el') ?? '').slice(zone.length + 1)
    if (id === '' || id.includes('.')) continue
    const r = node.getBoundingClientRect()
    if (r.width <= 0 && r.height <= 0) continue
    const side = node.closest('[data-side]')?.getAttribute('data-side')
    const entry = byId.get(id) ?? { boxes: [], side: side === 'right' ? 'right' : 'left' }
    entry.boxes.push(r)
    byId.set(id, entry)
  }
  const slots: Slot[] = []
  for (const [id, e] of byId) {
    const box = union(e.boxes)
    if (box !== null) slots.push(split ? { id, box, side: e.side } : { id, box })
  }
  if (!split) return { slots, bar: null }
  const barEl = root.querySelector(`[data-zone="${zone}"]`)
  if (barEl === null) return { slots, bar: null }
  const group = (side: Side): Box | null => {
    const g = barEl.querySelector(`[data-side="${side}"]`)
    return g === null ? null : g.getBoundingClientRect()
  }
  return {
    slots,
    bar: { bar: barEl.getBoundingClientRect(), left: group('left'), right: group('right') }
  }
}

function onDown(e: PointerEvent): void {
  if (e.button !== 0 || press !== null || pe === null) return
  const hit = hitAt(e.target)
  if (hit === null) return
  e.preventDefault()
  try {
    props.sample?.setPointerCapture(e.pointerId)
  } catch {
    // Without capture a drag ends where the sample ends (pointerleave).
  }
  press = {
    pointerId: e.pointerId,
    hit,
    x: e.clientX,
    y: e.clientY,
    action: actionOf(hit),
    moving: false,
    slots: [],
    bar: null,
    drop: null
  }
}

function startDrag(p: Press): void {
  p.moving = true
  if (pe === null) return
  const h = p.hit.handle
  if (!canDrag(p.action) || h.spec.fixedOrder) {
    say(t.value.settings.preview.refused.fixed(h.title()))
    return
  }
  const m = measure(p.hit.el.zone, h.split !== undefined)
  p.slots = m.slots
  p.bar = m.bar
  pe.dragged.value = p.hit.el
  pe.hover.value = null
  setCursor('grabbing')
}

function dragTo(p: Press, x: number, y: number): void {
  const h = p.hit.handle
  const id = p.hit.el.id
  const inBar =
    h.split !== undefined && p.bar !== null ? dropInBar(p.slots, p.bar, id, h.split, x) : null
  const drop: Drop | null = inBar ?? dropInLine(p.slots, id, x, y)
  p.drop = drop
  lineStyle.value = drop === null ? null : lineFor(drop.line)
  const m = t.value.settings
  const label = h.label(id)
  const text =
    inBar !== null
      ? m.preview.movingSide(label, m.elements.sides[inBar.side])
      : m.preview.moving(label)
  tip.value = tipFor({ left: x, right: x, top: y - 8, bottom: y + 18 }, label, text)
}

function onMove(e: PointerEvent): void {
  const p = press
  if (p !== null && e.pointerId === p.pointerId) {
    if (!p.moving && isDragDistance(e.clientX - p.x, e.clientY - p.y)) startDrag(p)
    if (p.moving && pe?.dragged.value !== null) dragTo(p, e.clientX, e.clientY)
    return
  }
  if (p !== null || e.target === lastTarget) return
  lastTarget = e.target
  setHover(hitAt(e.target))
}

function finish(): void {
  press = null
  lastTarget = null
  lineStyle.value = null
  if (pe !== null) pe.dragged.value = null
  setCursor('')
}

function click(h: Hit, action: ElAction): void {
  const { handle, el } = h
  const label = handle.label(el.id)
  const p = t.value.settings.preview
  if (action === 'show') handle.setVisible(el.id, true)
  else if (action === 'move-hide' || action === 'hide') {
    handle.setVisible(el.id, false)
    if (!GHOST_ZONES.has(el.zone)) say(p.hiddenNote(label))
  } else say(p.refused.required(label))
  handle.reveal(el.id)
}

function onUp(e: PointerEvent): void {
  const p = press
  if (p === null || e.pointerId !== p.pointerId) return
  const dragging = p.moving && pe?.dragged.value !== null
  const drop = p.drop
  finish()
  if (!p.moving) click(p.hit, p.action)
  else if (dragging && drop !== null) {
    const h = p.hit.handle
    const next = droppedList(h.spec, h.list(), p.hit.el.id, drop.place)
    if (next !== null) h.commit(next, p.hit.el.id)
    h.reveal(p.hit.el.id)
  }
  tip.value = null
  // What is under the pointer now (the element moved, or a ghost came back).
  requestAnimationFrame(() => {
    lastTarget = null
  })
}

function onCancel(e: PointerEvent): void {
  if (press !== null && e.pointerId === press.pointerId) {
    finish()
    tip.value = null
  }
}

function onLeave(): void {
  if (press !== null) return
  lastTarget = null
  setHover(null)
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && press !== null) {
    finish()
    tip.value = null
  }
}

const onStageEnter = (): void => pe?.setInside(true)
const onStageLeave = (): void => pe?.setInside(false)

watch(
  () => props.sample,
  (root, _prev, onCleanup) => {
    if (root === null || pe === null) return
    root.dataset.pe = scope
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onCancel)
    root.addEventListener('lostpointercapture', onCancel)
    root.addEventListener('pointerleave', onLeave)
    onCleanup(() => {
      delete root.dataset.pe
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointercancel', onCancel)
      root.removeEventListener('lostpointercapture', onCancel)
      root.removeEventListener('pointerleave', onLeave)
    })
  },
  { immediate: true }
)

watch(
  () => props.stage,
  (stage, _prev, onCleanup) => {
    if (stage === null || pe === null) return
    stage.addEventListener('pointerenter', onStageEnter)
    stage.addEventListener('pointerleave', onStageLeave)
    onCleanup(() => {
      stage.removeEventListener('pointerenter', onStageEnter)
      stage.removeEventListener('pointerleave', onStageLeave)
    })
  },
  { immediate: true }
)

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(noteTimer)
  sheet?.remove()
  sheet = null
  if (pe !== null) {
    pe.hover.value = null
    pe.dragged.value = null
  }
})
</script>

<template>
  <div class="pe" aria-hidden="true">
    <div v-if="lineStyle" class="pe-line" :style="lineStyle" />
    <div v-if="tip" class="pe-tip" :class="{ 'is-below': tip.below }" :style="tip.style">
      <span class="pe-tip-title">{{ tip.title }}</span>
      <span class="pe-tip-text">{{ tip.text }}</span>
    </div>
  </div>
  <p v-if="note" class="pe-note" role="status">{{ note }}</p>
</template>

<style scoped>
.pe {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

/* The drop line: neutral ink with a dark edge, readable on both scenes. */
.pe-line {
  position: absolute;
  border-radius: 1px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.7);
}

.pe-tip {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-width: 240px;
  padding: 4px 8px 5px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--st-radius-sm);
  background: rgba(11, 13, 16, 0.92);
  color: var(--ov-fg);
  font-family: var(--ov-font-small);
  line-height: 1.25;
  white-space: nowrap;
  transform: translate(-50%, -100%);
}

.pe-tip.is-below {
  transform: translate(-50%, 0);
}

.pe-tip-title {
  font-size: 12px;
  font-weight: var(--ov-w-strong);
}

.pe-tip-text {
  overflow: hidden;
  color: var(--ov-fg-muted);
  font-size: 11px;
  text-overflow: ellipsis;
}

/* A refusal or a hidden element's way back: in the stage's foot, over the scene. */
.pe-note {
  position: absolute;
  left: 50%;
  bottom: 28px;
  z-index: 2;
  max-width: calc(100% - 32px);
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--st-radius-sm);
  background: rgba(11, 13, 16, 0.92);
  color: var(--ov-fg);
  font-size: 12px;
  transform: translateX(-50%);
  pointer-events: none;
}
</style>
