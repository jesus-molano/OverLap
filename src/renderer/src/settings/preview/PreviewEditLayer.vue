<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useId,
  useTemplateRef,
  watch,
  watchEffect
} from 'vue'
import { useI18n } from '../../composables/useI18n'
import type { InlineStyle } from '../../view/styles'
import type { Side } from '../elements/listOps'
import {
  GHOST_OUTSET,
  GHOST_ZONES,
  MARK_OUTSET,
  canDrag,
  dropInBar,
  dropInLine,
  droppedList,
  elAction,
  NEAR_OFFSETS,
  isDragDistance,
  isPlainKey,
  litKeys,
  marksCss,
  outlineBoxes,
  pickEl,
  sameEl,
  shownDropList,
  tipPlace,
  union,
  type BarBoxes,
  type Box,
  type Drop,
  type ElAction,
  type ElRef,
  type PreviewZoneId,
  type Slot,
  type TipPlace
} from './previewEdit'
import { injectPreviewEdit, type ZoneHandle } from './usePreviewEdit'

/**
 * The pointer side of editing in the sample (usePreviewEdit.ts): listeners on the sample's root
 * (one set, by delegation: what is under the pointer is the nearest `data-el` of a zone with an
 * editor; on nothing, an element a few px away), the outline of the hovered element with its
 * name and what a click or a drag does (beside the widget: tipPlace), the drop line of a drag,
 * and a short note when the rules refuse something. The ghosts' and the dragged element's fade
 * are one stylesheet over the sample (marksCss); the outlines are boxes in this layer just
 * outside each copy of the element (litKeys, outlineBoxes), so they cover no text and no bar
 * clips them: the hovered and the lit element's measured when what is lit changes or the sample
 * redraws, the ghosts' dashed ones when the ghosts come, go or change (entering the stage, a
 * setting) and when the sample or a ghost resizes, never per frame. A drag measures its zone
 * once, when it starts.
 *
 * A press that does not travel is a click: it shows or hides the element (a ghost is shown
 * where it is drawn). One that travels is a drag: the element lands before or after its
 * neighbours (an info bar: on the side the pointer is on), through the zone's editor, so the
 * patch, the rules and the announcement are the list's own; a ghost dropped is shown there.
 * Either opens the zone's accordion. Escape cancels a drag.
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

/** The name and what the pointer does, beside the widget (tipPlace). */
interface Tip {
  readonly style: InlineStyle
  readonly side: TipPlace['side']
  readonly compact: boolean
  readonly title: string
  readonly text: string
}
const tip = shallowRef<Tip | null>(null)
/** The outlines of the hovered and the lit element (every copy it draws), in the stage. */
const marks = shallowRef<readonly InlineStyle[]>([])
/** The dashed outlines of the ghosts (every copy each draws), in the stage. */
const ghostMarks = shallowRef<readonly InlineStyle[]>([])
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
    hover: null,
    lit: null,
    dragged: pe.dragged.value,
    ghosts: pe.ghosts.value
  })
  if (sheet !== null && sheet.textContent !== css) sheet.textContent = css
})

// ---- The outlines: boxes over the sample, just outside each copy of the element -------------

/** At most this many copies outlined (a column of a long table). */
const MAX_MARKS = 80
let marksFrame = 0
let litNow: readonly string[] = []

const boxStyle = (b: Box): InlineStyle => ({
  left: `${b.left}px`,
  top: `${b.top}px`,
  width: `${b.right - b.left}px`,
  height: `${b.bottom - b.top}px`
})

/** The outlines of every copy of `keys` in the sample, `outset` px outside each (and the nodes). */
function outlinesOf(
  keys: readonly string[],
  outset: number
): { styles: InlineStyle[]; nodes: Element[] } {
  const root = props.sample
  const s = stageBox()
  if (root === null || s === null || keys.length === 0) return { styles: [], nodes: [] }
  const nodes = keys.flatMap((key) => [...root.querySelectorAll(`[data-el="${key}"]`)])
  const boxes = outlineBoxes(
    nodes.map((n) => n.getBoundingClientRect()),
    s,
    outset,
    MAX_MARKS
  )
  return { styles: boxes.map(boxStyle), nodes }
}

function measureMarks(): void {
  marksFrame = 0
  const out = outlinesOf(litNow, MARK_OUTSET).styles
  if (out.length > 0 || marks.value.length > 0) marks.value = out
}

/** Measures the outlines on the next frame (once, however many changes come before it). */
function scheduleMarks(): void {
  if (marksFrame === 0) marksFrame = requestAnimationFrame(measureMarks)
}

