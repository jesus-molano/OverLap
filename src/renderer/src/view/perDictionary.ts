/** Language-dependent constants of the view models. Pure. */
import type { Messages } from '@shared/i18n'

/**
 * `build(m)` once per dictionary object, then the same value: frozen views (flag pills, captions,
 * placeholder chips) keep their identity while the language stays, so a v-memo or an identity
 * check skips them, and switching language swaps them all at once. At most one entry per
 * language, held weakly by the dictionary.
 */
export function perDictionary<T>(build: (m: Messages) => T): (m: Messages) => T {
  const cache = new WeakMap<Messages, T>()
  return (m) => {
    let v = cache.get(m)
    if (v === undefined) {
      v = build(m)
      cache.set(m, v)
    }
    return v
  }
}
