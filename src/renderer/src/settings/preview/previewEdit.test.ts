import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { elements } from '@shared/settingsSchema'
import type { CustomizeZoneId, ElementEntry } from '@shared/types'
import { defaults } from '../elements/listOps'
import {
  GHOST_ZONES,
  axisOf,
  canDrag,
  dropInBar,
  dropInLine,
  droppedList,
  elAction,
  ghostEls,
  ghostZones,
  isDragDistance,
  marksCss,
  parseEl,
  pickEl,
  sameEl,
  sideBoundary,
  union,
  withGhosts,
  type BarBoxes,
  type Box,
  type Slot
} from './previewEdit'

const box = (left: number, top: number, w: number, h: number): Box => ({
  left,
  top,
  right: left + w,
  bottom: top + h
})
const list = (ids: string, hidden = ''): ElementEntry<string>[] =>
  ids.split(' ').map((id) => ({ id, visible: !hidden.split(' ').includes(id) }))
const ids = (l: readonly ElementEntry<string>[]): string =>
  l.map((e) => (e.visible ? e.id : `(${e.id})`)).join(' ')

describe('hit-testing by data-el', () => {
  it('reads a data-el into its zone and id', () => {
    expect(parseEl('relative.headerBar.sof')).toEqual({ zone: 'relative.headerBar', id: 'sof' })
    expect(parseEl('standings.columns.gapLeader')).toEqual({
      zone: 'standings.columns',
      id: 'gapLeader'
    })
    for (const bad of ['relative.columns', 'a.b.c.d', '', null, undefined, 'x.y.1']) {
      expect(parseEl(bad), String(bad)).toBeNull()
    }
  })

  it('takes the innermost element of a zone with an editor, else the next one out', () => {
    const chain = ['delta.top.state', 'delta.rows.top']
    const all = (): boolean => true
    expect(pickEl(chain, all)).toEqual({ zone: 'delta.top', id: 'state' })
    expect(pickEl(chain, (z) => z === 'delta.rows')).toEqual({ zone: 'delta.rows', id: 'top' })
    expect(pickEl(chain, () => false)).toBeNull()
    expect(pickEl([null, 'nonsense', 'fuel.lines.hero'], all)).toEqual({
      zone: 'fuel.lines',
      id: 'hero'
    })
  })

  it('compares elements by zone and id', () => {
    const a = { zone: 'fuel.lines' as CustomizeZoneId, id: 'hero' }
    expect(sameEl(a, { ...a })).toBe(true)
    expect(sameEl(a, { ...a, id: 'gauge' })).toBe(false)
    expect(sameEl(null, null)).toBe(true)
    expect(sameEl(a, null)).toBe(false)
  })
})

describe('what a click and a drag may do', () => {
  type Id = 'a' | 'b' | 'c'
  const SPEC = elements<Id>(['a', 'b', 'c'], { required: ['b'], hidden: ['c'] })
  const FIXED = elements<Id>(['a', 'b', 'c'], { required: ['b'], fixedOrder: true })

  it('moves and hides; never hides a required one; shows a ghost', () => {
    const l = defaults(SPEC)
    expect(elAction(SPEC, l, 'a')).toBe('move-hide')
    expect(elAction(SPEC, l, 'b')).toBe('move-required')
    expect(elAction(SPEC, l, 'c')).toBe('show')
    expect(elAction(FIXED, defaults(FIXED), 'a')).toBe('hide')
    expect(elAction(FIXED, defaults(FIXED), 'b')).toBe('required')
    expect(['move-hide', 'move-required', 'show'].every((a) => canDrag(a as never))).toBe(true)
    expect(canDrag('hide')).toBe(false)
    expect(canDrag('required')).toBe(false)
  })

  it('is a drag past a few pixels only', () => {
    expect(isDragDistance(2, 2)).toBe(false)
    expect(isDragDistance(4, 0)).toBe(true)
    expect(isDragDistance(-3, -3)).toBe(true)
  })
})

