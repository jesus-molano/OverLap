import { describe, expect, it } from 'vitest'
import {
  CLASS_COLOR_FALLBACK,
  LICENSE_COLOR_FALLBACK,
  classVars,
  createDriverStyles,
  nameCache,
  styleCache
} from './styles'

describe('styleCache', () => {
  it('returns the same frozen object for the same colour', () => {
    const cls = styleCache(classVars)
    const a = cls('#ff0000')
    expect(cls('#ff0000')).toBe(a)
    expect(Object.isFrozen(a)).toBe(true)
    expect(a).toEqual({ '--cls': '#ff0000', '--cls-fg': '#000000' })
  })

  it('passes the contrasting text colour', () => {
    const cls = styleCache(classVars)
    expect(cls('#0153db')['--cls-fg']).toBe('#ffffff')
    expect(cls('#feec04')['--cls-fg']).toBe('#000000')
  })

  it('stays bounded', () => {
    let made = 0
    const s = styleCache((c) => {
      made++
      return { c }
    }, 4)
    for (let i = 0; i < 100; i++) s(`#00000${i % 10}`)
    // Past the bound it starts over, so entries are re-created instead of piling up.
    expect(made).toBeGreaterThan(10)
    const first = s('#000001')
    expect(s('#000001')).toBe(first)
  })
})

describe('createDriverStyles', () => {
  it('falls back for missing or malformed colours', () => {
    const st = createDriverStyles()
    expect(st.cls(null)['--cls']).toBe(CLASS_COLOR_FALLBACK)
    expect(st.cls('garbage')['--cls']).toBe(CLASS_COLOR_FALLBACK)
    expect(st.lic(null)['--lic']).toBe(LICENSE_COLOR_FALLBACK)
  })

  it('normalises case so equal colours share one object', () => {
    const st = createDriverStyles()
    expect(st.cls('#FF0000')).toBe(st.cls('#ff0000'))
  })

  it('gives near-black licences a visible soft colour', () => {
    const st = createDriverStyles()
    const pro = st.lic('#1f1f1f')
    expect(pro['--lic']).toBe('#1f1f1f')
    expect(pro['--lic-fg']).toBe('#ffffff')
    expect(pro['--lic-soft']).not.toBe('#1f1f1f')
    expect(st.lic('#0153db')['--lic-soft']).toBe('#0153db')
  })

  it('keeps separate caches per instance', () => {
    expect(createDriverStyles().cls('#ff0000')).not.toBe(createDriverStyles().cls('#ff0000'))
  })
})

describe('nameCache', () => {
  it('formats with the shared formatter, per format', () => {
    const name = nameCache()
    expect(name('Pierre-Étienne Duvalier', 'abbr')).toBe('P. Duvalier')
    expect(name('Pierre-Étienne Duvalier', 'full')).toBe('Pierre-Étienne Duvalier')
    expect(name('Zoë van der Berg', 'surname')).toBe('van der Berg')
    expect(name('Pierre-Étienne Duvalier', 'abbr')).toBe('P. Duvalier')
  })
})
