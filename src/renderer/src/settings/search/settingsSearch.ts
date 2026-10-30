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
  /** Not on the page now: another setting of its section shows it (a mode, an item shown). */
  gated?: boolean
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
 * Everyday words for a setting named otherwise (folded): «zoom» finds «Tamaño de esta ventana»,
 * «fijar» «Bloqueado», «daltonismo» the colour-blind palette. Each word also finds these.
 */
export const SEARCH_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  zoom: ['tamano de esta ventana', 'size of this window'],
  ampliar: ['tamano de esta ventana', 'tamano del texto'],
  lupa: ['tamano de esta ventana'],
  magnify: ['size of this window', 'text size'],
  fijar: ['bloquead'],
  lock: ['locked'],
  parpadeo: ['parpade'],
  destello: ['parpade'],
  blink: ['flash'],
  blinking: ['flash'],
  daltonismo: ['dalton'],
  daltonico: ['dalton'],
  colorblind: ['colour-blind'],
  'color-blind': ['colour-blind'],
  blindness: ['colour-blind'],
  transparencia: ['opacidad'],
  transparency: ['opacity'],
  letra: ['texto'],
  font: ['text'],
  sombra: ['contorno'],
  shadow: ['outline']
}

/** A Spanish infinitive ('bloquear', 'ocultar'): its stem and ending. */
const INFINITIVE = /^(.{4,})(ar|er|ir)$/

/**
 * What a query word finds: itself, its synonyms and, for an infinitive, its participle stem
 * ('bloquear' finds «Bloqueado»): the same setting however it is put.
 */
function formsOf(word: string): readonly string[] {
  const out = [word, ...(SEARCH_SYNONYMS[word] ?? [])]
  const verb = INFINITIVE.exec(word)
  if (verb) out.push(`${verb[1]}${verb[2] === 'ar' ? 'ad' : 'id'}`)
  return out
}

const hasForm = (hay: string, forms: readonly string[]): boolean =>
  forms.some((f) => hay.includes(f))

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
  const forms = words.map(formsOf)
  const out: SearchResult[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const text = foldText(e.text)
    const near = `${text} ${foldText(e.context)}`
    const far = `${near} ${foldText(e.help)} ${foldText(pageTitle(e.page))}`
    if (!forms.every((f) => hasForm(far, f))) continue
    let score: number
    if (text.startsWith(whole)) score = 0
    else if (text.includes(whole)) score = 1
    else if (forms.every((f) => hasForm(text, f))) score = 2
    else if (forms.every((f) => hasForm(near, f))) score = 3
    else score = 5
    // A page or a section a little before a label with the same score; one that another
    // setting hides now a little after.
    if (e.kind === 'page' || e.kind === 'section') score -= 0.5
    if (e.gated === true) score += 0.25
    const key = `${e.page}\n${e.text}\n${e.context}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...e, score })
  }
  out.sort((a, b) => a.score - b.score || a.text.length - b.text.length)
  return out.slice(0, limit)
}

/**
 * A page's entries as it is (`shown`) and with everything that can show shown (`all`): the
 * first ones, then those only the second has, marked `gated`. Pure.
 */
export function mergeGated(
  shown: readonly SearchEntry[],
  all: readonly SearchEntry[]
): SearchEntry[] {
  const key = (e: SearchEntry): string => `${e.page}
${e.kind}
${e.text}
${e.context}`
  const have = new Set(shown.map(key))
  const out = [...shown]
  for (const e of all) {
    const k = key(e)
    if (have.has(k)) continue
    have.add(k)
    out.push({ ...e, gated: true })
  }
  return out
}

/** What a page holds that can be searched: the selectors and the kind of each. */
const HARVEST: readonly { selector: string; kind: SearchKind }[] = [
  { selector: '.st-section-title', kind: 'section' },
  { selector: '.acc-title', kind: 'zone' },
  { selector: '.st-label', kind: 'label' },
  { selector: '.ed-name', kind: 'item' },
  // Apariencia's styles, by their names («Limpio», «Compacto»).
  { selector: '.card-name', kind: 'item' }
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
      const row = el.closest('.st-row, .ed-row, .card')
      const help = row
        ? clean(row.querySelector('.st-help, .ed-hint, .card-hint')?.textContent)
        : ''
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
