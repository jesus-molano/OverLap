import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LayoutNotice } from '@shared/ipc'
import {
  LAYOUT_FILE_FORMAT,
  MAX_LAYOUTS,
  applyLayout,
  layoutFileText,
  setLayoutMode,
  linkCar,
  saveLayoutAs,
  snapshotWidgets
} from '@shared/layouts'
import { createDefaultSettings, normalizeSettings } from '@shared/settings'
import type { CarRef, OverlaySettings } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { LayoutControl, isLayoutCommand } from './layoutControl'
import type { LayoutFileDeps } from './layoutFiles'
import { NoticeUndo } from './noticeUndo'

const MAZDA = { carId: 67, carName: 'Mazda MX-5 Cup' }
const GT3 = { carId: 132, carName: 'Porsche 911 GT3 R (992)' }

interface Harness {
  control: LayoutControl
  settings(): OverlaySettings
  /** Every dependency call, in order. */
  calls: string[]
  reloaded: WidgetId[][]
  notices: LayoutNotice[]
  cars: (CarRef | null)[]
  setEditing(on: boolean): void
  /** A wheel resize waiting in OverlayWindows: written when main flushes the pending saves. */
  pendingSave(mutate: (s: OverlaySettings) => void): void
  /** A change from elsewhere (the settings window's patch). */
  edit(mutate: (s: OverlaySettings) => void): void
  files: { [K in keyof LayoutFileDeps]: ReturnType<typeof vi.fn> }
  /** What main keeps for «Deshacer» (R26). */
  undo: NoticeUndo
}

function harness(initial: OverlaySettings): Harness {
  let current = normalizeSettings(initial)
  let editing = false
  let pending: ((s: OverlaySettings) => void) | null = null
  /** Each reading of the clock is a second later. */
  let clock = 0
  const calls: string[] = []
  const reloaded: WidgetId[][] = []
  const notices: LayoutNotice[] = []
  const cars: (CarRef | null)[] = []
  const undo = new NoticeUndo()
  const files = {
    pickSavePath: vi.fn(async (name: string) => `C:/out/${name}`),
    pickOpenPath: vi.fn(async () => 'C:/in/layout.json'),
    writeText: vi.fn(),
    sizeOf: vi.fn(() => 100),
    readText: vi.fn(() => '')
  }
  const control = new LayoutControl({
    getSettings: () => current,
    update: (mutate) => {
      calls.push('update')
      const draft = structuredClone(current)
      mutate(draft)
      current = normalizeSettings(draft)
    },
    sync: () => void calls.push('sync'),
    reloadBounds: (ids) => {
      calls.push('reload')
      reloaded.push([...ids])
    },
    flushPendingSaves: () => {
      calls.push('flush')
      if (pending === null) return
      const draft = structuredClone(current)
      pending(draft)
      pending = null
      current = normalizeSettings(draft)
    },
    isEditing: () => editing,
    notify: (n) => void notices.push(n),
    keepUndo: (what, fn) => undo.keep(what, fn),
    carChanged: (car) => void cars.push(car),
    files: () => files as unknown as LayoutFileDeps,
    importedName: () => 'Importada',
    now: () => (clock += 1_000)
  })
  return {
    control,
    settings: () => current,
    calls,
    reloaded,
    notices,
    cars,
    setEditing: (on) => (editing = on),
    pendingSave: (mutate) => (pending = mutate),
    edit: (mutate) => {
      const draft = structuredClone(current)
      mutate(draft)
      current = normalizeSettings(draft)
    },
    files,
    undo
  }
}

/** Principal (layout-1, in use, the relative at its default) and Mazda (layout-2, moved). */
function twoLayouts(): OverlaySettings {
  const s = createDefaultSettings()
  saveLayoutAs(s, 'Mazda')
  s.widgets.relative.bounds = { x: 900, y: 500, width: 420, height: 300 }
  s.widgets.radar.visible = false
  const n = normalizeSettings(s)
  n.savedLayouts.activeId = 'layout-1'
  // Back to Principal's widgets: what Principal holds.
  const principal = n.savedLayouts.list[0]
  if (principal) for (const id of WIDGET_IDS) Object.assign(n.widgets[id], principal.widgets[id])
  return normalizeSettings(n)
}

