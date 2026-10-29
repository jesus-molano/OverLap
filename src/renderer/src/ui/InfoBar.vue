<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import {
  INFO_BAR_LINE_EM,
  INFO_BAR_SCALE,
  INFO_BAR_TOP_EM,
  INFO_ITEM_GAP_EM,
  INFO_TOP_GAP_EM,
  fitInfoItems
} from '@shared/infoBar'
import type { InfoBarSize, InfoItemId } from '@shared/types'
import { useElementSize } from '../composables/useElementSize'
import { injectSampleHost } from '../composables/widgetContext'
import { vInlineStyle } from '../directives/inlineStyle'
import type { InfoBarView, InfoItemView } from '../view/infoBar'
import type { InlineStyle } from '../view/styles'
import InfoBarItem from './InfoBarItem.vue'
import PreviewTag from './PreviewTag.vue'
import SimPill from './SimPill.vue'

/**
 * An info bar: a header or a footer band of data items (view/infoBar.ts), one line of a fixed
 * height (INFO_BAR_LINE_EM of its text, plus its 1 px rule), so the panels' maths never depend on
 * what it says; the panel's own header (the head bar with the SIM tag) keeps the header band's
 * height and spacing (INFO_BAR_TOP_EM, INFO_TOP_GAP_EM). Its text follows `size` and never goes
 * below the minimum text size; when the items do not fit the width, the least important go first
 * (fitInfoItems: whole items, never a cut word or a smaller font). The widths are estimates
 * (INFO_ITEMS[id].em); when what is drawn still overflows (a long value, the SIM or preview tag),
 * the bar drops the next least important item too, until the width or the list of items changes.
 * The items after the split marker line up at the far end; the SIM tag follows the first item of
 * a header, the preview tag ends it. An item keeps its object while it reads the same
 * (reuseInfoBar), so its component is not rendered again.
 *
 *   <InfoBar :view="head.view.value" :size="head.size.value" place="head" sim :preview="preview" />
 */
const props = withDefaults(
  defineProps<{
    view: InfoBarView
    size: Exclude<InfoBarSize, 'off'>
    /** 'head': under the panel's top, its rule below; 'foot': its rule above. */
    place: 'head' | 'foot'
    /** The SIM tag after the first item: the panel's own header, the topmost head bar. */
    sim?: boolean
    /** The 'VISTA PREVIA' tag at the end (edit-mode samples). */
    preview?: boolean
    /**
     * The bar's zone ('relative.headerBar'): the bar's `data-zone`, and each item's `data-el`
     * ('relative.headerBar.sof'), for the settings window's preview. Attributes only.
     */
    zone?: string
  }>(),
  { sim: false, preview: false, zone: undefined }
)

const root = useTemplateRef<HTMLElement>('root')
const box = useElementSize(root)

/** The panel's own header: the topmost head bar, the one with the SIM tag. */
const top = computed(() => props.place === 'head' && props.sim)
const gapEm = computed(() => (top.value ? INFO_TOP_GAP_EM : INFO_ITEM_GAP_EM))

/** The bar's own font size (px), read again only when its size changes (a resize, a scale). */
const fontPx = computed(() => {
  void box.value.w
  const el = root.value
  if (el === null || typeof getComputedStyle !== 'function') return 0
  return parseFloat(getComputedStyle(el).fontSize) || 0
})

/** Room for the items (em of the bar's text): its width less its paddings. */
const widthEm = computed(() => (fontPx.value > 0 ? box.value.w / fontPx.value : 0))

const ids = computed<readonly InfoItemId[]>((prev) => {
  const next = [...props.view.start, ...props.view.end].map((v) => v.id)
  return prev !== undefined && prev.length === next.length && prev.every((id, i) => id === next[i])
    ? prev
    : next
})

/** Each item's `data-el` ('relative.headerBar.sof'), built once per zone and item list. */
const itemEls = computed<Readonly<Partial<Record<InfoItemId, string>>>>(() => {
  const zone = props.zone
  const out: Partial<Record<InfoItemId, string>> = {}
  if (zone !== undefined) for (const id of ids.value) out[id] = `${zone}.${id}`
  return out
})

/** Items dropped beyond the estimates because the drawn bar overflowed. */
const extra = shallowRef(0)
watch([ids, widthEm], () => {
  extra.value = 0
})

/**
 * The settings preview's ghosts in this bar (hidden items drawn while you edit there): they go
 * first when the bar has no room, so what is really shown is drawn as without them. None over
 * the game.
 */
const host = injectSampleHost()
const ghosts = computed<ReadonlySet<InfoItemId>>(() => {
  const all = host?.ghosts?.value
  const out = new Set<InfoItemId>()
  if (all === undefined || all.length === 0) return out
  for (const id of ids.value) if (all.includes(itemEls.value[id] ?? '')) out.add(id)
  return out
})

