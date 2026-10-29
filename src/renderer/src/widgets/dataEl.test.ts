/**
 * Every element of every "Personalizar" list is findable in the widgets as drawn: a `data-el`
 * of 'section.field.id' on what it draws (the settings window's preview hit-tests by it). Read
 * from the templates as Vue parses them (an attribute of an element: never a comment or a
 * string elsewhere), in the widget's own folder and the shared ui: a literal
 * 'relative.columns.gap' (or a string of a bound one, or a DriverCell `*-el` prop), or a
 * template over the zone ('lights.icons.${...}') for ids drawn in a loop. A zone with literals
 * names each of its ids literally, so one cell losing its attribute fails even where a loop
 * draws the heads; no value names an element that is in no zone. The info bars get theirs from
 * InfoBar's `zone`; the traffic's groups their `data-group`.
 */
import { describe, expect, it } from 'vitest'
import { NodeTypes, type ElementNode, type TemplateChildNode } from '@vue/compiler-core'
import { parse } from 'vue/compiler-sfc'
import { ALERT_TOGGLES } from '@shared/alerts'
import { INFO_BARS } from '@shared/infoBar'
import { CUSTOMIZE_ZONE_IDS, OPTION_SCHEMA, type OptionSpec } from '@shared/settingsSchema'

const SOURCES = import.meta.glob<string>(['./**/*.vue', '../ui/*.vue'], {
  query: '?raw',
  import: 'default',
  eager: true
})

/** What one file's templates name: literal values, zones drawn in a loop, info bar zones. */
interface Names {
  readonly literal: Set<string>
  readonly looped: Set<string>
  readonly bars: Set<string>
}

const EL = /^[a-z]+\.[a-zA-Z]+\.[a-zA-Z]+$/
const IN_EXPRESSION = /['"]([a-z]+\.[a-zA-Z]+\.[a-zA-Z]+)['"]/g
const LOOP = /`([a-z]+\.[a-zA-Z]+)\.\$\{/g

function namesOf(source: string, file: string): Names {
  const names: Names = { literal: new Set(), looped: new Set(), bars: new Set() }
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length > 0) throw errors[0]
  const visit = (n: TemplateChildNode | ElementNode): void => {
    if (n.type !== NodeTypes.ELEMENT) return
    for (const p of n.props) {
      if (p.type === NodeTypes.ATTRIBUTE) {
        const value = p.value?.content ?? ''
        if (p.name === 'zone') names.bars.add(value)
        else if ((p.name === 'data-el' || p.name.endsWith('-el')) && EL.test(value))
          names.literal.add(value)
      } else if (
        p.type === NodeTypes.DIRECTIVE &&
        p.name === 'bind' &&
        p.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
        (p.arg.content === 'data-el' || p.arg.content === 'data-group') &&
        p.exp?.type === NodeTypes.SIMPLE_EXPRESSION
      ) {
        const exp = p.exp.content
        for (const m of exp.matchAll(IN_EXPRESSION)) if (m[1]) names.literal.add(m[1])
        for (const m of exp.matchAll(LOOP)) if (m[1]) names.looped.add(m[1])
      }
    }
    n.children.forEach(visit)
  }
  descriptor.template?.ast?.children.forEach(visit)
  return names
}

const FILES = Object.entries(SOURCES).map(([path, source]) => ({
  path,
  names: namesOf(source, path)
}))

/** The names in the files a section's widget is drawn from: its folder and the shared ui. */
function namesFor(section: string): Names {
  const out: Names = { literal: new Set(), looped: new Set(), bars: new Set() }
  for (const { path, names } of FILES) {
    if (!path.startsWith(`./${section}/`) && !path.startsWith('../ui/')) continue
    names.literal.forEach((v) => out.literal.add(v))
    names.looped.forEach((v) => out.looped.add(v))
    names.bars.forEach((v) => out.bars.add(v))
  }
  return out
}

const isBar = (section: string, field: string): boolean =>
  Object.entries(INFO_BARS).some(
    ([s, bars]) => s === section && bars.some(([f]) => (f as string) === field)
  )

function idsOf(zone: string): readonly string[] {
  const [section, field] = zone.split('.') as [keyof typeof OPTION_SCHEMA, string]
  const spec = (OPTION_SCHEMA[section] as Readonly<Record<string, OptionSpec>>)[field]
  if (spec?.kind !== 'elements') throw new Error(zone)
  return spec.ids
}

describe('data-el on the widgets', () => {
  it('names every element of every zone, in the widget that draws it', () => {
    for (const zone of CUSTOMIZE_ZONE_IDS) {
      const [section, field] = zone.split('.') as [string, string]
      if (isBar(section, field)) continue
      const names = namesFor(section)
      const literals = idsOf(zone).filter((id) => names.literal.has(`${zone}.${id}`))
      for (const id of idsOf(zone)) {
        const named = names.literal.has(`${zone}.${id}`)
        const looped = names.looped.has(zone) && literals.length === 0
        expect(named || looped, `${zone}.${id}`).toBe(true)
      }
    }
  })

  it('names nothing that is in no zone', () => {
    const known = new Set([
      ...CUSTOMIZE_ZONE_IDS.flatMap((z) => idsOf(z).map((id) => `${z}.${id}`)),
      // The alerts, a preview zone of their own (R12): stored as their switches, not as a list.
      ...ALERT_TOGGLES.map((k) => `alerts.alerts.${k}`)
    ])
    for (const { path, names } of FILES) {
      for (const v of names.literal) expect(known.has(v), `${path}: ${v}`).toBe(true)
      for (const z of names.looped)
        expect((CUSTOMIZE_ZONE_IDS as readonly string[]).includes(z), `${path}: ${z}`).toBe(true)
    }
  })

  it('gives every info bar its zone', () => {
    for (const [section, bars] of Object.entries(INFO_BARS)) {
      for (const [field] of bars)
        expect(namesFor(section).bars.has(`${section}.${field}`), `${section}.${field}`).toBe(true)
    }
    const bar = SOURCES['../ui/InfoBar.vue'] ?? ''
    expect(bar).toContain(':data-el="itemEls[item.id]"')
  })
})
