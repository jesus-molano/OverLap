/**
 * Runtime checks over every dictionary (core, widgets, settings) in every
 * language. The `Dict` type already rejects a missing key or a wrong kind at
 * build time; this walks the real objects to catch what types cannot: an
 * empty text, a function that drops one of its values or returns nothing,
 * and English entries still in Spanish.
 */
import { describe, expect, it } from 'vitest'
import { WIDGET_IDS } from '../widgets'
import { LANGUAGES, messagesFor, type Messages } from './index'

type Fn = (...args: unknown[]) => unknown

interface Leaf {
  path: string
  /** 'string', 'function/<arity>' or 'array/<length>'. */
  kind: string
  /** The text, or a function's result for MARKERS. */
  text: string
  fn: Fn | null
}

/** Distinct sample values: each must show up in the text of a function given it. */
const MARKERS = ['#0#', '#1#', '#2#', '#3#']

function walk(node: unknown, path: string, out: Leaf[]): Leaf[] {
  if (typeof node === 'string') {
    out.push({ path, kind: 'string', text: node, fn: null })
  } else if (typeof node === 'function') {
    const fn = node as Fn
    const text = fn(...MARKERS.slice(0, fn.length))
    out.push({ path, kind: `function/${fn.length}`, text: String(text), fn })
  } else if (Array.isArray(node)) {
    out.push({ path, kind: `array/${node.length}`, text: '', fn: null })
    node.forEach((v, i) => walk(v, `${path}[${i}]`, out))
  } else if (typeof node === 'object' && node !== null) {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, out)
  } else {
    out.push({ path, kind: typeof node, text: '', fn: null })
  }
  return out
}

function leavesOf(m: Messages): Leaf[] {
  return walk(m, '', [])
}

const es = leavesOf(messagesFor('es'))
const en = leavesOf(messagesFor('en'))
const enByPath = new Map(en.map((l) => [l.path, l]))
const byLanguage = LANGUAGES.map((lang) => [lang, leavesOf(messagesFor(lang))] as const)

/**
 * Texts that are '' on purpose: an alert's (flag or other) short label, note and chip
 * ('' = the label fits / says it all / is the chip). Nothing else may be empty.
 */
const MAY_BE_EMPTY = /^widgets\.alerts\.(flags|notices)\.\w+\.(short|note|chip)$/

describe('dictionaries', () => {
  it('have the same shape in every language at runtime', () => {
    const shape = (leaves: readonly Leaf[]): string[] =>
      leaves.map((l) => `${l.path}: ${l.kind}`).sort()
    for (const [, leaves] of byLanguage) expect(shape(leaves)).toEqual(shape(es))
    // Only texts and text functions: no number, boolean or null slipped in.
    for (const [, leaves] of byLanguage) {
      const odd = leaves.filter((l) => !/^(string|function\/\d+|array\/\d+)$/.test(l.kind))
      expect(odd.map((l) => `${l.path}: ${l.kind}`)).toEqual([])
    }
  })

  it('have no empty text', () => {
    for (const [lang, leaves] of byLanguage) {
      const empty = leaves
        .filter((l) => l.kind === 'string' && l.text.trim() === '' && !MAY_BE_EMPTY.test(l.path))
        .map((l) => `${lang} ${l.path}`)
      expect(empty).toEqual([])
    }
  })

  it('keep the same leading and trailing spaces in every language (texts are joined)', () => {
    const edges = (s: string): string => `${/^\s/.test(s)}|${/\s$/.test(s)}`
    const differ = es
      .filter((l) => l.kind === 'string' && l.text !== '')
      .filter((l) => {
        const other = enByPath.get(l.path)
        return other !== undefined && other.text !== '' && edges(other.text) !== edges(l.text)
      })
      .map((l) => l.path)
    expect(differ).toEqual([])
  })

  it('have functions that return a non-empty string with every value they get', () => {
    const samples: unknown[][] = [
      MARKERS,
      [1, 1, 1, 1],
      [7, 3, 19, 2],
      [0, 0, 0, 0],
      ['X', 2, 2, 2]
    ]
    for (const [lang, leaves] of byLanguage) {
      for (const leaf of leaves) {
        if (!leaf.fn) continue
        const arity = leaf.fn.length
        expect(arity, `${lang} ${leaf.path}`).toBeGreaterThan(0)
        for (const args of samples) {
          const out = leaf.fn(...args.slice(0, arity))
          expect(typeof out, `${lang} ${leaf.path}`).toBe('string')
          expect((out as string).trim(), `${lang} ${leaf.path}`).not.toBe('')
        }
        // No value silently dropped (a plural's singular may spell out its 1, never a marker).
        const missing = MARKERS.slice(0, arity).filter((mk) => !leaf.text.includes(mk))
        expect(missing, `${lang} ${leaf.path}: ${leaf.text}`).toEqual([])
      }
    }
  })

  it('name every widget in every language', () => {
    for (const lang of LANGUAGES) {
      const titles = messagesFor(lang).core.widgetTitles
      expect(Object.keys(titles).sort()).toEqual([...WIDGET_IDS].sort())
    }
  })
})

