/**
 * Every element of every "Personalizar" list is findable in the widgets as drawn: a `data-el`
 * of 'section.field.id' on what it draws (the settings window's preview hit-tests by it). Read
 * from the sources: a literal 'relative.columns.gap', or a template over the zone
 * ('relative.columns.${...}') for ids drawn in a loop; the info bars get theirs from InfoBar's
 * `zone`.
 */
import { describe, expect, it } from 'vitest'
import { INFO_BARS } from '@shared/infoBar'
import { CUSTOMIZE_ZONE_IDS, OPTION_SCHEMA, type OptionSpec } from '@shared/settingsSchema'

const SOURCES = import.meta.glob<string>(['./**/*.vue', '../ui/*.vue'], {
  query: '?raw',
  import: 'default',
  eager: true
})
const ALL = Object.values(SOURCES).join('\n')

const isBar = (section: string, field: string): boolean =>
  Object.entries(INFO_BARS).some(
    ([s, bars]) => s === section && bars.some(([f]) => (f as string) === field)
  )

describe('data-el on the widgets', () => {
  it('names every element of every zone (or the zone, for ids drawn in a loop)', () => {
    for (const zone of CUSTOMIZE_ZONE_IDS) {
      const [section, field] = zone.split('.') as [keyof typeof OPTION_SCHEMA, string]
      if (isBar(section, field)) continue
      const spec = (OPTION_SCHEMA[section] as Readonly<Record<string, OptionSpec>>)[field]
      if (spec?.kind !== 'elements') throw new Error(zone)
      for (const id of spec.ids) {
        const literal = ALL.includes(`"${zone}.${id}"`) || ALL.includes(`'${zone}.${id}'`)
        const looped = ALL.includes(`\`${zone}.\${`)
        expect(literal || looped, `${zone}.${id}`).toBe(true)
      }
    }
  })

  it('gives every info bar its zone', () => {
    for (const [section, bars] of Object.entries(INFO_BARS)) {
      for (const [field] of bars)
        expect(ALL, `${section}.${field}`).toContain(`zone="${section}.${field}"`)
    }
    const bar = SOURCES['../ui/InfoBar.vue'] ?? ''
    expect(bar).toContain(':data-el="itemEls[item.id]"')
  })
})
