import type { Messages } from '@shared/i18n'

/** How long an action from the tray or the settings window can still be undone. */
export const NOTICE_UNDO_MS = 60_000

interface Offer {
  id: number
  /** What «Deshacer» undoes, in the interface language ('Widgets traídos a esta pantalla'). */
  what: (m: Messages) => string
  undo: () => void
  /** False once undoing would lose a change made since: the offer goes (prune, run). */
  valid: () => boolean
}

/**
 * The «Deshacer» of what main did for the tray or the settings window (R26 «Según el coche»
 * turned on by linking a car, R51 widgets brought to a screen), kept in main so it works from
 * either place: the settings page sends `undo-notice` with the notice's id, the tray has a
 * «Deshacer: …» item while it lasts. One at a time (a newer action replaces it), for
 * NOTICE_UNDO_MS; `onChange` runs when it appears or goes (the tray rebuilds its menu).
 */
export class NoticeUndo {
  private offer: Offer | null = null
  private nextId = 1
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly onChange: () => void = () => {}) {}

  /**
   * Keeps `undo` as the one to undo; returns the id its notice carries. `valid` (always, when
   * absent) says whether it still may: an import's whole settings only while nothing changed.
   */
  keep(what: (m: Messages) => string, undo: () => void, valid: () => boolean = () => true): number {
    const id = this.nextId++
    this.offer = { id, what, undo, valid }
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.drop(id), NOTICE_UNDO_MS)
    this.onChange()
    return id
  }

  /** What the tray's item says (null: nothing to undo). */
  label(m: Messages): string | null {
    return this.offer === null ? null : this.offer.what(m)
  }

  /** Undoes the kept action when it is `id` (any when absent); false when it has gone. */
  run(id?: number): boolean {
    const o = this.offer
    if (o === null || (id !== undefined && o.id !== id)) return false
    this.drop(o.id)
    if (!o.valid()) return false
    o.undo()
    return true
  }

  /** Forgets the offer once undoing it would lose a later change (after every settings change). */
  prune(): void {
    if (this.offer !== null && !this.offer.valid()) this.drop(this.offer.id)
  }

  /** Forgets it (something else changed the same thing since). */
  drop(id?: number): void {
    if (this.offer === null || (id !== undefined && this.offer.id !== id)) return
    this.offer = null
    clearTimeout(this.timer)
    this.timer = undefined
    this.onChange()
  }

  dispose(): void {
    clearTimeout(this.timer)
    this.offer = null
  }
}