watch(
  () =>
    pe === null
      ? []
      : litKeys({
          hover: pe.hover.value,
          lit: pe.lit.value,
          dragged: pe.dragged.value,
          ghosts: []
        }),
  (keys) => {
    litNow = keys
    watchSample(keys.length > 0)
    scheduleMarks()
  },
  { flush: 'post' }
)
// Ghosts that come or go move what is outlined.
watch(() => pe?.ghosts.value, scheduleMarks, { flush: 'post' })

// ---- The ghosts' dashed outlines -------------------------------------------------------------

let ghostFrame = 0
let ghostsNow: readonly string[] = []
let ghostNodes: readonly Element[] = []
let ghostObserver: ResizeObserver | null = null

/**
 * Measures the ghosts' outlines, and while there are ghosts watches the sizes of the sample, the
 * stage and each ghost (a resize, a ghost the bar's fit drops or brings back), never per frame.
 */
function measureGhosts(): void {
  ghostFrame = 0
  const { styles, nodes } = outlinesOf(ghostsNow, GHOST_OUTSET)
  if (styles.length > 0 || ghostMarks.value.length > 0) ghostMarks.value = styles
  if (ghostsNow.length === 0) {
    ghostObserver?.disconnect()
    ghostObserver = null
    ghostNodes = []
    return
  }
  const same = nodes.length === ghostNodes.length && nodes.every((n, i) => n === ghostNodes[i])
  if (same && ghostObserver !== null) return
  ghostObserver?.disconnect()
  // A first callback for each target observed: one more measure, the same nodes, no new observe.
  ghostObserver = new ResizeObserver(scheduleGhosts)
  if (props.sample !== null) ghostObserver.observe(props.sample)
  if (props.stage !== null) ghostObserver.observe(props.stage)
  for (const n of nodes) ghostObserver.observe(n)
  ghostNodes = nodes
}

function scheduleGhosts(): void {
  if (ghostFrame === 0) ghostFrame = requestAnimationFrame(measureGhosts)
}

watch(
  () => pe?.ghosts.value ?? [],
  (keys) => {
    ghostsNow = keys.filter(isPlainKey)
    scheduleGhosts()
  },
  { flush: 'post', immediate: true }
)

/** While something is outlined: whatever the sample redraws or resizes moves the outlines. */
let sampleObservers: { mo: MutationObserver; ro: ResizeObserver } | null = null
function watchSample(on: boolean): void {
  const root = props.sample
  if (!on || root === null) {
    sampleObservers?.mo.disconnect()
    sampleObservers?.ro.disconnect()
    sampleObservers = null
    return
  }
  if (sampleObservers !== null) return
  const mo = new MutationObserver(scheduleMarks)
  mo.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-el']
  })
  const ro = new ResizeObserver(scheduleMarks)
  ro.observe(root)
  if (props.stage !== null) ro.observe(props.stage)
  sampleObservers = { mo, ro }
}

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

const actionOf = (h: Hit): ElAction =>
  elAction(h.handle.spec, h.handle.list(), h.el.id, h.handle.linked?.(h.el.id) ?? false)

// ---- Positions (client px to the stage's) --------------------------------------------------

/**
 * The origin of what this layer draws: its own box, which its children are placed from. The
 * stage's border box would put every outline, line and tip 1 px right and down (the stage's
 * border). The stage's box until the layer is mounted.
 */
const layerEl = useTemplateRef<HTMLElement>('layer')
function stageBox(): DOMRect | null {
  return (layerEl.value ?? props.stage)?.getBoundingClientRect() ?? null
}

/** The widget's own box in the sample (the box its window stands in), else the sample's. */
function widgetBox(): DOMRect | null {
  const root = props.sample
  if (root === null) return null
  return (root.querySelector('.ws-box') ?? root).getBoundingClientRect()
}

