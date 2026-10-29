<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { useOptions } from '../../composables/useWidgetSettings'
import { optionSetter } from '../editor'
import { useDraft } from '../useDraft'
import { previewHintOf } from './previewEdit'
import { injectPreviewEdit } from './usePreviewEdit'
import { injectPreviewFold } from '../layout/previewFold'

/**
 * The line above a widget page's preview that says it is editable, on a page with element lists,
 * until you dismiss it (settingsWindow.previewHint, remembered across reopenings). It promises
 * only what the page's lists allow (previewHintOf): "Arrastra… para ordenar" where one can be
 * reordered, the translucent hidden elements where they are drawn.
 */
const t = useI18n()
const edit = injectPreviewEdit()
const windowOptions = useOptions('settingsWindow')
const hint = useDraft<boolean>(
  () => windowOptions.value.previewHint,
  optionSetter('settingsWindow')('previewHint')
)
const kind = computed(() =>
  edit === null
    ? null
    : previewHintOf(
        [...edit.zones.value.values()].map((h) => ({
          zone: h.zone,
          fixedOrder: h.spec.fixedOrder,
          off: h.off()
        }))
      )
)
const texts = computed(() => {
  const p = t.value.settings.preview
  const k = kind.value
  if (k === null) return null
  return {
    main: k.sortable ? p.hint : p.hintFixed,
    more: k.ghosts === 'all' ? p.hintMore : k.ghosts === 'some' ? p.hintMoreSome : p.hintMoreNone
  }
})
/** Folded into a strip (R14): the hint gives its room to the options too. */
const fold = injectPreviewFold()
const shown = computed(() => hint.value.value && texts.value !== null && !fold.folded.value)
</script>

<template>
  <div v-if="shown" class="pe-hint">
    <span class="pe-hint-icon" aria-hidden="true">{{ kind?.sortable ? '⠿' : '◉' }}</span>
    <p class="pe-hint-text">
      <span class="pe-hint-main">{{ texts?.main }}</span>
      <span class="pe-hint-more">{{ texts?.more }}</span>
    </p>
    <button
      type="button"
      class="st-btn st-btn-sm st-btn-ghost pe-hint-close"
      :aria-label="t.settings.preview.hintDismissLabel"
      @click="hint.commit(false)"
    >
      {{ t.settings.preview.hintDismiss }}
    </button>
  </div>
</template>

<style scoped>
.pe-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 5px 6px 5px 10px;
  border: 1px solid var(--st-border);
  border-radius: var(--st-radius);
  background: var(--st-surface);
}

.pe-hint-icon {
  display: inline-flex;
  flex: none;
  color: var(--ov-fg-muted);
  font-size: 14px;
}

.pe-hint-text {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 0 8px;
  min-width: 0;
  font-size: 12.5px;
}

.pe-hint-main {
  color: var(--ov-fg);
}

.pe-hint-more {
  color: var(--ov-fg-muted);
}

.pe-hint-close {
  flex: none;
}
</style>
