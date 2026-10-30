/**
 * «Buscar ajuste» (R33): every setting of every page, found by its words, and revealed where it
 * is (its accordion opened, scrolled to, pointed out). The index is harvested from the pages as
 * they render (SearchIndexer.vue), so it always names what the page shows, in its language.
 */
import type { SettingsPage } from '../nav'
import { foldText } from '../personalBests'

/** What a result is: a page, a section's title, a control's label, an accordion, a list item. */
export type SearchKind = 'page' | 'section' | 'zone' | 'label' | 'item'

export interface SearchEntry {
  page: SettingsPage
  kind: SearchKind
  /** The words shown ('Vueltas de combustible'). */
  text: string
  /** The section or accordion it is in ('Pie'); '' for a page or a section. */
  context: string
  /** Its help line, matched with less weight; '' when none. */
  help: string
}

export interface SearchResult extends SearchEntry {
  /** Lower first. */
  score: number
}

/** The most results listed. */
export const SEARCH_LIMIT = 12

/** The query's words, folded (case and accents ignored); none for a blank query. */
function wordsOf(query: string): string[] {
  return foldText(query)
    .split(/\s+/)
    .filter((w) => w !== '')
}

/**
 * The entries `query` finds, best first: every word must be in the entry, its section or its
 * page; the label itself matching ranks first, then its section, then only the help or the page.
 * One result per page, text and section. Pure.
 */
export function searchSettings(
  entries: readonly SearchEntry[],
  query: string,
  pageTitle: (page: SettingsPage) => string,
  limit = SEARCH_LIMIT
): SearchResult[] {
  const words = wordsOf(query)
  if (words.length === 0) return []
  const whole = words.join(' ')
  const out: SearchResult[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const text = foldText(e.text)
    const near = `${text} ${foldText(e.context)}`
    const far = `${near} ${foldText(e.help)} ${foldText(pageTitle(e.page))}`
    if (!words.every((w) => far.includes(w))) continue
    let score: number
    if (text.startsWith(whole)) score = 0
    else if (text.includes(whole)) score = 1
    else if (words.every((w) => text.includes(w))) score = 2
    else if (words.every((w) => near.includes(w))) score = 3
    else score = 5
    // A page or a section a little before a label with the same score.
    if (e.kind === 'page' || e.kind === 'section') score -= 0.5
    const key = `${e.page}\n${e.text}\n${e.context}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...e, score })
  }
  out.sort((a, b) => a.score - b.score || a.text.length - b.text.length)
  return out.slice(0, limit)
}

/** What a page holds that can be searched: the selectors and the kind of each. */
const HARVEST: readonly { selector: string; kind: SearchKind }[] = [
  { selector: '.st-section-title', kind: 'section' },
  { selector: '.acc-title', kind: 'zone' },
  { selector: '.st-label', kind: 'label' },
  { selector: '.ed-name', kind: 'item' }
]

/** The selectors a result is looked for with on its page (reveal). */
export const REVEAL_SELECTOR = HARVEST.map((h) => h.selector).join(', ')

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim()

/** The accordion or section `el` is in: its title (an accordion first). */
export function contextOf(el: Element): string {
  const acc = el.closest('.acc')
  const accTitle = acc?.querySelector('.acc-title')
  if (accTitle && accTitle !== el) return clean(accTitle.textContent)
  const section = el.closest('.st-section')
  const title = section?.querySelector('.st-section-title')
  if (title && title !== el) return clean(title.textContent)
  return ''
}

/** Every searchable thing rendered under `root`, for `page` (titled `title`). */
export function harvest(root: ParentNode, page: SettingsPage, title: string): SearchEntry[] {
  const out: SearchEntry[] = [{ page, kind: 'page', text: title, context: '', help: '' }]
  for (const h of HARVEST) {
    for (const el of root.querySelectorAll(h.selector)) {
      const text = clean(el.textContent)
      if (text === '' || text.length > 80) continue
      const row = el.closest('.st-row, .ed-row')
      const help = row ? clean(row.querySelector('.st-help, .ed-hint')?.textContent) : ''
      out.push({
        page,
        kind: h.kind,
        text,
        context: h.kind === 'section' ? '' : contextOf(el),
        help
      })
    }
  }
  return out
}
