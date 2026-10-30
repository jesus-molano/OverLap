import type { Messages } from '@shared/i18n'

/**
 * Why a control changes nothing in the preview, said the same way wherever it happens
 * (PreviewNote.vue): `room`, the widget's width leaves no room for it («No cabe a 540 px»), or a
 * size that hides its effect; `behaviour`, it acts during the session only («No cambia la vista
 * previa»). `detail` is what it means, for the pointer's tooltip and screen readers.
 */
export interface PreviewNoteSpec {
  readonly kind: 'room' | 'behaviour'
  readonly text: string
  readonly detail?: string
}

/**
 * The note of every option that only acts during the session (when a widget shows, what it
 * waits for, how long it holds, how it computes): the same words on every page.
 */
export function behaviourNote(m: Messages): PreviewNoteSpec {
  const p = m.settings.preview
  return { kind: 'behaviour', text: p.behaviour, detail: p.behaviourHelp }
}
