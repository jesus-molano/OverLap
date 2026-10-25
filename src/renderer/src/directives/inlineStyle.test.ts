import { describe, expect, it } from 'vitest'
import { patchInline, type StyleTarget } from './inlineStyle'

function fakeTarget(): StyleTarget & { props: Map<string, string>; writes: string[] } {
  const props = new Map<string, string>()
  const writes: string[] = []
  return {
    props,
    writes,
    style: {
      setProperty: (k: string, v: string | null) => {
        writes.push(`set ${k}`)
        props.set(k, v ?? '')
      },
      removeProperty: (k: string) => {
        writes.push(`remove ${k}`)
        props.delete(k)
        return ''
      }
    }
  }
}

describe('patchInline', () => {
  it('writes every property on mount', () => {
    const el = fakeTarget()
    patchInline(el, null, { '--cls': '#ff0000', color: '#000000' })
    expect(Object.fromEntries(el.props)).toEqual({ '--cls': '#ff0000', color: '#000000' })
  })

  it('writes only the changed properties and removes stale ones', () => {
    const el = fakeTarget()
    const a = { '--cls': '#ff0000', '--cls-fg': '#000000', background: 'red' }
    patchInline(el, null, a)
    el.writes.length = 0
    patchInline(el, a, { '--cls': '#00ff00', '--cls-fg': '#000000' })
    expect(el.writes.sort()).toEqual(['remove background', 'set --cls'])
    expect(Object.fromEntries(el.props)).toEqual({ '--cls': '#00ff00', '--cls-fg': '#000000' })
  })

  it('does nothing for the same object', () => {
    const el = fakeTarget()
    const a = { '--cls': '#ff0000' }
    patchInline(el, null, a)
    el.writes.length = 0
    patchInline(el, a, a)
    expect(el.writes).toEqual([])
  })

  it('clears everything when the style goes away', () => {
    const el = fakeTarget()
    const a = { '--cls': '#ff0000', color: '#fff' }
    patchInline(el, null, a)
    patchInline(el, a, undefined)
    expect(el.props.size).toBe(0)
  })
})
