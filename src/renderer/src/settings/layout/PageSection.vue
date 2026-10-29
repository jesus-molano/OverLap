<script setup lang="ts">
import { computed, inject, useId } from 'vue'
import { widgetTitle } from '@shared/i18n'
import { useI18n } from '../../composables/useI18n'
import { WIDGET_PAGE, resetWidget } from '../undo/restore'
import ResetIcon from './ResetIcon.vue'

/**
 * A titled block of a settings page: caps caption, optional note, rows in a card. On a widget page
 * a section that `resets` a part of it ('options': Contenido and Personalizar, 'window': Ventana y
 * visibilidad) has its ↺ at the end of its head (R24), the same as the page's "Restablecer…" menu.
 */
const props = withDefaults(
  defineProps<{
    title: string
    note?: string
    /** Rows go straight into a card (default); off for custom content (column editor). */
    card?: boolean
    resets?: 'options' | 'window'
  }>(),
  { note: undefined, card: true, resets: undefined }
)

const titleId = useId()
const t = useI18n()
const widget = inject(WIDGET_PAGE, null)
const reset = computed(() => {
  if (props.resets === undefined || widget === null) return null
  const r = t.value.settings.widgetPage.reset
  return r.sectionLabel(r[props.resets].label, widgetTitle(t.value, widget))
})

function onReset(): void {
  if (props.resets !== undefined && widget !== null) resetWidget(widget, props.resets)
}
</script>

<template>
  <section class="st-section" :aria-labelledby="titleId">
    <div class="st-section-head">
      <h2 :id="titleId" class="st-section-title">{{ title }}</h2>
      <span v-if="note" class="st-section-note">{{ note }}</span>
      <ResetIcon v-if="reset" :label="reset" @reset="onReset" />
    </div>
    <div :class="{ 'st-card': card }">
      <slot />
    </div>
  </section>
</template>
