<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { incidentsLong, type IncidentCountView } from '../view/incidents'
import Chip from './Chip.vue'

/**
 * Your incident count in a widget header: the count as a value cell keyed in its tone ('3x'),
 * then the team's count and the session's next limit as captions ('eq. 7x', 'pen. a 17x'), each
 * set off by a hairline. A header that runs short of room hides the extras (.ov-inc__more).
 * Flat props (view/incidents.ts), so a header view stays a flat object of strings.
 *
 * Full words where they fit (R50): «equipo 7x», «penalización a 17x» only while the header bar
 * has the room they add (a hidden copy measures them); otherwise the short words of always, so
 * the widget never widens.
 */
const props = withDefaults(
  defineProps<{
    count: string
    team: string
    limit: string
    teamLong?: string
    limitLong?: string
    tone: IncidentCountView['tone']
  }>(),
  { teamLong: '', limitLong: '' }
)

const root = useTemplateRef<HTMLElement>('root')
const probeShort = useTemplateRef<HTMLElement>('probeShort')
const probeLong = useTemplateRef<HTMLElement>('probeLong')
const long = shallowRef(false)
const hasLong = computed(
  () =>
    (props.teamLong !== '' && props.teamLong !== props.team) ||
    (props.limitLong !== '' && props.limitLong !== props.limit)
)
const team = computed(() => (long.value && props.teamLong !== '' ? props.teamLong : props.team))
const limit = computed(() => (long.value && props.limitLong !== '' ? props.limitLong : props.limit))

const width = (el: Element | null | undefined): number => el?.getBoundingClientRect().width ?? 0

/** The bar's free room: its content width less its groups and the gap between them. */
function freeOf(bar: HTMLElement): number {
  const cs = getComputedStyle(bar)
  const inner = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const groups = [...bar.children].filter((c) => c.classList.contains('ov-ibar__group'))
  const gap = parseFloat(cs.columnGap) || 0
  return inner - groups.reduce((s, g) => s + width(g), 0) - gap * Math.max(0, groups.length - 1)
}

function measure(): void {
  const bar = root.value?.closest<HTMLElement>('.ov-ibar') ?? null
  if (bar === null || !hasLong.value) {
    long.value = false
    return
  }
  long.value = incidentsLong(
    freeOf(bar),
    width(probeLong.value) - width(probeShort.value),
    long.value
  )
}

let ro: ResizeObserver | null = null
onMounted(() => {
  const bar = root.value?.closest('.ov-ibar')
  if (bar && typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => measure())
    ro.observe(bar)
  }
  measure()
})
onBeforeUnmount(() => ro?.disconnect())
watch(
  () => [props.team, props.limit, props.teamLong, props.limitLong],
  () => measure(),
  { flush: 'post' }
)
</script>

<template>
  <span ref="root" class="ov-inc">
    <Chip :tone="tone" :variant="tone === 'bad' ? 'solid' : 'soft'">{{ count }}</Chip>
    <span v-if="team" class="ov-inc__more ov-inc__team">{{ team }}</span>
    <span v-if="limit" class="ov-inc__more ov-inc__limit" :class="`is-${tone}`">{{ limit }}</span>
    <!-- The extras in both wordings, laid out on one line and never seen or hit (R50). -->
    <span v-if="hasLong" class="ov-inc__probe" aria-hidden="true">
      <span ref="probeShort" class="ov-inc__probe-set"
        ><span v-if="props.team" class="ov-inc__more">{{ props.team }}</span
        ><span v-if="props.limit" class="ov-inc__more ov-inc__limit" :class="`is-${tone}`">{{
          props.limit
        }}</span></span
      >
      <span ref="probeLong" class="ov-inc__probe-set"
        ><span v-if="props.teamLong" class="ov-inc__more">{{ props.teamLong }}</span
        ><span v-if="props.limitLong" class="ov-inc__more ov-inc__limit" :class="`is-${tone}`">{{
          props.limitLong
        }}</span></span
      >
    </span>
  </span>
</template>

<style>
.ov-inc {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.45em;
  min-width: 0;
  white-space: nowrap;
}

/* Real information on the header band: muted, like the header's meta, and a 0-blur hairline
   before each piece (the standings header's dividers), so '3x' and 'eq. 7x' never run together. */
.ov-inc__more {
  padding-left: 0.45em;
  box-shadow: inset 1px 0 0 var(--ov-rule);
  font-family: var(--ov-font-small);
  font-size: var(--ov-t-caption);
  font-weight: var(--ov-w-text);
  line-height: 1.3;
  color: var(--ov-fg-muted);
}

/* Close to the limit, or the DQ reached: the words take the count's tone (never colour alone). */
.ov-inc__limit.is-warn {
  color: var(--ov-warn);
  font-weight: var(--ov-w-strong);
}

.ov-inc__limit.is-bad {
  color: var(--ov-bad);
  font-weight: var(--ov-w-strong);
}

/*
 * The measuring copies: out of the layout, invisible, never hit, and in a box of no size that
 * clips them, so they never count as the bar's overflow (InfoBar drops an item for that).
 */
.ov-inc__probe {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}

.ov-inc__probe-set {
  position: absolute;
  top: 0;
  left: 0;
  display: inline-flex;
  gap: 0.45em;
  width: max-content;
}
</style>
