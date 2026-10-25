import { computed, onBeforeUnmount, shallowRef, type ComputedRef } from 'vue'
import { createDraftSync } from './draftSync'

/** ~10 updates/s while a slider is dragged; settings changes are rare events. */
export const SETTINGS_THROTTLE_MS = 100

/**
 * Value a control shows: main's settings (`source`), or a local draft while the user is
 * changing it and main has not answered yet. See `createDraftSync`.
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
  const sync = createDraftSync<T>({
    intervalMs: SETTINGS_THROTTLE_MS,
    apply,
    onDraft: (value) => (draft.value = { value }),
    onClear: () => (draft.value = null)
  })
  onBeforeUnmount(() => sync.dispose())
  return {
    value: computed(() => (draft.value !== null ? draft.value.value : source())),
    input: (value) => sync.input(value),
    commit: (value) => sync.commit(value)
  }
}