const kept = computed<ReadonlySet<InfoItemId>>((prev) => {
  const next = new Set(
    fitInfoItems(ids.value, widthEm.value, gapEm.value, extra.value, ghosts.value)
  )
  return prev !== undefined && prev.size === next.size && [...next].every((id) => prev.has(id))
    ? prev
    : next
})

const start = computed<readonly InfoItemView[]>(() =>
  props.view.start.filter((v) => kept.value.has(v.id))
)
const end = computed<readonly InfoItemView[]>(() =>
  props.view.end.filter((v) => kept.value.has(v.id))
)

type Size = Exclude<InfoBarSize, 'off'>
const boxes = (top: boolean): Readonly<Record<Size, InlineStyle>> =>
  Object.freeze({
    small: boxStyle('small', top),
    normal: boxStyle('normal', top),
    large: boxStyle('large', top)
  })
const BOXES = boxes(false)
const TOP_BOXES = boxes(true)

function boxStyle(size: Size, top: boolean): InlineStyle {
  return Object.freeze({
    '--ib-scale': String(INFO_BAR_SCALE[size]),
    '--ib-h': `${top ? INFO_BAR_TOP_EM : INFO_BAR_LINE_EM}em`,
    '--ib-gap': `${top ? INFO_TOP_GAP_EM : INFO_ITEM_GAP_EM}em`
  })
}

const style = computed(() => (top.value ? TOP_BOXES : BOXES)[props.size])

const overflows = (el: HTMLElement | null): boolean =>
  el !== null && el.scrollWidth > el.clientWidth + 1

// After each drawing of new values (or a new fit, or one more drop): an item cut by the edge goes
// instead. Each step drops one more item (fitInfoItems), so this ends with nothing overflowing or
// a single item left.
watch(
  [() => props.view, kept, extra],
  () => {
    const el = root.value
    if (el === null || widthEm.value <= 0 || kept.value.size <= 1) return
    const groups = el.querySelectorAll<HTMLElement>('.ov-ibar__group')
    if (overflows(el) || [...groups].some(overflows)) extra.value += 1
  },
  { flush: 'post' }
)
</script>

<template>
  <div
    ref="root"
    v-inline-style="style"
    class="ov-ibar"
    :class="`ov-ibar--${place}`"
    :data-zone="zone"
  >
    <span class="ov-ibar__group" :data-side="zone && 'left'">
      <template v-for="(item, i) in start" :key="item.id">
        <InfoBarItem :item="item" :lead="i === 0" :data-el="itemEls[item.id]" />
        <SimPill v-if="sim && i === 0" />
      </template>
    </span>
    <span
      v-if="end.length > 0 || preview"
      class="ov-ibar__group ov-ibar__end"
      :data-side="zone && 'right'"
    >
      <InfoBarItem
        v-for="(item, i) in end"
        :key="item.id"
        :item="item"
        :lead="start.length === 0 && i === 0"
        :data-el="itemEls[item.id]"
      />
      <PreviewTag v-if="preview" />
    </span>
  </div>
</template>

<style>
/*
 * A band like the panel header's: a faint lift and a rule (below a header, above a footer). Its
 * left edge is the rows' content line (after the rail). Fixed height, so contain: strict is safe:
 * a new reading re-lays out the bar only.
 */
.ov-ibar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: var(--ib-gap);
  height: calc(var(--ib-h) + 1px);
  padding: 0 0.6em 0 calc(var(--ov-bar-w) + 0.35em);
  overflow: hidden;
  background: var(--ov-head-grad), var(--ov-bg-head);
  font-size: max(var(--ov-min-text), calc(var(--ib-scale) * 1em));
  line-height: 1.2;
  white-space: nowrap;
  contain: strict;
}

.ov-ibar--head {
  border-bottom: 1px solid var(--ov-rule);
}

.ov-ibar--foot {
  border-top: 1px solid var(--ov-rule);
}

/* Clipped (an item cut by its edge is measured and dropped above), with 1 px to spare: the
   first glyph's ClearType fringe sits just left of the group's box, and a plain clip shaved it.
   The margin only paints; the layout is the same. */
.ov-ibar__group {
  display: flex;
  align-items: center;
  gap: var(--ib-gap);
  min-width: 0;
  overflow: clip;
  overflow-clip-margin: 1px;
}

/* Both groups may shrink, so neither collapses the other to nothing: an overflowing group is
   measured above and loses its least important item. */
.ov-ibar__end {
  flex: 0 1 auto;
  margin-left: auto;
}
</style>
