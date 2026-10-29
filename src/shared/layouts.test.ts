import { describe, expect, it } from 'vitest'
import {
  LAYOUT_FILE_FORMAT,
  LAYOUT_FILE_VERSION,
  MAX_LAYOUTS,
  MAX_LAYOUT_FILE_BYTES,
  MAX_LAYOUT_NAME,
  applyLayout,
  canDeleteLayout,
  deleteLayout,
  duplicateLayout,
  importLayout,
  layoutFileName,
  layoutFileText,
  layoutName,
  linkCar,
  linkableCars,
  linkedLayoutId,
  moveLayout,
  nextLayoutAfterActive,
  nextLayoutId,
  noteSeenCar,
  parseLayoutFile,
  recentLayouts,
  renameLayout,
  saveLayoutAs,
  sharedOptions,
  snapshotWidgets,
  sortLayouts,
  uniqueLayoutName,
  type LayoutImportFallback
} from './layouts'
import { SETTINGS_VERSION, createDefaultSettings, normalizeSettings } from './settings'
import { LAYOUT_SECTIONS } from './settingsSchema'
import { MAX_SEEN_CARS } from './settings/layouts'
import type { LayoutSort, OverlaySettings, SavedLayout } from './types'
import { WIDGET_DEFS, WIDGET_IDS } from './widgets'

const MAZDA = { carId: 67, carName: 'Mazda MX-5 Cup' }
const GT3 = { carId: 132, carName: 'Porsche 911 GT3 R (992)' }

/** Settings as main keeps them: every change normalised (the active layout = the widgets). */
function change(s: OverlaySettings, mutate: (d: OverlaySettings) => void): OverlaySettings {
  const draft = structuredClone(s)
  mutate(draft)
  return normalizeSettings(draft)
}

/** What an import falls back on: the widgets' places and the shared options now. */
function fallbackOf(s: OverlaySettings): LayoutImportFallback {
  return { widgets: snapshotWidgets(s.widgets), options: sharedOptions(s) }
}

function names(s: OverlaySettings): string[] {
  return s.savedLayouts.list.map((l) => l.name)
}

function layout(s: OverlaySettings, name: string): SavedLayout {
  const l = s.savedLayouts.list.find((x) => x.name === name)
  if (!l) throw new Error(`no layout ${name}`)
  return l
}

/** Default settings with a 'Mazda' layout in use, the relative moved and the radar hidden in it. */
function withMazda(): OverlaySettings {
  let s = change(createDefaultSettings(), (d) => void saveLayoutAs(d, 'Mazda'))
  s = change(s, (d) => {
    d.widgets.relative.bounds = { x: 900, y: 500, width: 420, height: 300 }
    d.widgets.relative.scale = 120
    d.widgets.radar.visible = false
    d.widgets.battle.locked = true
  })
  return s
}

