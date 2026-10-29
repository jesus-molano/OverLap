import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LayoutNotice } from '@shared/ipc'
import {
  LAYOUT_FILE_FORMAT,
  MAX_LAYOUTS,
  layoutFileText,
  linkCar,
  saveLayoutAs,
  snapshotWidgets
} from '@shared/layouts'
import { createDefaultSettings, normalizeSettings } from '@shared/settings'
import type { CarRef, OverlaySettings } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'
import { LayoutControl, isLayoutCommand } from './layoutControl'
import type { LayoutFileDeps } from './layoutFiles'

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
}

function harness(initial: OverlaySettings): Harness {
  let current = normalizeSettings(initial)
  let editing = false
  let pending: ((s: OverlaySettings) => void) | null = null
  const calls: string[] = []
  const reloaded: WidgetId[][] = []
  const notices: LayoutNotice[] = []
  const cars: (CarRef | null)[] = []
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
    carChanged: (car) => void cars.push(car),
    files: () => files as unknown as LayoutFileDeps,
    importedName: () => 'Importada'
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
    files
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

  it('cycles with the shortcut, wrapping around', () => {
    expect(h.control.next()).toBe(true)
    expect(h.settings().savedLayouts.activeId).toBe('layout-2')
    expect(h.control.next()).toBe(true)
    expect(h.settings().savedLayouts.activeId).toBe('layout-1')
  })

  it('keeps per-widget options and option sections', () => {
    const before = h.settings()
    h.control.choose('layout-2')
    const after = h.settings()
    const options = (w: OverlaySettings['widgets'][WidgetId]): Record<string, unknown> => {
      const out: Record<string, unknown> = { ...w }
      for (const field of ['bounds', 'scale', 'visible', 'locked']) delete out[field]
      return out
    }
    for (const id of WIDGET_IDS) {
      expect(options(after.widgets[id]), id).toEqual(options(before.widgets[id]))
    }
    expect({ ...after, widgets: null, savedLayouts: null }).toEqual({
      ...before,
      widgets: null,
      savedLayouts: null
    })
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

  it('imports a valid file as a new layout, not applied', async () => {
    const mazda = h.settings().savedLayouts.list[1]
    if (!mazda) throw new Error('no Mazda')
    h.files.readText.mockReturnValueOnce(layoutFileText(mazda))
    await h.control.command({ type: 'layout-import' })
    const lib = h.settings().savedLayouts
    expect(lib.list.map((l) => l.name)).toEqual(['Principal', 'Mazda', 'Mazda (2)'])
    expect(lib.list[2]?.widgets).toEqual(mazda.widgets)
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
