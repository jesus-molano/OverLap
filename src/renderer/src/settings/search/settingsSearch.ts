/**
 * «Buscar ajuste» (R33): every setting of every page, found by its words, and revealed where it
 * is (its accordion opened, scrolled to, pointed out). The index is harvested from the pages as
 * they render (SearchIndexer.vue), so it always names what the page shows, in its language.
 */
import type { SettingsPage } from '../nav'
import { foldText } from '../personalBests'

/**
 * What a result is: a page, a section's title, a control's label, an accordion, a list item, one
 * option of a segmented control («Imperiales» of Unidades) or an action button («Exportar todo…»).
 */
export type SearchKind = 'page' | 'section' | 'zone' | 'label' | 'item' | 'option' | 'action'

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

/**
 * Words a query has that never tell a setting apart (folded): «por coche» looks for «coche».
 * Kept when the query is only these.
 */
const STOP_WORDS: ReadonlySet<string> = new Set(
  'a al con de del el en la las lo los o para por un una y an and by for in of on or the to with'.split(
    ' '
  )
)

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
  shadow: ['outline'],
  // Bigger text: the widgets' text size first, then this window's and the 10 px minimum.
  grande: ['tamano del texto', 'tamano de esta ventana'],
  agrandar: ['tamano del texto', 'tamano de esta ventana'],
  bigger: ['text size', 'size of this window'],
  larger: ['text size', 'size of this window'],
  big: ['text size', 'size of this window'],
  large: ['text size', 'size of this window'],
  // Units by what they measure: «galones» finds «Imperiales» of Unidades.
  galon: ['imperiales', 'unidades'],
  galones: ['imperiales', 'unidades'],
  litro: ['metricas', 'unidades'],
  litros: ['metricas', 'unidades'],
  pies: ['imperiales', 'unidades'],
  millas: ['imperiales', 'unidades'],
  gallon: ['imperial', 'units'],
  gallons: ['imperial', 'units'],
  liters: ['metric', 'units'],
  litres: ['metric', 'units'],
  feet: ['imperial', 'units'],
  miles: ['imperial', 'units'],
  ingles: ['english'],
  spanish: ['espanol'],
  // The shift lights by what they show.
  rpm: ['luces de cambio', 'shift lights'],
  revoluciones: ['luces de cambio', 'shift lights'],
  // Moving a widget: each page's «Editar posición» and edit mode.
  mover: ['editar posicion', 'modo edicion'],
  move: ['edit position', 'edit mode'],
  // A copy of everything: «Exportar todo…» of Acerca de.
  copia: ['exportar todo'],
  backup: ['exportar todo', 'export all'],
  // «Banderas de penalización» by the other word for them.
  sancion: ['penalizacion'],
  sanciones: ['penalizacion'],
  penalties: ['penalty'],
  // A key or a wheel button: the actions of Atajos.
  tecla: ['atajo'],
  teclas: ['atajo'],
  teclado: ['atajo'],
  boton: ['atajo'],
  botones: ['atajo'],
  mando: ['atajo'],
  hotkey: ['shortcut'],
  hotkeys: ['shortcut'],
  keybind: ['shortcut'],
  key: ['shortcut'],
  keys: ['shortcut'],
  button: ['shortcut'],
  buttons: ['shortcut'],
  automatico: ['segun el coche'],
  // The spotter by what it shows: the cars at your sides.
  lateral: ['spotter'],
  laterales: ['spotter'],
  costado: ['spotter'],
  alongside: ['spotter']
}

/**
 * Everyday phrases for a setting named otherwise (folded), each found as one word: «por coche»
 * finds «Según el coche» first, «botón del volante» the actions of Atajos.
 */
export const SEARCH_PHRASES: Readonly<Record<string, readonly string[]>> = {
  'por coche': ['segun el coche', 'by car'],
  'cada coche': ['segun el coche', 'by car'],
  'per car': ['by car', 'segun el coche'],
  'each car': ['by car', 'segun el coche'],
  'cambio de marcha': ['luces de cambio', 'shift lights'],
  'cambiar de marcha': ['luces de cambio', 'shift lights'],
  'gear change': ['shift lights', 'luces de cambio'],
  'boton del volante': ['atajo', 'shortcut'],
  'botones del volante': ['atajo', 'shortcut'],
  'boton volante': ['atajo', 'shortcut'],
  'button box': ['shortcut', 'atajo'],
  'wheel button': ['shortcut', 'atajo'],
  'angulo muerto': ['spotter'],
  'coche al lado': ['spotter'],
  'blind spot': ['spotter'],
  'side by side': ['spotter'],
  'car left right': ['spotter']
}

/** The longest phrase SEARCH_PHRASES knows, in words. */
const PHRASE_WORDS = 3

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

/**
 * The query as what each part finds: a known phrase (SEARCH_PHRASES) as one part, then each other
 * word that tells a setting apart (STOP_WORDS left out, unless the query has nothing else).
 */