describe('migration and normalisation', () => {
  it('starts existing users with one layout, Principal, equal to their widgets', () => {
    const old = createDefaultSettings() as unknown as Record<string, unknown>
    const widgets = old.widgets as OverlaySettings['widgets']
    widgets.standings.bounds = { x: 1500, y: 40, width: 400, height: 600 }
    widgets.standings.scale = 130
    widgets.fuel.visible = true
    delete old.savedLayouts
    delete old.layouts
    const s = normalizeSettings(JSON.parse(JSON.stringify(old)))
    expect(s.savedLayouts.list).toHaveLength(1)
    expect(s.savedLayouts.list[0]?.name).toBe('Principal')
    expect(s.savedLayouts.activeId).toBe(s.savedLayouts.list[0]?.id)
    expect(s.savedLayouts.list[0]?.widgets).toEqual(snapshotWidgets(s.widgets))
    // Nothing moved: the widgets are the file's.
    expect(s.widgets.standings.bounds).toEqual({ x: 1500, y: 40, width: 400, height: 600 })
    expect(s.widgets.standings.scale).toBe(130)
    expect(s.layouts.autoSwitch).toBe(false)
  })

  it('names that first layout in the interface language', () => {
    const s = normalizeSettings({ appearance: { language: 'en' }, widgets: {} })
    expect(names(s)).toEqual(['Main'])
  })

  it('keeps layouts losslessly and is idempotent', () => {
    let s = withMazda()
    s = change(s, (d) => {
      linkCar(d, MAZDA, layout(d, 'Mazda').id)
      noteSeenCar(d, GT3)
    })
    const again = normalizeSettings(JSON.parse(JSON.stringify(s)))
    expect(again).toEqual(s)
    expect(normalizeSettings(again)).toEqual(s)
  })

  it('makes the layout in use follow the widgets', () => {
    const s = withMazda()
    const mazda = layout(s, 'Mazda')
    expect(mazda.widgets.relative).toEqual({
      bounds: { x: 900, y: 500, width: 420, height: 300 },
      scale: 120,
      visible: true,
      locked: false
    })
    expect(mazda.widgets.radar.visible).toBe(false)
    expect(mazda.widgets.battle.locked).toBe(true)
    // The one it was saved from keeps what it had.
    expect(layout(s, 'Principal').widgets.relative).toEqual(
      snapshotWidgets(createDefaultSettings().widgets).relative
    )
  })

  it('drops malformed layouts, duplicate ids, dangling links and repeated cars', () => {
    const base = createDefaultSettings()
    const w = snapshotWidgets(base.widgets)
    const s = normalizeSettings({
      ...base,
      savedLayouts: {
        activeId: 'gone',
        list: [
          { id: 'a', name: '  Uno  ', widgets: w },
          { id: 'a', name: 'Dup', widgets: w },
          { id: 'bad id!', name: 'X', widgets: w },
          'nope',
          { id: 'b', name: '', widgets: { relative: { scale: 999, bounds: { x: 'x' } } } }
        ],
        links: [
          { carId: 67, carName: 'Mazda', layoutId: 'b' },
          { carId: 67, carName: 'Mazda again', layoutId: 'a' },
          { carId: 5, carName: 'Nowhere', layoutId: 'zzz' },
          { carId: -1, carName: 'Neg', layoutId: 'a' }
        ],
        seenCars: [{ carId: 67, carName: 'Mazda' }, { carId: 67 }, { carId: 0 }, 'x']
      }
    })
    const lib = s.savedLayouts
    expect(lib.list.map((l) => [l.id, l.name])).toEqual([
      ['a', 'Uno'],
      ['b', 'Principal 2']
    ])
    // An unknown active id falls back to a layout already equal to the widgets.
    expect(lib.activeId).toBe('a')
    expect(lib.list[1]?.widgets.relative.scale).toBe(200)
    expect(lib.list[1]?.widgets.relative.bounds.x).toBe(w.relative.bounds.x)
    expect(lib.links).toEqual([{ carId: 67, carName: 'Mazda', layoutId: 'b' }])
    expect(lib.seenCars).toEqual([{ carId: 67, carName: 'Mazda' }])
  })

  it('caps the number of layouts', () => {
    const base = createDefaultSettings()
    const w = snapshotWidgets(base.widgets)
    const list = Array.from({ length: MAX_LAYOUTS + 5 }, (_, i) => ({
      id: `layout-${i + 1}`,
      name: `L${i + 1}`,
      widgets: w
    }))
    const s = normalizeSettings({ ...base, savedLayouts: { activeId: 'layout-1', list } })
    expect(s.savedLayouts.list).toHaveLength(MAX_LAYOUTS)
  })

  it('keeps the widgets as a new layout when the active one was dropped, overwriting none', () => {
    const base = createDefaultSettings()
    const first = snapshotWidgets(base.widgets)
    const live = structuredClone(base)
    live.widgets.inputs.bounds = { ...live.widgets.inputs.bounds, x: 777 }
    const s = normalizeSettings(
      JSON.parse(
        JSON.stringify({
          ...live,
          savedLayouts: {
            activeId: 'bad id',
            list: [
              { id: 'layout-1', name: 'Principal', widgets: first },
              { id: 'bad id', name: 'B', widgets: first }
            ]
          }
        })
      )
    )
    const lib = s.savedLayouts
    expect(lib.list[0]?.widgets.inputs.bounds.x).toBe(first.inputs.bounds.x)
    expect(lib.list.map((l) => [l.id, l.name])).toEqual([
      ['layout-1', 'Principal'],
      ['layout-2', 'Principal (2)']
    ])
    expect(lib.activeId).toBe('layout-2')
    expect(lib.list[1]?.widgets.inputs.bounds.x).toBe(777)
    // Stable: loading it again changes nothing.
    expect(normalizeSettings(JSON.parse(JSON.stringify(s))).savedLayouts).toEqual(lib)
  })

  it('numbers repeated names of a file edited by hand', () => {
    const base = createDefaultSettings()
    const w = snapshotWidgets(base.widgets)
    const s = normalizeSettings({
      ...base,
      savedLayouts: {
        activeId: 'a',
        list: [
          { id: 'a', name: 'GT3', widgets: w },
          { id: 'b', name: 'gt3', widgets: w },
          { id: 'c', name: 'GT3', widgets: w }
        ]
      }
    })
    expect(s.savedLayouts.list.map((l) => l.name)).toEqual(['GT3', 'gt3 (2)', 'GT3 (3)'])
  })
})

