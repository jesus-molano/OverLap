<script setup lang="ts">
import Icon from '../../ui/Icon.vue'
import type { PreviewNoteSpec } from './previewNote'

/**
 * The one note for a control or a list row whose effect the preview does not show (previewNote.ts):
 * an icon and a few words, the same on every page; the detail is its tooltip and is read out.
 * Nothing without a note.
 *
 *   <PreviewNote :note="{ kind: 'room', text: 'No cabe a 540 px', detail: 'A 540 px…' }" />
 */
defineProps<{ note: PreviewNoteSpec | undefined }>()
</script>

<template>
  <span v-if="note" class="st-pnote" :class="`is-${note.kind}`" :title="note.detail">
    <Icon :name="note.kind === 'room' ? 'no-room' : 'no-preview'" class="st-pnote-icon" />
    <span>{{ note.text }}</span>
    <span v-if="note.detail" class="st-sr-only">: {{ note.detail }}</span>
  </span>
</template>

<style scoped>
.st-pnote {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  max-width: 100%;
  color: var(--ov-fg-muted);
  font-size: var(--st-t-help);
  line-height: 1.4;
}

/* No room: the warning ink, so a row that seems dead says why at a glance. */
.st-pnote.is-room {
  color: var(--ov-warn);
}

.st-pnote-icon {
  flex: none;
}
</style>
