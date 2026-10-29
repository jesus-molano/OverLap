import { computed, onBeforeUnmount, shallowRef, type ComputedRef } from 'vue'
import { createDraftSync } from './draftSync'
import { layoutInUse, sendingFor } from './editor'

/** ~10 updates/s while a slider is dragged; settings changes are rare events. */
export const SETTINGS_THROTTLE_MS = 100

/**
 * Value a control shows: main's settings (`source`), or a local draft while the user is
 * changing it and main has not answered yet. See `createDraftSync`. A value sent after the
 * throttle waited still says the layout in use when it was set (sendingFor), so a layout applied
 * in between never takes it.
 */
export function useDraft<T>(
  source: () => T,
  apply: (value: T) => Promise<unknown>
): {
  value: ComputedRef<T>
  input: (value: T) => void
  commit: (value: T) => void
} {
  const draft = shallowRef<{ value: T } | null>(null)
  /** The layout in use at the latest input or commit: the value sent next is the latest one. */
  let madeFor: string | undefined
  const sync = createDraftSync<T>({
    intervalMs: SETTINGS_THROTTLE_MS,
    apply: (value) => sendingFor(madeFor, () => apply(value)),
    onDraft: (value) => (draft.value = { value }),
    onClear: () => (draft.value = null)
  })
  onBeforeUnmount(() => sync.dispose())
  return {
    value: computed(() => (draft.value !== null ? draft.value.value : source())),
    input: (value) => {
      madeFor = layoutInUse()
      sync.input(value)
    },
    commit: (value) => {
      madeFor = layoutInUse()
      sync.commit(value)
    }
  }
}