describe('drops in a line of elements', () => {
  // Three columns across: a | b | c, each 40 px wide, two rows of cells (the union is the column).
  const cols: Slot[] = ['a', 'b', 'c'].map((id, i) => ({
    id,
    box: union([box(i * 50, 0, 40, 20), box(i * 50, 20, 40, 20)]) as Box
  }))

  it('unites every copy an element draws and finds the axis', () => {
    expect(cols[0]?.box).toEqual(box(0, 0, 40, 40))
    expect(axisOf(cols)).toBe('x')
    const lines: Slot[] = ['a', 'b'].map((id, i) => ({ id, box: box(0, i * 30, 200, 24) }))
    expect(axisOf(lines)).toBe('y')
    expect(axisOf([])).toBe('x')
    expect(union([])).toBeNull()
  })

  it('lands before the first centre past the pointer, after the last at the end', () => {
    // 'c' dragged to the far left: before 'a'; the line just left of 'a', the columns' height.
    const first = dropInLine(cols, 'c', -5, 10)
    expect(first?.place).toEqual({ kind: 'before', id: 'a' })
    expect(first?.line.top).toBe(0)
    expect(first?.line.bottom).toBe(40)
    expect(first?.line.right).toBeLessThanOrEqual(0)
    // 'a' dragged between b and c: before c; the line halfway between them.
    const mid = dropInLine(cols, 'a', 85, 10)
    expect(mid?.place).toEqual({ kind: 'before', id: 'c' })
    expect(((mid?.line.left ?? 0) + (mid?.line.right ?? 0)) / 2).toBe(95)
    // Past the end: after the last of the others.
    expect(dropInLine(cols, 'a', 500, 10)?.place).toEqual({ kind: 'after', id: 'c' })
    // Alone in its zone: nowhere to go.
    expect(dropInLine([cols[0] as Slot], 'a', 10, 10)).toBeNull()
  })

  it('goes down a stack of lines', () => {
    const lines: Slot[] = ['a', 'b', 'c'].map((id, i) => ({ id, box: box(0, i * 30, 200, 24) }))
    const d = dropInLine(lines, 'a', 50, 70)
    expect(d?.place).toEqual({ kind: 'before', id: 'c' })
    expect(d?.line.left).toBe(0)
    expect(d?.line.right).toBe(200)
  })

  it('turns a drop into the list, unchanged as null', () => {
    const SPEC = elements<string>(['a', 'b', 'c', 'd'], {})
    const l = list('a b c d', 'b')
    expect(ids(droppedList(SPEC, l, 'd', { kind: 'before', id: 'a' }) ?? [])).toBe('d a (b) c')
    // Hidden entries between two shown ones never matter: after 'a' keeps 'b' where it was.
    expect(ids(droppedList(SPEC, l, 'd', { kind: 'after', id: 'a' }) ?? [])).toBe('a d (b) c')
    expect(droppedList(SPEC, l, 'a', { kind: 'before', id: 'b' })).toBeNull()
    expect(
      droppedList(elements<string>(['a', 'b'], { fixedOrder: true }), list('a b'), 'b', {
        kind: 'before',
        id: 'a'
      })
    ).toBeNull()
  })
})

describe('drops in an info bar', () => {
  // A bar 0..400; left items x 10..60 (s, t), right items x 300..390 (i).
  const bar: BarBoxes = {
    bar: box(0, 0, 400, 20),
    left: box(10, 2, 100, 16),
    right: box(300, 2, 90, 16)
  }
  const slots: Slot[] = [
    { id: 's', box: box(10, 2, 40, 16), side: 'left' },
    { id: 't', box: box(60, 2, 50, 16), side: 'left' },
    { id: 'i', box: box(300, 2, 90, 16), side: 'right' }
  ]

  it('splits the bar halfway between its groups', () => {
    expect(sideBoundary(bar)).toBe(205)
    expect(sideBoundary({ ...bar, right: null })).toBe(255)
    expect(sideBoundary({ ...bar, right: box(400, 0, 0, 0) })).toBe(255)
    expect(sideBoundary({ ...bar, left: null })).toBe(150)
    expect(sideBoundary({ bar: bar.bar, left: null, right: null })).toBe(200)
  })

  it('lands on the side the pointer is on, among its items', () => {
    const toRight = dropInBar(slots, bar, 's', 'split', 290)
    expect(toRight.side).toBe('right')
    expect(toRight.place).toEqual({ kind: 'before', id: 'i' })
    const end = dropInBar(slots, bar, 's', 'split', 399)
    expect(end.place).toEqual({ kind: 'after', id: 'i' })
    const back = dropInBar(slots, bar, 'i', 'split', 20)
    expect(back.side).toBe('left')
    expect(back.place).toEqual({ kind: 'before', id: 's' })
    expect(dropInBar(slots, bar, 'i', 'split', 80).place).toEqual({ kind: 'before', id: 't' })
  })

  it('goes to its end of the marker on a side with nothing drawn', () => {
    const one: Slot[] = [{ id: 's', box: box(10, 2, 40, 16), side: 'left' }]
    const r = dropInBar(one, { ...bar, right: null }, 's', 'split', 380)
    expect(r.place).toEqual({ kind: 'after', id: 'split' })
    expect(r.line.right).toBeGreaterThan(390)
    const l = dropInBar([{ ...one[0], side: 'right' } as Slot], bar, 's', 'split', 5)
    expect(l.place).toEqual({ kind: 'before', id: 'split' })
    const SPEC = elements<string>(['s', 'split', 'i'], {})
    expect(ids(droppedList(SPEC, list('s split i'), 's', r.place) ?? [])).toBe('split s i')
  })
})

