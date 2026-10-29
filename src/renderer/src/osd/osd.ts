import type { OsdMessage } from '@shared/ipc'
import './osd.css'

/**
 * The confirmation window over the game (main/osdWindow.ts, R37): a pill with what a shortcut
 * just did and, smaller, a second line. Main words it and shows or hides the window; this only
 * draws the latest message, with a short fade in.
 */
export function startOsd(root: HTMLElement): void {
  const pill = document.createElement('div')
  pill.className = 'osd-pill'
  pill.setAttribute('role', 'status')
  const text = document.createElement('div')
  text.className = 'osd-text'
  const detail = document.createElement('div')
  detail.className = 'osd-detail'
  pill.append(text, detail)
  root.append(pill)
  window.overlay.onOsd((msg: OsdMessage) => {
    text.textContent = msg.text
    detail.textContent = msg.detail
    detail.hidden = msg.detail === ''
    // Restart the fade for a new message while the last one is still up.
    pill.classList.remove('osd-in')
    void pill.offsetWidth
    pill.classList.add('osd-in')
  })
}