/**
 * The only entries English may keep exactly as in Spanish: names, codes, units,
 * pure templates and words both languages share. Anything else identical is a
 * text nobody translated.
 */
const SAME_IN_ENGLISH = new Set([
  'core.appName',
  // 'No' reads the same in both.
  'settings.infoBar.sizeChoices.off.label',
  'settings.lights.captionsChoices.off.label',
  'core.widgetTitles.radar',
  'core.widgetTitles.delta',
  'core.tray.rangeMeters',
  'core.tray.widgetHidden',
  'core.tray.tooltip',
  'core.tray.tooltipAutoHidden',
  'core.editFrame.autoHeight',
  'core.keys.numpad',
  'widgets.common.sim',
  'widgets.common.pit',
  'widgets.common.out',
  'widgets.common.sector',
  'widgets.session.warmup',
  'widgets.standings.sof',
  'widgets.standings.irKey',
  'widgets.standings.srKey',
  'widgets.standings.perPosition',
  'widgets.standings.incidents',
  'widgets.incidents.count',
  'widgets.incidents.added',
  // Column headers: codes and the international shorthand.
  'widgets.heads.pos',
  'widgets.heads.gained',
  'widgets.heads.ir',
  'widgets.heads.sr',
  'widgets.heads.delta',
  'widgets.heads.stint',
  'widgets.delta.refMark',
  // '#9 1:01.234': the car number and the time, no words.
  'widgets.info.fastestLap',
  'widgets.countries.XK',
  'settings.zones.alerts.parts',
  'settings.items.relative.columns.ir',
  'settings.items.standings.classLine.sof',
  'settings.items.traffic.parts.sector',
  'settings.infoBar.items.sof',
  'settings.infoBar.sizeChoices.normal.label',
  'settings.driverCell.brandChoices.auto.label',
  'widgets.battle.stake',
  'widgets.inputs.abs',
  'widgets.inputs.car.rpm',
  'widgets.inputs.car.bias',
  'widgets.inputs.car.tc',
  'widgets.inputs.car.ffb',
  'widgets.lights.seconds',
  'widgets.lights.realSeconds',
  'widgets.lights.realSecondsShort',
  'settings.nav.widgets',
  'settings.visibility.label',
  'settings.common.iRating',
  'settings.choices.nameFormat.tv',
  'settings.choices.inherit',
  'settings.appearance.text.haloChoices.auto.label',
  'settings.appearance.rows.numberChoices.chip.label',
  'settings.appearance.other.unitChoices.metric.hint',
  'settings.appearance.other.unitChoices.imperial.hint',
  'settings.widgetPage.visible',
  'settings.columns.labels.ir',
  'settings.columns.labels.delta'
])

/** Letters and punctuation English never uses ('«Ganando»', '¿Seguro?', 'vuelta inválida'). */
const SPANISH_CHARS = /[áéíóúüñ¿¡«»]/i