describe('layout commands', () => {
  it('saves the widgets as a new layout, which becomes the one in use', () => {
    const before = createDefaultSettings()
    const s = change(before, (d) => expect(saveLayoutAs(d, ' GT3 ')).toBe('layout-2'))
    expect(names(s)).toEqual(['Principal', 'GT3'])
    expect(s.savedLayouts.activeId).toBe('layout-2')
    expect(s.widgets).toEqual(before.widgets)
    expect(layout(s, 'GT3').widgets).toEqual(snapshotWidgets(before.widgets))
  })

  it('refuses an empty name and a full list', () => {
    const s = createDefaultSettings()
    expect(saveLayoutAs(s, '   ')).toBeNull()
    expect(saveLayoutAs(s, 42)).toBeNull()
    for (let i = s.savedLayouts.list.length; i < MAX_LAYOUTS; i++) saveLayoutAs(s, `L${i}`)
    expect(s.savedLayouts.list).toHaveLength(MAX_LAYOUTS)
    expect(saveLayoutAs(s, 'one more')).toBeNull()
    expect(duplicateLayout(s, 'layout-1', 'copy')).toBeNull()
  })

  it('makes names unique, case aside', () => {
    const s = createDefaultSettings()
    saveLayoutAs(s, 'principal')
    saveLayoutAs(s, 'Principal')
    expect(names(s)).toEqual(['Principal', 'principal (2)', 'Principal (3)'])
    expect(uniqueLayoutName('Principal', s.savedLayouts.list, 'layout-1')).toBe('Principal')
  })

  it('keeps unique names of the longest length unique after a load', () => {
    const long = 'A'.repeat(MAX_LAYOUT_NAME)
    let s = createDefaultSettings()
    s = change(s, (d) => void saveLayoutAs(d, long))
    s = change(s, (d) => void saveLayoutAs(d, long))
    s = change(s, (d) => void duplicateLayout(d, d.savedLayouts.activeId, long))
    s = change(s, (d) => void renameLayout(d, 'layout-1', `${long}B`))
    const after = normalizeSettings(JSON.parse(JSON.stringify(s)))
    const list = names(after)
    expect(list).toEqual(names(s))
    expect(new Set(list.map((n) => n.toLowerCase())).size).toBe(list.length)
    for (const n of list) expect(Array.from(n).length).toBeLessThanOrEqual(MAX_LAYOUT_NAME)
    expect(list).toContain(`${'A'.repeat(MAX_LAYOUT_NAME - 4)} (2)`)
  })

  it('cleans names: control characters, spaces, length', () => {
    expect(layoutName('  Mazda\n\tMX-5  ')).toBe('Mazda MX-5')
    expect(layoutName('x'.repeat(100))).toHaveLength(40)
    expect(layoutName('')).toBeNull()
    expect(layoutName(null)).toBeNull()
  })

  it('duplicates a layout right after it, without applying it', () => {
    let s = withMazda()
    const mazda = layout(s, 'Mazda')
    s = change(s, (d) => void duplicateLayout(d, mazda.id, 'Mazda (copia)'))
    expect(names(s)).toEqual(['Principal', 'Mazda', 'Mazda (copia)'])
    expect(s.savedLayouts.activeId).toBe(mazda.id)
    expect(layout(s, 'Mazda (copia)').widgets).toEqual(mazda.widgets)
    expect(duplicateLayout(s, 'nope', 'x')).toBeNull()
  })

  it('renames, keeping the name unique', () => {
    const s = withMazda()
    const id = layout(s, 'Mazda').id
    expect(renameLayout(s, id, 'Principal')).toBe(true)
    expect(names(s)).toEqual(['Principal', 'Principal (2)'])
    expect(renameLayout(s, id, 'Principal (2)')).toBe(false)
    expect(renameLayout(s, id, ' ')).toBe(false)
    expect(renameLayout(s, 'nope', 'x')).toBe(false)
  })

  it('never deletes the layout in use or the last one; a delete drops its car links', () => {
    let s = withMazda()
    const mazda = layout(s, 'Mazda').id
    expect(canDeleteLayout(s.savedLayouts, mazda)).toBe(false)
    expect(deleteLayout(s, mazda)).toBe(false)
    s = change(s, (d) => {
      applyLayout(d, 'layout-1')
      linkCar(d, MAZDA, mazda)
    })
    expect(deleteLayout(s, mazda)).toBe(true)
    expect(names(s)).toEqual(['Principal'])
    expect(s.savedLayouts.links).toEqual([])
    expect(deleteLayout(s, 'layout-1')).toBe(false)
  })

  it('moves a layout up and down', () => {
    const s = withMazda()
    saveLayoutAs(s, 'GT3')
    expect(moveLayout(s, layout(s, 'GT3').id, -1)).toBe(true)
    expect(names(s)).toEqual(['Principal', 'GT3', 'Mazda'])
    expect(moveLayout(s, 'layout-1', -1)).toBe(false)
    expect(moveLayout(s, layout(s, 'Mazda').id, 1)).toBe(false)
  })

  it('moves past the one in use, which keeps its place, when the page pins it apart', () => {
    const s = createDefaultSettings()
    for (const n of ['A', 'B', 'C']) saveLayoutAs(s, n)
    s.savedLayouts.activeId = layout(s, 'A').id
    // Principal, [A], B, C: B up swaps with Principal, A stays second.
    expect(moveLayout(s, layout(s, 'B').id, -1, true)).toBe(true)
    expect(names(s)).toEqual(['B', 'A', 'Principal', 'C'])
    expect(moveLayout(s, layout(s, 'B').id, -1, true)).toBe(false)
    expect(moveLayout(s, layout(s, 'C').id, 1, true)).toBe(false)
    expect(moveLayout(s, layout(s, 'A').id, 1, true)).toBe(false)
    expect(names(s)).toEqual(['B', 'A', 'Principal', 'C'])
    // Without it, a plain swap with the neighbour, the one in use too.
    expect(moveLayout(s, layout(s, 'A').id, 1)).toBe(true)
    expect(names(s)).toEqual(['B', 'Principal', 'A', 'C'])
  })

  it('cycles to the next layout, wrapping around; none with a single one', () => {
    const s = withMazda()
    expect(nextLayoutAfterActive(s.savedLayouts)).toBe('layout-1')
    s.savedLayouts.activeId = 'layout-1'
    expect(nextLayoutAfterActive(s.savedLayouts)).toBe(layout(s, 'Mazda').id)
    expect(nextLayoutAfterActive(createDefaultSettings().savedLayouts)).toBeNull()
  })

  it('gives fresh ids', () => {
    expect(nextLayoutId([])).toBe('layout-1')
    const w = snapshotWidgets(createDefaultSettings().widgets)
    expect(
      nextLayoutId([
        { id: 'layout-7', name: 'a', mode: 'position', widgets: w },
        { id: 'custom', name: 'b', mode: 'position', widgets: w }
      ])
    ).toBe('layout-8')
  })
})

