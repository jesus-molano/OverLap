<script setup lang="ts">
import { computed, inject, useId } from 'vue'
import { widgetTitle } from '@shared/i18n'
import { useI18n } from '../../composables/useI18n'
import { useOverlayState } from '../../composables/useOverlay'
import { WIDGET_PAGE, resetWidget, widgetPartAtDefault, type PageResetPart } from '../undo/restore'
import ResetIcon from './ResetIcon.vue'

/**
 * A titled block of a settings page: caps caption, optional note, rows in a card. A section that
 * can be reset has its ↺ at the end of its head (R24), the same as its page's "Restablecer…" item:
 * on a widget page `resets` names the part ('content': Contenido, 'driver': Piloto, 'window':
 * Ventana y visibilidad), which resets only that section; elsewhere `resetLabel` names it and the
 * page handles the `reset` event (Apariencia's sections).
 */
const props = withDefaults(
  defineProps<{
    title: string
    note?: string
    /** Rows go straight into a card (default); off for custom content (column editor). */
    card?: boolean
    resets?: PageResetPart
    /** Outside a widget page: the ↺'s name ('Restablecer Color'); it emits `reset`. */
    resetLabel?: string
    /** Outside a widget page: that part is as it comes (its ↺ dimmed, saying so). */
    resetDisabled?: boolean
  }>(),
  {
    note: undefined,
    card: true,
    resets: undefined,
    resetLabel: undefined,
    resetDisabled: false
  }
)
const emit = defineEmits<{ reset: [] }>()

const titleId = useId()
const t = useI18n()
const widget = inject(WIDGET_PAGE, null)
const reset = computed(() => {
  if (props.resetLabel !== undefined) return props.resetLabel
  if (props.resets === undefined || widget === null) return null
  const r = t.value.settings.widgetPage.reset
  return r.sectionLabel(r[props.resets].label, widgetTitle(t.value, widget))
})

const { settings } = useOverlayState()
/** Nothing to reset: the part is as it comes (R47), as the lists' «Restablecer». */
const atDefault = computed(() => {
  if (props.resetLabel !== undefined) return props.resetDisabled
  const s = settings.value
  if (props.resets === undefined || widget === null || s === null) return false
  return widgetPartAtDefault(s, widget, props.resets)
})

function onReset(): void {
  if (props.resetLabel !== undefined) emit('reset')
  else if (props.resets !== undefined && widget !== null) resetWidget(widget, props.resets)
}
</script>

<template>
  <section class="st-section" :aria-labelledby="titleId">
    <div class="st-section-head">
      <h2 :id="titleId" class="st-section-title">{{ title }}</h2>
      <span v-if="note" class="st-section-note">{{ note }}</span>
      <ResetIcon v-if="reset" :label="reset" :disabled="atDefault" @reset="onReset" />
    </div>
    <div :class="{ 'st-card': card }">
      <slot />
    </div>
  </section>
</template>
