<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { INFO_BAR_LINE_EM, INFO_BAR_SCALE, INFO_ITEM_GAP_EM, fitInfoItems } from '@shared/infoBar'
import type { InfoBarSize, InfoItemId } from '@shared/types'
import { useElementSize } from '../composables/useElementSize'
import { vInlineStyle } from '../directives/inlineStyle'
import type { InfoBarView, InfoItemView } from '../view/infoBar'
import type { InlineStyle } from '../view/styles'
import InfoBarItem from './InfoBarItem.vue'
import PreviewTag from './PreviewTag.vue'
import SimPill from './SimPill.vue'

/**
 * An info bar: a header or a footer band of data items (view/infoBar.ts), one line of a fixed
 * height (INFO_BAR_LINE_EM of its text, plus its 1 px rule), so the panels' maths never depend on
 * what it says. Its text follows `size` and never goes below the minimum text size; when the
 * items do not fit the width, the least important go first (fitInfoItems: whole items, never a
 * cut word or a smaller font). The items after the split marker line up at the far end; the SIM
 * tag follows the first item of a header, the preview tag ends it. An item keeps its object while
 * it reads the same (reuseInfoBar), so its component is not rendered again.
 *
 *   <InfoBar :view="head.view.value" :size="head.size.value" place="head" sim :preview="preview" />
 */
const props = withDefaults(
  defineProps<{
    view: InfoBarView
    size: Exclude<InfoBarSize, 'off'>
    /** 'head': under the panel's top, its rule below; 'foot': its rule above. */
    place: 'head' | 'foot'
    /** The SIM tag after the first item (headers). */
    sim?: boolean
    /** The 'VISTA PREVIA' tag at the end (edit-mode samples). */
    preview?: boolean
  }>(),
  { sim: false, preview: false }
)

const root = useTemplateRef<HTMLElement>('root')
const box = useElementSize(root)

/** The bar's own font size (px), read again only when its size changes (a resize, a scale). */
const fontPx = computed(() => {
  void box.value.w
  const el = root.value
  if (el === null || typeof getComputedStyle !== 'function') return 0
  return parseFloat(getComputedStyle(el).fontSize) || 0
})

/** Room for the items (em of the bar's text): its width less its paddings. */
const widthEm = computed(() => (fontPx.value > 0 ? box.value.w / fontPx.value : 0))

const kept = computed<ReadonlySet<InfoItemId>>((prev) => {
  const ids = [...props.view.start, ...props.view.end].map((v) => v.id)
  const next = new Set(fitInfoItems(ids, widthEm.value))
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

const BOXES: Readonly<Record<Exclude<InfoBarSize, 'off'>, InlineStyle>> = Object.freeze({
  small: boxStyle('small'),
  normal: boxStyle('normal'),
  large: boxStyle('large')
})

function boxStyle(size: Exclude<InfoBarSize, 'off'>): InlineStyle {
  return Object.freeze({
    '--ib-scale': String(INFO_BAR_SCALE[size]),
    '--ib-h': `${INFO_BAR_LINE_EM}em`,
    '--ib-gap': `${INFO_ITEM_GAP_EM}em`
  })
}

const style = computed(() => BOXES[props.size])
</script>

<template>
  <div ref="root" v-inline-style="style" class="ov-ibar" :class="`ov-ibar--${place}`">
    <span class="ov-ibar__group">
      <template v-for="(item, i) in start" :key="item.id">
        <InfoBarItem :item="item" :lead="i === 0" />
        <SimPill v-if="sim && i === 0" />
      </template>
    </span>
    <span v-if="end.length > 0 || preview" class="ov-ibar__group ov-ibar__end">
      <InfoBarItem
        v-for="(item, i) in end"
        :key="item.id"
        :item="item"
        :lead="start.length === 0 && i === 0"
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
  background: var(--ov-bg-head);
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

.ov-ibar__group {
  display: flex;
  align-items: center;
  gap: var(--ib-gap);
  min-width: 0;
  overflow: hidden;
}

.ov-ibar__end {
  flex: none;
  margin-left: auto;
}
</style>