describe('applyLayout', () => {
  it('copies bounds, scale, visibility and lock into the widgets, and its own options', () => {
    const mazdaSettings = withMazda()
    let s = change(mazdaSettings, (d) => {
      d.widgets.relative.backgroundOpacity = 0.4
      d.relative.carsAhead = 6
      d.appearance.fontScale = 120
      d.visibility.showWhen = 'always'
    })
    s = change(s, (d) => expect(applyLayout(d, 'layout-1')).toBe(true))
    const def = createDefaultSettings().widgets
    expect(s.savedLayouts.activeId).toBe('layout-1')
    expect(s.widgets.relative.bounds).toEqual(def.relative.bounds)
    expect(s.widgets.relative.scale).toBe(def.relative.scale)
    expect(s.widgets.radar.visible).toBe(def.radar.visible)
    expect(s.widgets.battle.locked).toBe(false)
    // Principal's own options: those it was saved with (the defaults).
    expect(s.widgets.relative.backgroundOpacity).toBe(def.relative.backgroundOpacity)
    expect(s.relative.carsAhead).toBe(createDefaultSettings().relative.carsAhead)
    // The global ones stay whatever the layout.
    expect(s.appearance.fontScale).toBe(120)
    expect(s.visibility.showWhen).toBe('always')
    // Back to Mazda: exactly what it had, places and options.
    s = change(s, (d) => void applyLayout(d, layout(d, 'Mazda').id))
    expect(snapshotWidgets(s.widgets)).toEqual(layout(mazdaSettings, 'Mazda').widgets)
    expect(s.widgets.relative.backgroundOpacity).toBe(0.4)
    expect(s.relative.carsAhead).toBe(6)
  })

  it('does nothing for an unknown layout or the one in use', () => {
    const s = withMazda()
    expect(applyLayout(s, 'nope')).toBe(false)
    expect(applyLayout(s, s.savedLayouts.activeId)).toBe(false)
  })
})