describe('ghosts', () => {
  const relative = DEFAULT_SETTINGS.relative as unknown as Readonly<Record<string, unknown>>

  it('ghosts the info bars that are shown and the line stacks, never a table', () => {
    expect(GHOST_ZONES.has('relative.headerBar')).toBe(true)
    expect(GHOST_ZONES.has('fuel.lines')).toBe(true)
    expect(GHOST_ZONES.has('relative.columns')).toBe(false)
    expect(GHOST_ZONES.has('standings.columns')).toBe(false)
    const on = { ...relative, headerBarSize: 'normal', footerBarSize: 'off' }
    expect(ghostZones('relative', on)).toEqual(['relative.headerBar'])
    expect(ghostZones('relative', { ...on, headerBarSize: 'off' })).toEqual([])
    expect(ghostZones('delta', on)).toEqual([])
  })

  it('draws the hidden elements as shown, and names them (never the side marker)', () => {
    const o = {
      headerBar: list('title split sof clock', 'clock split'),
      headerBarSize: 'normal',
      footerBar: list('rubber'),
      footerBarSize: 'normal'
    }
    const g = withGhosts(o, ['relative.headerBar'])
    expect(g.ghosts).toEqual(['relative.headerBar.clock'])
    expect(g.options.headerBar.every((e) => e.visible)).toBe(true)
    expect(g.options.footerBar).toBe(o.footerBar)
    expect(o.headerBar.find((e) => e.id === 'clock')?.visible).toBe(false)
    expect(withGhosts(o, []).options).toBe(o)
    expect(ghostEls('relative', o)).toEqual(['relative.headerBar.clock'])
    // Nothing hidden but the marker: nothing to ghost.
    expect(ghostZones('relative', { ...o, headerBar: list('title split', 'split') })).toEqual([])
  })
})

describe('the sample stylesheet', () => {
  const S = '[data-pe="x"]'
  it('ghosts, outlines and fades by attribute, scoped', () => {
    const css = marksCss(S, {
      hover: { zone: 'relative.columns', id: 'gap' },
      lit: { zone: 'relative.columns', id: 'gap' },
      dragged: { zone: 'fuel.lines', id: 'hero' },
      ghosts: ['relative.headerBar.clock']
    })
    expect(css).toContain(`${S} [data-el="relative.headerBar.clock"] {`)
    expect(css).toContain('outline: 1px dashed')
    expect(css).toContain('opacity: 0.42')
    // One rule for the hovered and lit element when they are the same.
    expect(css.match(/relative\.columns\.gap/g)?.length).toBe(1)
    expect(css).toContain(`${S} [data-el="fuel.lines.hero"] {\n  opacity: 0.3;`)
    expect(marksCss(S, { hover: null, lit: null, dragged: null, ghosts: [] })).toBe('')
  })

  it('skips anything that is not a plain data-el', () => {
    const css = marksCss(S, {
      hover: { zone: 'relative.columns', id: 'x"]{}' },
      lit: null,
      dragged: null,
      ghosts: ['a.b.c"] , body {']
    })
    expect(css).toBe('')
  })
})
