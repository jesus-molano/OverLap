/**
 * Edit mode's «Deshacer» (R38): what each change of a widget in edit mode replaced — its place
 * and size before a drag, a turn of the wheel or a press of the arrows, its «Escala» before a
 * wheel step, its eye or padlock before a click on the chip — so Ctrl+Z (and the tray's
 * «Deshacer: …») puts the last one back, then the one before. A held arrow or a run of wheel
 * steps on one widget is one change. Forgotten when edit mode ends. Pure.
 */
import { widgetTitle, type Messages } from '@shared/i18n'
import type { Rect } from '@shared/types'
import type { WidgetId } from '@shared/widgets'

export type EditStep =
  | { readonly kind: 'rect'; readonly id: WidgetId; readonly rect: Rect }
  | { readonly kind: 'scale'; readonly id: WidgetId; readonly scale: number }
  | {
      readonly kind: 'toggle'
      readonly id: WidgetId
      readonly field: 'visible' | 'locked'
      readonly value: boolean
    }

/** How a change was made: the repeating ones gather into one step. */
export type EditHow = 'drag' | 'wheel' | 'nudge' | 'scale' | 'toggle'

/** A repeat of the same kind on the same widget within this is the same change (ms). */
export const EDIT_GATHER_MS = 1200
/** The most changes kept. */
export const EDIT_HISTORY_MAX = 30

const GATHERS: ReadonlySet<EditHow> = new Set(['wheel', 'nudge', 'scale'])

export class EditHistory {
  private readonly steps: EditStep[] = []
  private last: { id: WidgetId; how: EditHow; at: number } | null = null

  /** Keeps what `step` replaced; false when it only continues the change before (a held key). */
  record(step: EditStep, how: EditHow, now: number): boolean {
    const l = this.last
    this.last = { id: step.id, how, at: now }
    if (l !== null && GATHERS.has(how) && l.how === how && l.id === step.id) {
      if (now - l.at <= EDIT_GATHER_MS) return false
    }
    this.steps.push(step)
    if (this.steps.length > EDIT_HISTORY_MAX) this.steps.shift()
    return true
  }

  /** The last change to put back, taken off the list (undefined: none). */
  pop(): EditStep | undefined {
    this.last = null
    return this.steps.pop()
  }

  /** The change Ctrl+Z would put back now. */
  peek(): EditStep | undefined {
    return this.steps.at(-1)
  }

  get size(): number {
    return this.steps.length
  }

  clear(): void {
    this.steps.length = 0
    this.last = null
  }
}

/**
 * What a change was, in `m`'s words, as it was made ('mover Relativo', 'cambiar el tamaño de
 * Relativo', 'ocultar Batalla'): `now`, the widget's place and size after it, tells a move from a
 * resize (a resize when its width or height changed); a toggle did the opposite of what it kept.
 */
export function editStepText(m: Messages, step: EditStep, now?: Rect): string {
  const w = widgetTitle(m, step.id)
  const e = m.core.tray.editStep
  if (step.kind === 'rect') {
    const resized =
      now !== undefined &&
      (Math.round(now.width) !== Math.round(step.rect.width) ||
        Math.round(now.height) !== Math.round(step.rect.height))
    return resized ? e.resize(w) : e.move(w)
  }
  if (step.kind === 'scale') return e.scale(w)
  if (step.field === 'visible') return step.value ? e.hide(w) : e.show(w)
  return step.value ? e.unlock(w) : e.lock(w)
}
