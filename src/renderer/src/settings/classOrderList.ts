/**
 * The list of «Orden de las clases» «A mano» (9) on the standings' page, and the class blocks
 * of its sample as the preview edits them (9b). Pure: the page's component (ClassOrderControl)
 * wires it.
 *
 * The list names the classes saved in it, in their order, then those of the session running
 * now (the fastest first) and those of the sample (GTP, LMP2, GT3) it does not name yet: the
 * order the table really uses (classes not saved go after the saved ones, the fastest first).
 * Any edit saves the whole list, so the classes of this session are remembered from then on.
 * Each row is known by classOrderKey of its name, as the sample's class names are.
 */
import { classListWith, classNameKey, classOfKey, classOrderKey } from '@shared/classOrder'
import type { ElementEntry } from '@shared/types'
import type { ElementText, List, SpecRules } from './elements/listOps'

/** The names the list shows, top to bottom. */
export function classOrderNames(
  saved: readonly string[],
  live: readonly string[],
  sample: readonly string[]
): string[] {
  return classListWith(saved, live, sample)
}

/** `names` as the editor's entries (every one shown: the list is an order only). */
export function classEntries(names: readonly string[]): ElementEntry<string>[] {
  return names.map((n) => ({ id: classOrderKey(n), visible: true }))
}

/**
 * The names of the editor's entries, spelt as in `known` (the names the list was made from: a
 * key holds the name in lower case); an id that is not a class key is left out.
 */
export function namesOf(list: List<string>, known: readonly string[] = []): string[] {
  const spelt = new Map<string, string>()
  for (const n of known) if (!spelt.has(classOrderKey(n))) spelt.set(classOrderKey(n), n.trim())
  const out: string[] = []
  for (const e of list) {
    const name = spelt.get(e.id) ?? classOfKey(e.id)
    if (name !== null) out.push(name)
  }
  return out
}

/**
 * What an edit of the list saves (`names`, its order after the edit), so the saved list neither
 * grows with every edit nor loses this session's classes:
 * - the trailing names nobody saved, of no session and not the one just moved (the sample's
 *   GTP, LMP2, GT3 at the end) stay unsaved: the list shows them there anyway;
 * - over `max`, the lowest names of no class running now go first, from the end (never this
 *   session's, never the one moved).
 */
export function namesToSave(
  names: readonly string[],
  o: {
    readonly saved: readonly string[]
    readonly live: readonly string[]
    readonly moved?: string
    readonly max: number
  }
): string[] {
  const has = (list: readonly string[], name: string): boolean =>
    list.some((n) => classNameKey(n) === classNameKey(name))
  const keep = (name: string): boolean =>
    has(o.live, name) || (o.moved !== undefined && classNameKey(o.moved) === classNameKey(name))
  const out = [...names]
  while (out.length > 0) {
    const last = out[out.length - 1] as string
    if (has(o.saved, last) || keep(last)) break
    out.pop()
  }
  for (let i = out.length - 1; i >= 0 && out.length > o.max; i--) {
    if (!keep(out[i] as string)) out.splice(i, 1)
  }
  return out.slice(0, o.max)
}

/**
 * The list's rules: every row required (nothing to hide: the sample never offers a click to
 * hide a class), free order; its default the list with nothing saved (this session's classes
 * and the sample's, the fastest first), which «Restablecer» brings back.
 */
export function classSpec(names: readonly string[], unsaved: readonly string[]): SpecRules<string> {
  const ids = names.map(classOrderKey)
  return {
    ids,
    default: classEntries(unsaved),
    required: ids,
    fixedOrder: false,
    parents: {}
  }
}

/** Each row's name, and where a class not saved yet comes from. */
export function classTexts(
  names: readonly string[],
  saved: readonly string[],
  live: readonly string[],
  words: { readonly inSession: string; readonly inPreview: string }
): Record<string, ElementText> {
  const has = (list: readonly string[], name: string): boolean =>
    list.some((n) => classNameKey(n) === classNameKey(name))
  const out: Record<string, ElementText> = {}
  for (const name of names) {
    const hint = has(live, name) ? words.inSession : has(saved, name) ? undefined : words.inPreview
    out[classOrderKey(name)] = hint === undefined ? { label: name } : { label: name, hint }
  }
  return out
}

/**
 * The list the sample's drag acts on while another order is chosen: the classes the sample
 * draws, in the order it draws them (a drop is placed among them as you see them), then the
 * other names of the list.
 */
export function drawnFirst(drawn: readonly string[], names: readonly string[]): string[] {
  return classListWith(drawn, names)
}