describe('LayoutControl: applying', () => {
  let h: Harness
  beforeEach(() => {
    h = harness(twoLayouts())
  })

  it('takes the reset path: store, then every widget reloaded, then the sync', () => {
    expect(h.control.choose('layout-2')).toBe(true)
    expect(h.calls).toEqual(['flush', 'update', 'reload', 'sync'])
    expect(h.reloaded).toEqual([[...WIDGET_IDS]])
    const s = h.settings()
    expect(s.savedLayouts.activeId).toBe('layout-2')
    expect(s.widgets.relative.bounds).toEqual({ x: 900, y: 500, width: 420, height: 300 })
    expect(s.widgets.radar.visible).toBe(false)
  })

  it('writes a pending wheel resize into the layout being left, not the next one', () => {
    h.setEditing(true)
    const resized = { x: 50, y: 250, width: 483, height: 265 }
    h.pendingSave((s) => (s.widgets.relative.bounds = { ...resized }))
    expect(h.control.next()).toBe(true)
    const s = h.settings()
    expect(s.savedLayouts.list[0]?.widgets.relative.bounds).toEqual(resized)
    expect(s.widgets.relative.bounds).toEqual({ x: 900, y: 500, width: 420, height: 300 })
    expect(h.control.next()).toBe(true)
    expect(h.settings().widgets.relative.bounds).toEqual(resized)
  })

  it('does nothing for the layout in use or an unknown one', () => {
    expect(h.control.choose('layout-1')).toBe(false)
    expect(h.control.choose('layout-9')).toBe(false)
    expect(h.calls).toEqual([])
  })

  it('applies in edit mode too when chosen by hand', () => {
    h.setEditing(true)
    expect(h.control.choose('layout-2')).toBe(true)
  })

  it('stamps the layout put in use, by hand, shortcut, car or "Guardar como"', async () => {
    const usedAt = (id: string): number | undefined =>
      h.settings().savedLayouts.list.find((l) => l.id === id)?.usedAt
    h.control.choose('layout-2')
    expect(usedAt('layout-2')).toBe(1_000)
    h.control.next()
    expect(usedAt('layout-1')).toBe(2_000)
    await h.control.command({ type: 'layout-save', name: 'GT3' })
    expect(usedAt('layout-3')).toBe(3_000)
    h.edit((d) => {
      linkCar(d, MAZDA, 'layout-2')
      d.layouts.autoSwitch = true
    })
    h.control.onCar(MAZDA)
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
    expect(usedAt('layout-2')).toBe(4_000)
    // A duplicate was never in use.
    await h.control.command({ type: 'layout-duplicate', id: 'layout-2', name: 'Copia' })
    expect(usedAt('layout-4')).toBeUndefined()
  })

  it('adds an example layout at the end without applying it (R57)', async () => {
    const before = h.settings().savedLayouts.activeId
    await h.control.command({ type: 'layout-example', kind: 'light', name: 'Ligera' })
    const list = h.settings().savedLayouts.list
    expect(list.at(-1)?.name).toBe('Ligera')
    expect(list.at(-1)?.widgets.standings.visible).toBe(false)
    expect(h.settings().savedLayouts.activeId).toBe(before)
    // «Siguiente disposición» reaches it.
    const id = list.at(-1)?.id
    for (let i = 0; i < list.length && h.settings().savedLayouts.activeId !== id; i++) {
      h.control.next()
    }
    expect(h.settings().savedLayouts.activeId).toBe(id)
    expect(h.settings().widgets.standings.visible).toBe(false)
  })

  it('moves past the pinned one in use when the page asks', async () => {
    await h.control.command({ type: 'layout-save', name: 'GT3' })
    // Principal, Mazda, [GT3]: Principal goes below Mazda; the one in use cannot move itself.
    await h.control.command({ type: 'layout-move', id: 'layout-1', step: 1, aroundActive: true })
    expect(h.settings().savedLayouts.list.map((l) => l.name)).toEqual(['Mazda', 'Principal', 'GT3'])
    await h.control.command({ type: 'layout-move', id: 'layout-3', step: -1, aroundActive: true })
    expect(h.settings().savedLayouts.list.map((l) => l.name)).toEqual(['Mazda', 'Principal', 'GT3'])
  })

  it('cycles with the shortcut, wrapping around', () => {
    expect(h.control.next()).toBe(true)
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
    expect(h.control.next()).toBe(true)
    expect(h.settings().savedLayouts.activeId).toBe('layout-1')
  })

  it('swaps the options with the places in the same store change, after the pending saves', () => {
    // Mazda's own options: 6 cars ahead, the radar's background half opaque.
    h.edit((s) => void applyLayout(s, 'layout-2'))
    h.edit((s) => {
      s.relative.carsAhead = 6
      s.widgets.radar.backgroundOpacity = 0.5
    })
    h.edit((s) => void applyLayout(s, 'layout-1'))
    const principal = h.settings()
    expect(principal.relative.carsAhead).toBe(3)
    h.calls.length = 0
    h.pendingSave((s) => (s.widgets.relative.scale = 140))
    expect(h.control.choose('layout-2')).toBe(true)
    // One change of the store and one sync (one broadcast): no state with half of it.
    expect(h.calls).toEqual(['flush', 'update', 'reload', 'sync'])
    const s = h.settings()
    expect(s.relative.carsAhead).toBe(6)
    expect(s.widgets.radar.backgroundOpacity).toBe(0.5)
    expect(s.widgets.relative.bounds).toEqual({ x: 900, y: 500, width: 420, height: 300 })
    // The pending resize went into the layout left, and its options stayed with it.
    expect(s.savedLayouts.list[0]?.widgets.relative.scale).toBe(140)
    expect(s.savedLayouts.list[0]?.options?.sections.relative.carsAhead).toBe(3)
    // The global options never move with a layout.
    expect(s.appearance).toEqual(principal.appearance)
    expect(s.visibility).toEqual(principal.visibility)
  })

  it('keeps the options of a "Solo posición" layout: the shared ones', () => {
    h.edit((s) => void setLayoutMode(s, 'layout-2', 'position'))
    h.edit((s) => void (s.relative.carsAhead = 7))
    h.control.choose('layout-2')
    expect(h.settings().relative.carsAhead).toBe(
      h.settings().savedLayouts.shared?.sections.relative.carsAhead
    )
  })
})

