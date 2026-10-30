<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { incidentsLong } from '../view/incidents'

/**
 * A header bar's text in full words where they fit (R50), as IncidentCount does for its
 * extras: «≈19 vueltas» only while the bar (.ov-ibar) has the room the long words add (a
 * hidden copy measures both); otherwise the short words of always («≈19 v»), so the widget never
 * widens and no item is dropped for it. `textClass` styles the text and its copies alike.
 */
const props = withDefaults(defineProps<{ short: string; long?: string; textClass?: string }>(), {
  long: '',
  textClass: ''
})

const root = useTemplateRef<HTMLElement>('root')
const probeShort = useTemplateRef<HTMLElement>('probeShort')
const probeLong = useTemplateRef<HTMLElement>('probeLong')
const drawnLong = shallowRef(false)
const hasLong = computed(() => props.long !== '' && props.long !== props.short)
const text = computed(() => (drawnLong.value && hasLong.value ? props.long : props.short))

const width = (el: Element | null | undefined): number => el?.getBoundingClientRect().width ?? 0

/** The bar's free room: its content width less its groups and the gap between them. */
function freeOf(bar: HTMLElement): number {
  const cs = getComputedStyle(bar)
  const inner = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const groups = [...bar.children].filter((c) => c.classList.contains('ov-ibar__group'))
  const gap = parseFloat(cs.columnGap) || 0
  return inner - groups.reduce((s, g) => s + width(g), 0) - gap * Math.max(0, groups.length - 1)
}

/**
 * What the bar's other long wordings would add (the incident count's, another FitWords'): asked
 * for as well before this one takes the room, so two of them never overflow the bar together.
 */
function othersAdd(bar: HTMLElement): number {
  let sum = 0
  for (const p of bar.querySelectorAll('.ov-inc__probe, .ov-fit__probe')) {
    if (root.value?.contains(p) === true) continue
    const [short, longer] = [...p.children]
    sum += Math.max(0, width(longer) - width(short))
  }
  return sum
}

function measure(): void {
  const bar = root.value?.closest<HTMLElement>('.ov-ibar') ?? null
  if (bar === null || !hasLong.value) {
    drawnLong.value = false
    return
  }
  const add = width(probeLong.value) - width(probeShort.value)
  drawnLong.value = incidentsLong(
    freeOf(bar),
    drawnLong.value ? add : add + othersAdd(bar),
    drawnLong.value
  )
}

let ro: ResizeObserver | null = null
onMounted(() => {
  const bar = root.value?.closest('.ov-ibar')
  if (bar && typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => measure())
    ro.observe(bar)
    // Another item turning to its long words changes the room left.
    for (const g of bar.children) if (g.classList.contains('ov-ibar__group')) ro.observe(g)
  }
  measure()
})
onBeforeUnmount(() => ro?.disconnect())
watch(
  () => [props.short, props.long],
  () => measure(),
  { flush: 'post' }
)
</script>

<template>
  <span ref="root" class="ov-fit">
    <span :class="textClass">{{ text }}</span>
    <!-- Both wordings, laid out on one line and never seen or hit (R50). -->
    <span v-if="hasLong" class="ov-fit__probe" aria-hidden="true">
      <span ref="probeShort" class="ov-fit__set" :class="textClass">{{ short }}</span>
      <span ref="probeLong" class="ov-fit__set" :class="textClass">{{ long }}</span>
    </span>
  </span>
</template>

<style>
.ov-fit {
  position: relative;
  display: inline-flex;
  min-width: 0;
  white-space: nowrap;
}

/* Out of the layout, invisible, in a box of no size that clips them (never the bar's overflow). */
.ov-fit__probe {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}

.ov-fit__set {
  position: absolute;
  top: 0;
  left: 0;
  width: max-content;
}
</style>
