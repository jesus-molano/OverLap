import { shallowRef, type ShallowRef } from 'vue'

/** Main could not write settings.json: the changes are kept in memory and retried. */
const failing = shallowRef(false)
let started = false

/** Whether saving to disk fails now (a banner and the status chip say so); listened to once. */
export function useSaveFailing(): Readonly<ShallowRef<boolean>> {
  if (!started) {
    started = true
    let seen = false
    window.overlay.onSaveFailing((v) => {
      seen = true
      failing.value = v
    })
    void window.overlay.getInitialState().then((s) => {
      if (!seen && s.saveFailing === true) failing.value = true
    })
  }
  return failing
}
