import { onBeforeUnmount, shallowRef, type ShallowRef } from 'vue'
import type { ShortcutAction } from '@shared/shortcuts'

/** How long a row says it was pressed («Pulsado hace 12 s»), seconds. */
export const USED_SHOWN_S = 60

/** When each action's shortcut last ran (performance.now() ms), from main (R37). */
const usedAt = shallowRef<Partial<Record<ShortcutAction, number>>>({})
let started = false

/** Listened to once per window: a shortcut ran (main says which action). */
function start(): void {
  if (started) return
  started = true
  window.overlay.onShortcutUsed((action) => {
    usedAt.value = { ...usedAt.value, [action]: performance.now() }
  })
}

/**
 * Whole seconds since `action`'s shortcut ran, while it is under USED_SHOWN_S; null otherwise
 * (never, or long ago). Pure.
 */
export function usedAgo(at: number | undefined, now: number): number | null {
  if (at === undefined) return null
  const s = Math.max(0, Math.floor((now - at) / 1000))
  return s < USED_SHOWN_S ? s : null
}

/**
 * When each shortcut last ran and a clock that ticks once a second while one is recent: the
 * shortcuts page says «Pulsado hace 3 s» on its row, to test a binding from the game.
 */
export function useShortcutUsed(): {
  usedAt: Readonly<ShallowRef<Partial<Record<ShortcutAction, number>>>>
  now: Readonly<ShallowRef<number>>
} {
  start()
  const now = shallowRef(performance.now())
  const timer = setInterval(() => {
    const t = performance.now()
    // Ticks only while a row shows it (the tick that ends it included).
    const shown = (at: number | undefined): boolean => usedAgo(at, now.value) !== null
    if (Object.values(usedAt.value).some(shown)) now.value = t
  }, 1000)
  onBeforeUnmount(() => clearInterval(timer))
  return { usedAt, now }
}
