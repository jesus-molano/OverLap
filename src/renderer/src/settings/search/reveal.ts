import { REVEAL_SELECTOR, contextOf, type SearchEntry } from './settingsSearch'

/** How long a found setting stays pointed out. */
export const FOUND_MS = 1800
/** How long the line saying a result is not shown now stays. */
export const MISS_MS = 8000

/** What a search result reveals on its page. */
export type RevealTarget = Pick<SearchEntry, 'text' | 'context' | 'kind'>

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim()

/**
 * The element of `target` under `root`: the same words, in the same section or accordion when
 * there are several (the first one otherwise); null when the page does not show it.
 */
export function findTarget(
  root: ParentNode,
  target: Pick<SearchEntry, 'text' | 'context'>
): Element | null {
  const all = [...root.querySelectorAll(REVEAL_SELECTOR)].filter(
    (el) => clean(el.textContent) === target.text
  )
  return all.find((el) => contextOf(el) === target.context) ?? all[0] ?? null
}

/** Opens what hides `el`: closed accordions, a closed «Añadir dato» list, closed details. */
function openAround(el: Element): void {
  for (
    let a = el.closest('.acc:not(.is-open)');
    a;
    a = a.parentElement?.closest('.acc:not(.is-open)') ?? null
  ) {
    a.querySelector<HTMLButtonElement>(':scope > .acc-h .acc-btn')?.click()
  }
  const hidden = el.closest('.ed-hidden:not(.is-open)')
  hidden?.querySelector<HTMLButtonElement>('.ed-hidden-btn')?.click()
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null) {
    d.open = true
  }
}

/**
 * A search result shown on its page (R33): what hides it opened, scrolled to the middle and
 * pointed out for a moment (settings.css .st-found). Tried again for a short while, since the
 * page has just been put in place. False when it never showed up (the page alone is shown).
 */
export async function revealTarget(
  root: () => ParentNode | null,
  target: Pick<SearchEntry, 'text' | 'context' | 'kind'>,
  tries = 12
): Promise<boolean> {
  if (target.kind === 'page') return true
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 30))
    const r = root()
    const el = r ? findTarget(r, target) : null
    if (!el) continue
    openAround(el)
    // The accordion opens with a short animation: the place is measured after it.
    await new Promise((res) => setTimeout(res, 180))
    const mark = el.closest('.st-row, .ed-row, .acc, .st-section-head') ?? el
    mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
    mark.classList.remove('st-found')
    void (mark as HTMLElement).offsetWidth
    mark.classList.add('st-found')
    setTimeout(() => mark.classList.remove('st-found'), FOUND_MS)
    return true
  }
  return false
}