describe('last used (usedAt)', () => {
  it('stamps a layout when it becomes the one in use: saved as new or applied', () => {
    let s = change(createDefaultSettings(), (d) => void saveLayoutAs(d, 'Mazda', 1_000.7))
    expect(layout(s, 'Mazda').usedAt).toBe(1_000)
    expect(layout(s, 'Principal').usedAt).toBeUndefined()
    s = change(s, (d) => void applyLayout(d, 'layout-1', 5_000))
    expect(layout(s, 'Principal').usedAt).toBe(5_000)
    expect(layout(s, 'Mazda').usedAt).toBe(1_000)
    // Applying the one in use again changes nothing.
    s = change(s, (d) => expect(applyLayout(d, 'layout-1', 9_000)).toBe(false))
    expect(layout(s, 'Principal').usedAt).toBe(5_000)
  })

  it('gives none to a duplicate or an import, and never exports it', () => {
    const s = change(createDefaultSettings(), (d) => void saveLayoutAs(d, 'Mazda', 7_000))
    const copy = change(s, (d) => void duplicateLayout(d, layout(d, 'Mazda').id, 'Copia'))
    expect(layout(copy, 'Copia').usedAt).toBeUndefined()
    const text = layoutFileText(layout(s, 'Mazda'))
    expect(text).not.toContain('usedAt')
    const parsed = parseLayoutFile(text, fallbackOf(s))
    if (!parsed.ok) throw new Error('not parsed')
    const imported = change(s, (d) => void importLayout(d, parsed, 'Importada'))
    expect(imported.savedLayouts.list.at(-1)).not.toHaveProperty('usedAt')
  })

  it('loads it losslessly; an old file (none) or a bad value reads as never used', () => {
    const s = change(createDefaultSettings(), (d) => void saveLayoutAs(d, 'Mazda', 123_456))
    expect(normalizeSettings(JSON.parse(JSON.stringify(s)))).toEqual(s)
    const raw = JSON.parse(JSON.stringify(s)) as OverlaySettings
    const bad: unknown[] = [-1, Number.NaN, '5', null, Infinity, true]
    for (const usedAt of bad) {
      ;(raw.savedLayouts.list[1] as unknown as Record<string, unknown>).usedAt = usedAt
      expect(normalizeSettings(raw).savedLayouts.list[1], String(usedAt)).not.toHaveProperty(
        'usedAt'
      )
    }
    ;(raw.savedLayouts.list[1] as unknown as Record<string, unknown>).usedAt = 0
    expect(normalizeSettings(raw).savedLayouts.list[1]?.usedAt).toBe(0)
  })

  it('picks the one in use, the car one, then the latest used first, for a short list', () => {
    const s = createDefaultSettings()
    for (const [i, n] of ['A', 'B', 'C', 'D', 'E', 'F', 'G'].entries()) saveLayoutAs(s, n, i + 1)
    // Principal 0 (never), A 1 ... G 7; Principal put in use last.
    applyLayout(s, 'layout-1', 100)
    const lib = s.savedLayouts
    const short = (max: number, also: string | null = null): string[] =>
      recentLayouts(lib, max, also).map((l) => l.name)
    expect(short(5)).toEqual(['Principal', 'G', 'F', 'E', 'D'])
    expect(short(5, 'layout-2')).toEqual(['Principal', 'A', 'G', 'F', 'E'])
    expect(short(5, 'nope')).toEqual(['Principal', 'G', 'F', 'E', 'D'])
    // The one in use first even when it is not the latest used (a file edited by hand).
    lib.activeId = 'layout-3'
    expect(short(3)).toEqual(['B', 'Principal', 'G'])
    lib.activeId = 'layout-1'
    // A list that fits: whole, as stored.
    expect(short(8)).toEqual(['Principal', 'A', 'B', 'C', 'D', 'E', 'F', 'G'])
    // Never used ones: in the list's order, after the used ones.
    for (const l of lib.list) delete l.usedAt
    expect(short(3)).toEqual(['Principal', 'A', 'B'])
  })

  it('sorts by name (accents, case, numbers) or the latest used, ties in the stored order', () => {
    const s = createDefaultSettings()
    saveLayoutAs(s, 'óvalo', 30)
    saveLayoutAs(s, 'GT3 (10)', 10)
    saveLayoutAs(s, 'gt3 (2)', 10)
    saveLayoutAs(s, 'Ágata', 20)
    const list = s.savedLayouts.list
    const sorted = (sort: LayoutSort): string[] =>
      sortLayouts(list, sort, 'es-ES').map((l) => l.name)
    expect(sorted('custom')).toEqual(['Principal', 'óvalo', 'GT3 (10)', 'gt3 (2)', 'Ágata'])
    expect(sorted('name')).toEqual(['Ágata', 'gt3 (2)', 'GT3 (10)', 'óvalo', 'Principal'])
    expect(sorted('recent')).toEqual(['óvalo', 'Ágata', 'GT3 (10)', 'gt3 (2)', 'Principal'])
    expect(list.map((l) => l.name)).toEqual(sorted('custom'))
  })
})