describe('LayoutControl: the automatic layout', () => {
  let h: Harness
  beforeEach(() => {
    const s = twoLayouts()
    linkCar(s, MAZDA, 'layout-2')
    s.layouts.autoSwitch = true
    h = harness(s)
  })

  it("applies the car's layout, remembers the car and tells the settings window", () => {
    h.control.onCar(MAZDA)
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
    expect(h.settings().savedLayouts.seenCars).toEqual([MAZDA])
    expect(h.cars).toEqual([MAZDA])
    expect(h.control.car).toEqual(MAZDA)
    // Out of the car: told, nothing else.
    h.control.onCar(null)
    expect(h.cars).toEqual([MAZDA, null])
  })

  it('never fights edit mode: it waits and applies when editing ends', () => {
    h.setEditing(true)
    h.control.onCar(MAZDA)
    expect(h.settings().savedLayouts.activeId).toBe('layout-1')
    expect(h.calls).not.toContain('reload')
    h.setEditing(false)
    h.control.onEditEnd()
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
  })

  it('a layout chosen by hand while waiting wins', () => {
    h.setEditing(true)
    h.control.onCar(MAZDA)
    h.control.choose('layout-1')
    h.setEditing(false)
    h.control.onEditEnd()
    expect(h.settings().savedLayouts.activeId).toBe('layout-1')
  })

  it("turning the mode on applies the current car's layout", () => {
    const s = twoLayouts()
    linkCar(s, MAZDA, 'layout-2')
    h = harness(s)
    h.control.onCar(MAZDA)
    expect(h.settings().savedLayouts.activeId).toBe('layout-1')
    const prev = h.settings()
    h.edit((d) => (d.layouts.autoSwitch = true))
    h.control.afterChange(prev)
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
  })

  it('linking the car you are in applies at once', async () => {
    const s = twoLayouts()
    s.layouts.autoSwitch = true
    h = harness(s)
    h.control.onCar(GT3)
    expect(h.settings().savedLayouts.activeId).toBe('layout-1')
    await h.control.command({ type: 'layout-link-car', car: GT3, layoutId: 'layout-2' })
    expect(h.settings().savedLayouts.links).toEqual([{ ...GT3, layoutId: 'layout-2' }])
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
  })

  it('linking a car turns «Según el coche» on, says so once, and applies (R26)', async () => {
    h = harness(twoLayouts())
    h.control.onCar(GT3)
    expect(h.settings().layouts.autoSwitch).toBe(false)
    await h.control.command({ type: 'layout-link-car', car: GT3, layoutId: 'layout-2' })
    expect(h.settings().layouts.autoSwitch).toBe(true)
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
    expect(h.notices).toEqual([{ kind: 'auto-switch-on', carName: GT3.carName, undo: 1 }])
    // Already on: nothing more to say.
    await h.control.command({ type: 'layout-link-car', car: MAZDA, layoutId: 'layout-1' })
    expect(h.notices).toHaveLength(1)
  })

  it('«Deshacer» turns the switch off and puts back the layout it applied over (R26)', async () => {
    h = harness(twoLayouts())
    h.control.onCar(GT3)
    await h.control.command({ type: 'layout-link-car', car: GT3, layoutId: 'layout-2' })
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
    expect(h.undo.run(1)).toBe(true)
    expect(h.settings().layouts.autoSwitch).toBe(false)
    expect(h.settings().savedLayouts.activeId).toBe('layout-1')
    // The link stays: only «Según el coche» was undone.
    expect(h.settings().savedLayouts.links).toEqual([{ ...GT3, layoutId: 'layout-2' }])
  })

  it('«Deshacer» leaves a layout chosen since then alone (R26)', async () => {
    h = harness(twoLayouts())
    // Not in that car: nothing applied, so nothing to put back.
    await h.control.command({ type: 'layout-link-car', car: GT3, layoutId: 'layout-2' })
    expect(h.settings().savedLayouts.activeId).toBe('layout-1')
    h.control.choose('layout-2')
    expect(h.undo.run()).toBe(true)
    expect(h.settings().layouts.autoSwitch).toBe(false)
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
  })

  it('saves a new layout linked to the car you are in, the switch on (R26)', async () => {
    h = harness(twoLayouts())
    await h.control.command({ type: 'layout-save', name: 'GT3', car: GT3 })
    const lib = h.settings().savedLayouts
    expect(lib.activeId).toBe('layout-3')
    expect(lib.links).toEqual([{ ...GT3, layoutId: 'layout-3' }])
    expect(h.settings().layouts.autoSwitch).toBe(true)
    expect(h.notices).toEqual([{ kind: 'auto-switch-on', carName: GT3.carName, undo: 1 }])
  })

  it('unlinking, or a link that changes nothing, leaves the switch as it is (R26)', async () => {
    h = harness(twoLayouts())
    await h.control.command({ type: 'layout-link-car', car: GT3, layoutId: null })
    expect(h.settings().layouts.autoSwitch).toBe(false)
    await h.control.command({ type: 'layout-link-car', car: GT3, layoutId: 'layout-9' })
    expect(h.settings().layouts.autoSwitch).toBe(false)
    expect(h.notices).toEqual([])
  })
})