/** Spanish function words and the app's own Spanish vocabulary, as whole words. */
const SPANISH_WORDS = [
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'en',
  'con',
  'sin',
  'para',
  'por',
  'una',
  'uno',
  'que',
  'tu',
  'tus',
  'su',
  'sus',
  'al',
  'y',
  'o',
  'es',
  'se',
  'le',
  'te',
  'muy',
  'vuelta',
  'vueltas',
  'coche',
  'coches',
  'ajustes',
  'clase',
  'carrera',
  'boxes',
  'bandera',
  'oculto',
  'oculta',
  'mostrar',
  'ocultar',
  'piloto',
  'ritmo',
  'hueco',
  'alcance',
  'ventana',
  'modo',
  'esperando',
  'iniciando',
  'conectado',
  'simulado',
  'ninguno',
  'ambos',
  'siempre',
  'nunca',
  'fijo',
  'libre',
  'abajo',
  'arriba',
  'borrar',
  'pulsa',
  'otra',
  'vez',
  'buscar',
  'cargando',
  'filas',
  'apariencia',
  'idioma',
  'escala',
  'alto',
  'ancho',
  'delante',
  'mejor',
  'peligro',
  'avisos',
  'pedales',
  'batalla',
  'relativo',
  'parado',
  'lento',
  'fuera',
  'ganando',
  'perdiendo',
  'midiendo',
  'estable',
  'quedan',
  'queda',
  'margen',
  'neutro'
]
const SPANISH_WORD = new RegExp(`(?<!\\p{L})(${SPANISH_WORDS.join('|')})(?!\\p{L})`, 'iu')

function spanishIn(text: string): string | null {
  return text.match(SPANISH_CHARS)?.[0] ?? text.match(SPANISH_WORD)?.[0] ?? null
}

describe('English dictionary', () => {
  it('translates every text but names, codes and units', () => {
    const same = es
      .filter((l) => l.text !== '' && enByPath.get(l.path)?.text === l.text)
      .filter((l) => !SAME_IN_ENGLISH.has(l.path))
      .map((l) => `${l.path} = ${JSON.stringify(l.text)}`)
    expect(same).toEqual([])
  })

  it('differs from Spanish in the vast majority of entries', () => {
    const texts = es.filter((l) => l.text !== '')
    const same = texts.filter((l) => enByPath.get(l.path)?.text === l.text)
    expect(texts.length).toBeGreaterThan(400)
    expect(same.length / texts.length).toBeLessThan(0.1)
  })

  it('lists only entries that exist', () => {
    const paths = new Set(es.map((l) => l.path))
    expect([...SAME_IN_ENGLISH].filter((p) => !paths.has(p))).toEqual([])
  })

  it('has no text left in Spanish (accents, ¿ ¡ « », Spanish words)', () => {
    const spanish = en
      .map((l) => [l, spanishIn(l.text)] as const)
      .filter(([, hit]) => hit !== null)
      .map(([l, hit]) => `${l.path}: ${JSON.stringify(hit)} in ${JSON.stringify(l.text)}`)
    expect(spanish).toEqual([])
  })

  it('uses a detector that does recognise Spanish (control: the Spanish texts)', () => {
    const sentences = es.filter((l) => l.text.length > 12 && !SAME_IN_ENGLISH.has(l.path))
    const caught = sentences.filter((l) => spanishIn(l.text) !== null)
    expect(caught.length / sentences.length).toBeGreaterThan(0.9)
  })

  it('writes percentages without the Spanish space and quotes the English way', () => {
    const odd = en
      .filter((l) => /[\s\u00a0]%/.test(l.text) || /[«»]/.test(l.text))
      .map((l) => `${l.path}: ${JSON.stringify(l.text)}`)
    expect(odd).toEqual([])
  })
})

describe('Spanish dictionary', () => {
  it('quotes with « » and has no English curly quotes or apostrophes', () => {
    const odd = es
      .filter((l) => /[“”‘’]/.test(l.text))
      .map((l) => `${l.path}: ${JSON.stringify(l.text)}`)
    expect(odd).toEqual([])
  })
})

describe('glossary (one name per concept)', () => {
  /** Names a concept had besides its one name, per language. */
  const RETIRED: Readonly<Record<'es' | 'en', readonly RegExp[]>> = {
    es: [/Mejor de (la |tu )?clase/i, /Δ iRating/, /iRating proyectado/, /Cabeceras de columna/],
    en: [/Class best/i, /Δ iRating/, /Projected iRating/, /Column headers/]
  }

  for (const [lang, leaves] of [
    ['es', es],
    ['en', en]
  ] as const) {
    it(`${lang}: says each concept one way`, () => {
      for (const l of leaves) {
        for (const re of RETIRED[lang]) expect(l.text, l.path).not.toMatch(re)
      }
    })
  }
})