describe('car links', () => {
  it('links, relinks and unlinks a car; one layout per car', () => {
    const s = withMazda()
    const mazda = layout(s, 'Mazda').id
    expect(linkCar(s, MAZDA, mazda)).toBe(true)
    expect(linkCar(s, MAZDA, mazda)).toBe(false)
    expect(linkCar(s, GT3, mazda)).toBe(true)
    expect(linkedLayoutId(s.savedLayouts, GT3.carId)).toBe(mazda)
    expect(linkCar(s, GT3, 'layout-1')).toBe(true)
    expect(linkedLayoutId(s.savedLayouts, GT3.carId)).toBe('layout-1')
    expect(linkCar(s, GT3, 'nope')).toBe(false)
    expect(linkCar(s, GT3, null)).toBe(true)
    expect(linkCar(s, GT3, null)).toBe(false)
    expect(linkedLayoutId(s.savedLayouts, GT3.carId)).toBeNull()
    expect(s.savedLayouts.links).toEqual([{ ...MAZDA, layoutId: mazda }])
  })

  it('remembers the cars you get in, the latest first, and renames linked ones', () => {
    const s = createDefaultSettings()
    expect(noteSeenCar(s, MAZDA)).toBe(true)
    expect(noteSeenCar(s, MAZDA)).toBe(false)
    linkCar(s, GT3, 'layout-1')
    noteSeenCar(s, { carId: GT3.carId, carName: 'Porsche 992 GT3 R' })
    expect(s.savedLayouts.seenCars.map((c) => c.carId)).toEqual([GT3.carId, MAZDA.carId])
    expect(s.savedLayouts.links[0]?.carName).toBe('Porsche 992 GT3 R')
    for (let i = 1; i <= MAX_SEEN_CARS + 3; i++) noteSeenCar(s, { carId: 1000 + i, carName: '' })
    expect(s.savedLayouts.seenCars).toHaveLength(MAX_SEEN_CARS)
  })

  it('offers the current car first, then the seen and linked ones, each once', () => {
    const s = createDefaultSettings()
    noteSeenCar(s, MAZDA)
    linkCar(s, { carId: 9, carName: 'Old' }, 'layout-1')
    expect(linkableCars(s.savedLayouts, GT3).map((c) => c.carId)).toEqual([GT3.carId, 67, 9])
    expect(linkableCars(s.savedLayouts, MAZDA).map((c) => c.carId)).toEqual([67, 9])
  })
})

