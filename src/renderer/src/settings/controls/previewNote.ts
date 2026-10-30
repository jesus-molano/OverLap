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