describe('LayoutControl: commands', () => {
  let h: Harness
  beforeEach(() => {
    h = harness(twoLayouts())
  })

  it('knows its commands', () => {
    expect(isLayoutCommand({ type: 'layout-import' })).toBe(true)
    expect(isLayoutCommand({ type: 'open-settings-folder' })).toBe(false)
  })

  it('saves, duplicates, renames, moves and deletes', async () => {
    await h.control.command({ type: 'layout-save', name: 'GT3' })
    expect(h.settings().savedLayouts.activeId).toBe('layout-3')
    await h.control.command({ type: 'layout-duplicate', id: 'layout-2', name: 'Mazda (copia)' })
    await h.control.command({ type: 'layout-rename', id: 'layout-1', name: 'Base' })
    await h.control.command({ type: 'layout-move', id: 'layout-3', step: -1 })
    await h.control.command({ type: 'layout-delete', id: 'layout-2' })
    // The one in use stays.
    await h.control.command({ type: 'layout-delete', id: 'layout-3' })
    expect(h.settings().savedLayouts.list.map((l) => l.name)).toEqual([
      'Base',
      'GT3',
      'Mazda (copia)'
    ])
    // None of them moved a widget.
    expect(h.calls).not.toContain('reload')
  })

  it('brings the last layout deleted back ("Deshacer"), once', async () => {
    await h.control.command({ type: 'layout-save', name: 'GT3' })
    const names = (): string[] => h.settings().savedLayouts.list.map((l) => l.name)
    const before = names()
    await h.control.command({ type: 'layout-delete', id: 'layout-2' })
    expect(names()).not.toContain('Mazda')
    // Only the last one deleted.
    await h.control.command({ type: 'layout-restore', id: 'layout-1' })
    await h.control.command({ type: 'layout-restore', id: 'layout-2' })
    expect(names()).toEqual(before)
    await h.control.command({ type: 'layout-delete', id: 'layout-2' })
    await h.control.command({ type: 'layout-restore', id: 'layout-2' })
    await h.control.command({ type: 'layout-restore', id: 'layout-2' })
    expect(names()).toEqual(before)
  })

  it('exports a layout where the user chooses', async () => {
    await h.control.command({ type: 'layout-export', id: 'layout-2' })
    expect(h.files.pickSavePath).toHaveBeenCalledWith('Mazda.overlap-layout.json')
    const [path, text] = h.files.writeText.mock.calls[0] as [string, string]
    expect(path).toBe('C:/out/Mazda.overlap-layout.json')
    expect(JSON.parse(text)).toMatchObject({ format: LAYOUT_FILE_FORMAT, name: 'Mazda' })
    expect(h.notices).toEqual([{ kind: 'exported', name: 'Mazda' }])
  })

  it('says nothing when a dialog is cancelled, and reports a failed write', async () => {
    h.files.pickSavePath.mockResolvedValueOnce(null)
    await h.control.command({ type: 'layout-export', id: 'layout-2' })
    h.files.pickOpenPath.mockResolvedValueOnce(null)
    await h.control.command({ type: 'layout-import' })
    expect(h.notices).toEqual([])
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.files.writeText.mockImplementationOnce(() => {
      throw new Error('EACCES')
    })
    await h.control.command({ type: 'layout-export', id: 'layout-2' })
    expect(h.notices).toEqual([{ kind: 'export-failed', name: 'Mazda' }])
  })

  it('saves "Solo posición", changes a mode and copies a widget’s options to all', async () => {
    await h.control.command({ type: 'layout-save', name: 'Óvalo', mode: 'position' })
    let lib = h.settings().savedLayouts
    expect(lib.list[2]).toMatchObject({ name: 'Óvalo', mode: 'position' })
    expect(lib.activeId).toBe('layout-3')
    h.calls.length = 0
    // Another one: nothing waits to be written for it.
    await h.control.command({ type: 'layout-set-mode', id: 'layout-1', mode: 'position' })
    expect(h.calls).toEqual(['update', 'sync'])
    // The one in use: what waits is written first.
    h.calls.length = 0
    await h.control.command({ type: 'layout-set-mode', id: 'layout-3', mode: 'full' })
    expect(h.calls).toEqual(['flush', 'update', 'sync'])
    lib = h.settings().savedLayouts
    expect(lib.list.map((l) => l.mode)).toEqual(['position', 'full', 'full'])
    h.edit((s) => void (s.radar.rangeM = 50))
    h.notices.length = 0
    await h.control.command({
      type: 'layout-options-to-all',
      widgetId: 'radar',
      layoutId: 'layout-3'
    })
    lib = h.settings().savedLayouts
    expect(lib.list[1]?.options?.sections.radar.rangeM).toBe(50)
    expect(lib.shared?.sections.radar.rangeM).toBe(50)
    // Again: they all have them now, and the page is told so.
    await h.control.command({
      type: 'layout-options-to-all',
      widgetId: 'radar',
      layoutId: 'layout-3'
    })
    expect(h.notices).toEqual([
      { kind: 'options-copied', widgetId: 'radar', result: 'copied' },
      { kind: 'options-copied', widgetId: 'radar', result: 'unchanged' }
    ])
  })

  it('copies nothing for a button armed on a layout no longer in use', async () => {
    // Armed on Principal (radar 80 m), then the car applies Mazda (radar 10 m), then confirmed.
    h.edit((s) => void (s.radar.rangeM = 80))
    h.control.choose('layout-2')
    h.edit((s) => void (s.radar.rangeM = 10))
    h.calls.length = 0
    await h.control.command({
      type: 'layout-options-to-all',
      widgetId: 'radar',
      layoutId: 'layout-1'
    })
    const lib = h.settings().savedLayouts
    expect(lib.list[0]?.options?.sections.radar.rangeM).toBe(80)
    expect(h.calls).toEqual([])
    expect(h.notices.at(-1)).toEqual({ kind: 'options-copied', widgetId: 'radar', result: 'stale' })
  })

  it('imports "Solo posición" when asked', async () => {
    const mazda = h.settings().savedLayouts.list[1]
    if (!mazda) throw new Error('no Mazda')
    h.files.readText.mockReturnValueOnce(layoutFileText(mazda))
    await h.control.command({ type: 'layout-import', mode: 'position' })
    const added = h.settings().savedLayouts.list[2]
    expect(added?.mode).toBe('position')
    expect(added).not.toHaveProperty('options')
  })

  it('imports a valid file as a new layout, not applied', async () => {
    const mazda = h.settings().savedLayouts.list[1]
    if (!mazda) throw new Error('no Mazda')
    h.files.readText.mockReturnValueOnce(layoutFileText(mazda))
    await h.control.command({ type: 'layout-import' })
    const lib = h.settings().savedLayouts
    expect(lib.list.map((l) => l.name)).toEqual(['Principal', 'Mazda', 'Mazda (2)'])
    expect(lib.list[2]?.widgets).toEqual(mazda.widgets)
    expect(lib.list[2]?.options).toEqual(mazda.options)
    expect(lib.activeId).toBe('layout-1')
    expect(h.notices).toEqual([{ kind: 'imported', name: 'Mazda (2)' }])
  })

  it('refuses an invalid, unreadable, too large file, or one with no room left', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    h.files.readText.mockReturnValueOnce('{"format":"nope"}')
    await h.control.command({ type: 'layout-import' })
    h.files.readText.mockImplementationOnce(() => {
      throw new Error('EBUSY')
    })
    await h.control.command({ type: 'layout-import' })
    h.files.sizeOf.mockReturnValueOnce(10_000_000)
    await h.control.command({ type: 'layout-import' })
    const full = createDefaultSettings()
    for (let i = 1; i < MAX_LAYOUTS; i++) saveLayoutAs(full, `L${i}`)
    const f = harness(full)
    f.files.readText.mockReturnValueOnce(
      JSON.stringify({
        format: LAYOUT_FILE_FORMAT,
        version: 1,
        name: 'X',
        widgets: {
          radar: snapshotWidgets(full.widgets).radar
        }
      })
    )
    await f.control.command({ type: 'layout-import' })
    expect(h.notices).toEqual([
      { kind: 'import-failed', error: 'format' },
      { kind: 'import-failed', error: 'read' },
      { kind: 'import-failed', error: 'too-big' }
    ])
    expect(f.notices).toEqual([{ kind: 'import-failed', error: 'full' }])
  })
})