describe('layout files', () => {
  const fallback = fallbackOf(createDefaultSettings())

  it('round-trips a layout through its file, places and per-widget options only', () => {
    const mazda = layout(withMazda(), 'Mazda')
    const text = layoutFileText(mazda)
    const raw = JSON.parse(text) as Record<string, unknown>
    expect(raw.format).toBe(LAYOUT_FILE_FORMAT)
    expect(raw.version).toBe(LAYOUT_FILE_VERSION)
    expect(Object.keys((raw.widgets as Record<string, object>).relative ?? {}).sort()).toEqual([
      'bounds',
      'locked',
      'scale',
      'visible'
    ])
    expect(raw.settingsVersion).toBe(SETTINGS_VERSION)
    expect(Object.keys((raw.options as { sections: object }).sections).sort()).toEqual(
      [...LAYOUT_SECTIONS].sort()
    )
    const parsed = parseLayoutFile(text, fallback)
    expect(parsed).toEqual({
      ok: true,
      name: 'Mazda',
      widgets: mazda.widgets,
      options: mazda.options
    })
  })

  it('refuses what is not a layout file', () => {
    const bad = (text: string): unknown => {
      const r = parseLayoutFile(text, fallback)
      return r.ok ? 'ok' : r.error
    }
    expect(bad('{nope')).toBe('json')
    expect(bad('[]')).toBe('format')
    expect(bad(JSON.stringify({ format: 'other', version: 1, widgets: {} }))).toBe('format')
    expect(bad(JSON.stringify({ format: LAYOUT_FILE_FORMAT, widgets: {} }))).toBe('format')
    expect(bad(JSON.stringify({ format: LAYOUT_FILE_FORMAT, version: 1.5, widgets: {} }))).toBe(
      'format'
    )
    expect(bad(JSON.stringify({ format: LAYOUT_FILE_FORMAT, version: 1, widgets: [] }))).toBe(
      'format'
    )
    expect(bad(JSON.stringify({ format: LAYOUT_FILE_FORMAT, version: 3, widgets: {} }))).toBe(
      'version'
    )
    expect(
      bad(JSON.stringify({ format: LAYOUT_FILE_FORMAT, version: 1, widgets: { pitboard: {} } }))
    ).toBe('empty')
    expect(bad(' '.repeat(MAX_LAYOUT_FILE_BYTES + 1))).toBe('too-big')
  })

  it('takes only layout fields of known widgets, clamped; the rest from the fallback', () => {
    const text = JSON.stringify({
      format: LAYOUT_FILE_FORMAT,
      version: 1,
      name: '\u0007',
      widgets: {
        radar: {
          bounds: { x: 10.4, y: 20, width: 1, height: 99999 },
          scale: 10,
          visible: 'yes',
          locked: true,
          backgroundOpacity: 0.1,
          showIn: { race: false }
        },
        pitboard: { visible: true }
      },
      relative: { carsAhead: 9 }
    })
    const r = parseLayoutFile('﻿' + text, fallback)
    if (!r.ok) throw new Error(r.error)
    expect(r.name).toBeNull()
    expect(r.widgets.radar).toEqual({
      bounds: { x: 10, y: 20, width: WIDGET_DEFS.radar.minSize.width, height: 10_000 },
      scale: 60,
      visible: fallback.widgets.radar.visible,
      locked: true
    })
    expect(Object.keys(r.widgets).sort()).toEqual([...WIDGET_IDS].sort())
    expect(r.widgets.standings).toEqual(fallback.widgets.standings)
    // A version 1 file: places only, whatever else it says.
    expect(r.options).toBeNull()
  })

  it('imports a layout as a new one, not applied, named from the file or the fallback', () => {
    const s = createDefaultSettings()
    const text = layoutFileText(layout(withMazda(), 'Mazda'))
    const r = parseLayoutFile(text, fallback)
    if (!r.ok) throw new Error(r.error)
    expect(importLayout(s, r, 'Importada')).toBe('layout-2')
    expect(importLayout(s, { ...r, name: null }, 'Importada')).toBe('layout-3')
    expect(importLayout(s, r, 'Importada')).toBe('layout-4')
    expect(names(s)).toEqual(['Principal', 'Mazda', 'Importada', 'Mazda (2)'])
    expect(s.savedLayouts.activeId).toBe('layout-1')
  })

  it('names files without the characters Windows refuses', () => {
    expect(layoutFileName('Mazda MX-5')).toBe('Mazda MX-5.overlap-layout.json')
    expect(layoutFileName('a/b:c*?')).toBe('abc.overlap-layout.json')
    expect(layoutFileName('...')).toBe('layout.overlap-layout.json')
  })
})
