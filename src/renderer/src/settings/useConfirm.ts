import { onScopeDispose, readonly, shallowRef, type Ref } from 'vue'

/** How long a destructive button stays armed waiting for the second click. */
export const CONFIRM_MS = 4000

export interface Confirm {
  /** The first click happened: the next `trigger` runs the action. */
  readonly armed: Readonly<Ref<boolean>>
  /** First call arms, second call (within `ms`) runs the action. */
  trigger(): void
  /** Disarms without running (focus left the button, Escape). */
  cancel(): void
}

/**
 * Two-step confirmation for resets: one timer at most, cleared when it fires, on cancel, on
 * confirm and when the owning scope (component) is disposed.
 */
export function useConfirm(action: () => void, ms = CONFIRM_MS): Confirm {
  const armed = shallowRef(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function clear(): void {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function cancel(): void {
    clear()
    armed.value = false
  }

  function trigger(): void {
    if (armed.value) {
      cancel()
      action()
      return
    }
    armed.value = true
    timer = setTimeout(() => {
      timer = null
      armed.value = false
    }, ms)
  }

  onScopeDispose(clear)
  return { armed: readonly(armed), trigger, cancel }
}