function partsOf(words: readonly string[]): (readonly string[])[] {
  const parts: (readonly string[])[] = []
  const rest: string[] = []
  let i = 0
  while (i < words.length) {
    let took = 0
    for (let n = Math.min(PHRASE_WORDS, words.length - i); n >= 2 && took === 0; n--) {
      const phrase = words.slice(i, i + n).join(' ')
      const forms = SEARCH_PHRASES[phrase]
      if (forms) {
        parts.push([phrase, ...forms])
        took = n
      }
    }
    if (took === 0) rest.push(words[i] ?? '')
    i += Math.max(1, took)
  }
  const telling = rest.filter((w) => !STOP_WORDS.has(w))
  for (const w of telling.length > 0 || parts.length > 0 ? telling : rest) parts.push(formsOf(w))
  return parts
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
  const forms = partsOf(words)
  // A phrase alone: what it stands for counts as the whole query («por coche»: «Según el coche»).
  const wholes = forms.length === 1 && words.length > 1 ? (forms[0] ?? [whole]) : [whole]
  const out: SearchResult[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    const text = foldText(e.text)
    const near = `${text} ${foldText(e.context)}`
    const far = `${near} ${foldText(e.help)} ${foldText(pageTitle(e.page))}`
    if (!forms.every((f) => hasForm(far, f))) continue
    let score: number
    if (wholes.some((w) => text.startsWith(w))) score = 0
    else if (wholes.some((w) => text.includes(w))) score = 1
    else if (forms.every((f) => hasForm(text, f))) score = 2
    else if (forms.every((f) => hasForm(near, f))) score = 3
    // Some of the words in its name, the rest in its help: before one that has them only there.
    else if (forms.some((f) => hasForm(text, f))) score = 4
    else score = 5
    // A page or a section a little before a label with the same score; one that another
    // setting hides now a little after.
    if (e.kind === 'page' || e.kind === 'section') score -= 0.5
    // An option or a button a little after a label with the same score: the setting first.
    if (e.kind === 'option' || e.kind === 'action') score += 0.5
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

/** A segmented control's option. */
const OPTION_SELECTOR = '.st-seg-text'
/**
 * The buttons a page acts with («Exportar todo…», «Editar posición», «Restablecer…»): not an
 * icon, a form's submit, a part count that changes with every click or one marked data-nofind (a
 * list's own «Restablecer», a link to a setting found by its own name).
 */
const ACTION_SELECTOR =
  'button.st-btn:not(.st-btn-icon):not(.ed-parts-btn):not([type="submit"]):not([data-nofind])'

/** What a page holds that can be searched: the selectors and the kind of each. */
const HARVEST: readonly { selector: string; kind: SearchKind }[] = [
  { selector: '.st-section-title', kind: 'section' },
  { selector: '.acc-title', kind: 'zone' },
  { selector: '.st-label', kind: 'label' },
  { selector: '.ed-name', kind: 'item' },
  // Apariencia's styles, by their names («Limpio», «Compacto»).
  { selector: '.card-name', kind: 'item' },
  { selector: OPTION_SELECTOR, kind: 'option' },
  { selector: ACTION_SELECTOR, kind: 'action' }
]

/** Options every control has, which tell no setting apart (folded): «Sí», «No», «Global (…)». */
const PLAIN_OPTION = /^(si|no|yes|global\b.*)$/

/** Whether an option is one of those every control has (PLAIN_OPTION). Pure. */
export const isPlainOption = (text: string): boolean => PLAIN_OPTION.test(foldText(text))

/** The selectors a result is looked for with on its page (reveal). */
export const REVEAL_SELECTOR = HARVEST.map((h) => h.selector).join(', ')

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim()

/**
 * Where a result is, as the line under it says: the accordion or section, and for an option the
 * control too («Unidades»). The same for the harvest and for finding it again (reveal).
 */
export function placeOf(el: Element): string {
  const base = contextOf(el)
  if (!el.matches(OPTION_SELECTOR)) return base
  const row = el.closest('.st-row, .ed-row')
  const control = clean(row?.querySelector('.st-label, .ed-name')?.textContent)
  if (control === '') return base
  return base === '' ? control : `${base} › ${control}`
}

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
  // The page's description («Teclas o botones del volante…»): «tecla» finds the page.
  const sub = clean(root.querySelector('.page-sub')?.textContent)
  const out: SearchEntry[] = [{ page, kind: 'page', text: title, context: '', help: sub }]
  for (const h of HARVEST) {
    for (const el of root.querySelectorAll(h.selector)) {
      const text = clean(el.textContent)
      if (text === '' || text.length > 80) continue
      if (h.kind === 'option' && isPlainOption(text)) continue
      const row = el.closest('.st-row, .ed-row, .card')
      let help = row ? clean(row.querySelector('.st-help, .ed-hint, .card-hint')?.textContent) : ''
      if (h.kind === 'option' || h.kind === 'action') {
        // An option's hint («mph, °F, galones, pies»), a button's title: «galones» finds it.
        const own = clean(el.closest('.st-seg-item, button')?.getAttribute('title'))
        help = [own, help].filter((x) => x !== '').join(' ')
      }
      out.push({
        page,
        kind: h.kind,
        text,
        context: h.kind === 'section' ? '' : placeOf(el),
        help
      })
    }
  }
  return out
}