function tipFor(box: Box, title: string, text: string): Tip | null {
  const s = stageBox()
  const w = widgetBox()
  if (s === null || w === null) return null
  const p = tipPlace(box, w, s)
  return {
    style: { left: `${p.x}px`, top: `${p.y}px`, maxWidth: `${p.maxWidth}px` },
    side: p.side,
    compact: p.compact,
    title,
    text
  }
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
let lastDirect: Hit | null = null
let lastNode: Element | null = null

/**
 * What the pointer at `x`, `y` is on: its target's element, else one a few px away (the small
 * items of a sample drawn smaller than it is: a bar's 8 px figures).
 */
function hitNear(target: EventTarget | null, x: number, y: number): Hit | null {
  const direct = target === lastTarget ? lastDirect : hitAt(target)
  lastTarget = target
  lastDirect = direct
  if (direct !== null) return direct
  const root = props.sample
  if (root === null || !(target instanceof Node) || !root.contains(target)) return null
  for (const [dx, dy] of NEAR_OFFSETS) {
    const near = hitAt(document.elementFromPoint(x + dx, y + dy))
    if (near !== null) return near
  }
  return null
}

function setHover(next: Hit | null): void {
  if (pe === null) return
  if (next?.node === lastNode && next !== null) return
  lastNode = next?.node ?? null
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
function measure(zone: PreviewZoneId, split: boolean): { slots: Slot[]; bar: BarBoxes | null } {
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
  const hit = hitNear(e.target, e.clientX, e.clientY)
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
    inBar !== null ? m.preview.movingSide(m.elements.sides[inBar.side]) : m.preview.moving
  tip.value = tipFor({ left: x, right: x, top: y - 8, bottom: y + 18 }, label, text)
}

function onMove(e: PointerEvent): void {
  const p = press
  if (p !== null && e.pointerId === p.pointerId) {
    if (!p.moving && isDragDistance(e.clientX - p.x, e.clientY - p.y)) startDrag(p)
    if (p.moving && pe?.dragged.value !== null) dragTo(p, e.clientX, e.clientY)
    return
  }
  if (p !== null) return
  setHover(hitNear(e.target, e.clientX, e.clientY))
}

function finish(): void {
  press = null
  lastTarget = null
  lastNode = null
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
    if (!(GHOST_ZONES as ReadonlySet<string>).has(el.zone)) say(p.hiddenNote(label))
  } else if (action === 'move-linked') {
    // Shown or hidden in the «Piloto» block: said, and its row pointed out there.
    say(p.refused.linked(label))
    if (handle.revealLinked !== undefined) {
      handle.revealLinked(el.id)
      return
    }
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
    const id = p.hit.el.id
    // A ghost dropped is shown where it lands (one patch), never moved while still hidden.
    if (p.action === 'show') h.showAt(shownDropList(h.spec, h.list(), id, drop.place), id)
    else {
      const next = droppedList(h.spec, h.list(), id, drop.place)
      if (next !== null) h.commit(next, id)
    }
    h.reveal(id)
  }
  tip.value = null
  // What is under the pointer now (the element moved, or a ghost came back).
  requestAnimationFrame(() => {
    lastTarget = null
    lastNode = null
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
  lastNode = null
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
  cancelAnimationFrame(marksFrame)
  cancelAnimationFrame(ghostFrame)
  ghostObserver?.disconnect()
  ghostObserver = null
  watchSample(false)
  sheet = null
  if (pe !== null) {
    pe.hover.value = null
    pe.dragged.value = null
  }
})
</script>

<template>
  <div ref="layer" class="pe" aria-hidden="true">
    <div v-for="(m, i) in ghostMarks" :key="`g${i}`" class="pe-ghost" :style="m" />
    <div v-if="lineStyle" class="pe-line" :style="lineStyle" />
    <div v-for="(m, i) in marks" :key="i" class="pe-mark" :style="m" />
    <div
      v-if="tip"
      class="pe-tip"
      :class="[`is-${tip.side}`, { 'is-compact': tip.compact }]"
      :style="tip.style"
    >
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

/*
 * The outline of the hovered or lit element: a ring just outside its box (markBox), so it
 * never covers the element's text and no bar or cell around it clips it. Neutral ink with a
 * dark edge, readable on both scenes.
 */
.pe-mark {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid rgba(255, 255, 255, 0.95);
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.65);
}

/*
 * A ghost's dashed ring, 1 px just outside its box (outlineBoxes), drawn here so no info bar or
 * group clips it. As faint as the old outline on the translucent element: 0.85 at its 0.42.
 */
.pe-ghost {
  position: absolute;
  box-sizing: border-box;
  border: 1px dashed rgba(255, 255, 255, 0.36);
}

/* Beside the widget (or in the margin above or below it): never over what it is about. */
.pe-tip {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-width: 240px;
  padding: 4px 8px 4px;
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

/* Beside the widget its width is the room there: the text wraps rather than being cut. */
.pe-tip.is-right {
  white-space: normal;
  transform: translate(0, -50%);
}

.pe-tip.is-left {
  white-space: normal;
  transform: translate(-100%, -50%);
}

/* One line in the thin margin above a wide widget: the name, then what it does. */
.pe-tip.is-compact {
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
  padding: 1px 8px 2px;
}

.pe-tip-title {
  overflow: hidden;
  font-size: var(--st-t-help);
  font-weight: var(--ov-w-strong);
  text-overflow: ellipsis;
}

.pe-tip-text {
  overflow: hidden;
  color: var(--ov-fg-muted);
  font-size: var(--st-t-caption);
  text-overflow: ellipsis;
}

/* A refusal or a hidden element's way back: in the stage's foot, over the scene. */
.pe-note {
  position: absolute;
  left: 50%;
  bottom: 28px;
  z-index: 2;
  max-width: calc(100% - 32px);
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--st-radius-sm);
  background: rgba(11, 13, 16, 0.92);
  color: var(--ov-fg);
  font-size: var(--st-t-help);
  transform: translateX(-50%);
  pointer-events: none;
}
</style>
