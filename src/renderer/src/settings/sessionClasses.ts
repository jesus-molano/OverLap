import { shallowRef, type ShallowRef } from 'vue'

/**
 * The classes of the multiclass session running now (their short names, the fastest first; []
 * with one class or none), pushed by main: the standings' «Orden de las clases» always lists
 * them (9). Listened to once per window.
 */
export const sessionClasses: ShallowRef<readonly string[]> = shallowRef([])

let started = false

export function useSessionClasses(): ShallowRef<readonly string[]> {
  if (!started) {
    started = true
    let seen = false
    window.overlay.onSessionClasses((names) => {
      seen = true
      sessionClasses.value = names
    })
    void window.overlay.getInitialState().then((init) => {
      if (!seen) sessionClasses.value = init.sessionClasses ?? []
    })
  }
  return sessionClasses
}
