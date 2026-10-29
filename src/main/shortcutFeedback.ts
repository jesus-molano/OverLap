import { hiddenText, type Messages } from '@shared/i18n'
import type { OsdMessage } from '@shared/ipc'
import type { ShortcutAction } from '@shared/shortcuts'
import type { HiddenReason } from '@shared/types'

/** The state just after a shortcut ran, as the confirmation needs it. */
export interface FeedbackState {
  overlayHidden: boolean
  editMode: boolean
  /** The one reason a rule hides every enabled widget now (tray.commonHiddenReason). */
  allHiddenBy: HiddenReason | undefined
  /** A session is running (the delta's cycle acts on it). */
  inSession: boolean
  /** The delta is on and no rule hides it now. */
  deltaShowing: boolean
  layoutCount: number
  /** The layout in use now (after the shortcut). */
  layoutName: string
}

/**
 * What the confirmation over the game says after `action` ran (R37), above all when it changed
 * nothing you can see: the overlay shown while a rule hides every widget, the delta's reference
 * changed with the delta hidden or out of a session, the next layout with only one. Null for
 * «Abrir los Ajustes» (the window says it). Pure.
 */
export function shortcutFeedback(
  m: Messages,
  action: ShortcutAction,
  s: FeedbackState
): OsdMessage | null {
  const t = m.core.osd
  switch (action) {
    case 'toggleOverlay':
      if (s.overlayHidden) return { text: t.overlayHidden, detail: '' }
      return s.allHiddenBy === undefined
        ? { text: t.overlayShown, detail: '' }
        : { text: t.overlayShownHeld(hiddenText(m, s.allHiddenBy)), detail: '' }
    case 'toggleEditMode':
      return { text: s.editMode ? t.editOn : t.editOff, detail: '' }
    case 'cycleDeltaReference':
      if (!s.inSession) return { text: t.deltaNoSession, detail: t.deltaNoSessionDetail }
      if (!s.deltaShowing) return { text: t.deltaHidden, detail: t.deltaHiddenDetail }
      return { text: t.deltaNext, detail: t.deltaNextDetail }
    case 'nextLayout':
      if (s.layoutCount < 2) return { text: t.layoutOnlyOne, detail: t.layoutOnlyOneDetail }
      return { text: t.layout(s.layoutName), detail: '' }
    case 'openSettings':
      return null
  }
}
