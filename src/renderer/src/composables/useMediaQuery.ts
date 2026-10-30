import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'

/**
 * Whether `query` matches now, following it (the settings window's narrow layout, R49). False
 * where matchMedia is missing (tests, a non-browser host).
 */
export function useMediaQuery(query: string): Readonly<ShallowRef<boolean>> {
  const list = typeof matchMedia === 'function' ? matchMedia(query) : null
  const matches = shallowRef(list?.matches ?? false)
  if (list) {
    const onChange = (e: MediaQueryListEvent): void => {
      matches.value = e.matches
    }
    list.addEventListener('change', onChange)
    onScopeDispose(() => list.removeEventListener('change', onChange))
  }
  return matches
}
