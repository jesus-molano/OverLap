import { describe, expect, it } from 'vitest'
import { deepEqual } from './equal'
import {
  LAYOUT_FILE_FORMAT,
  MAX_LAYOUTS,
  applyLayout,
  applySettingsPatchFor,
  applyWidgetOptionsToAll,
  duplicateLayout,
  importLayout,
  layoutFileText,
  optionSetOf,
  parseLayoutFile,
  rendererSettings,
  saveLayoutAs,
  setLayoutMode,
  sharedOptions,
  snapshotWidgets,
  type LayoutImportFallback
} from './layouts'
import {
  applySettingsPatch,
  createDefaultSettings,
  normalizeSettings,
  settingsDraft
} from './settings'
import { isSealedOptionSet, normalizeOptionSet } from './settings/layouts'
import { GLOBAL_SECTIONS, LAYOUT_SECTIONS } from './settingsSchema'
import type { OverlaySettings, SavedLayout } from './types'
import { WIDGET_IDS } from './widgets'

/** Settings as main keeps them: every change normalised (the active layout = what is in effect). */
function change(s: OverlaySettings, mutate: (d: OverlaySettings) => void): OverlaySettings {
  const draft = settingsDraft(s)
  mutate(draft)
  return normalizeSettings(draft)
}

function layout(s: OverlaySettings, name: string): SavedLayout {
  const l = s.savedLayouts.list.find((x) => x.name === name)
  if (!l) throw new Error(`no layout ${name}`)
  return l
}

function fallbackOf(s: OverlaySettings): LayoutImportFallback {
  return { widgets: snapshotWidgets(s.widgets), options: sharedOptions(s) }
}

/**
 * Principal (layout-1, 'full': the defaults) and Mazda (layout-2, 'full', in use): the relative
 * with 6 cars ahead, half opaque, and the standings without the iRating column.
 */
function withMazda(): OverlaySettings {
  let s = change(createDefaultSettings(), (d) => void saveLayoutAs(d, 'Mazda', 1))
  s = change(s, (d) => {
    d.relative.carsAhead = 6
    d.widgets.relative.backgroundOpacity = 0.5
    d.standings.columns = d.standings.columns.map((c) =>
      c.id === 'ir' ? { ...c, visible: false } : c
    )
  })
  return s
}

const DEFAULTS = createDefaultSettings()

describe('what a layout carries', () => {
  it('every per-widget section and the widgets’ own option fields, nothing global', () => {
    const set = optionSetOf(createDefaultSettings())
    expect(Object.keys(set.sections).sort()).toEqual([...LAYOUT_SECTIONS].sort())
    for (const g of GLOBAL_SECTIONS) expect(set.sections).not.toHaveProperty(g)
    expect(Object.keys(set.widgets).sort()).toEqual([...WIDGET_IDS].sort())
    expect(Object.keys(set.widgets.standings).sort()).toEqual([
      'anchor',
      'autoHeight',
      'backgroundOpacity',
      'hideInPits',
      'showIn',
      'showOnSessionScreen'
    ])
  })

  it('a fresh install: Principal, with the options as they are, and the same shared ones', () => {
    const s = createDefaultSettings()
    const [principal] = s.savedLayouts.list
    expect(principal?.mode).toBe('full')
    expect(principal?.options).toEqual(optionSetOf(s))
    expect(s.savedLayouts.shared).toEqual(optionSetOf(s))
  })
})

describe('migration: layouts from before options', () => {
  /** A file as the previous version wrote it: layouts with places only, no shared options. */
  function oldFile(): Record<string, unknown> {
    const s = withMazda() as unknown as Record<string, unknown>
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>
    const lib = raw.savedLayouts as Record<string, unknown>
    for (const l of lib.list as Record<string, unknown>[]) {
      delete l.mode
      delete l.options
    }
    delete lib.shared
    return raw
  }

  it('makes every layout "Posición y opciones" with a copy of the options: nothing changes', () => {
    const raw = oldFile()
    const s = normalizeSettings(raw)
    const now = optionSetOf(s)
    for (const l of s.savedLayouts.list) {
      expect(l.mode).toBe('full')
      expect(l.options).toEqual(now)
    }
    expect(s.savedLayouts.shared).toEqual(now)
    // What is in effect is the file's own.
    expect(s.relative.carsAhead).toBe(6)
    expect(s.widgets.relative.backgroundOpacity).toBe(0.5)
    // Applying the other one changes the places only, as before.
    const after = change(s, (d) => void applyLayout(d, 'layout-1'))
    expect(after.relative.carsAhead).toBe(6)
    expect(after.widgets.relative.backgroundOpacity).toBe(0.5)
  })

  it('loads a file of this version losslessly, and as it was saved again', () => {
    const s = withMazda()
    const again = normalizeSettings(JSON.parse(JSON.stringify(s)))
    expect(again).toEqual(s)
    expect(layout(again, 'Principal').options?.sections.relative.carsAhead).toBe(
      DEFAULTS.relative.carsAhead
    )
  })

  it('validates options read from disk: a bad value keeps the one in effect, unknown keys go', () => {
    const raw = JSON.parse(JSON.stringify(withMazda())) as OverlaySettings
    const principal = raw.savedLayouts.list[0] as unknown as Record<string, unknown>
    const options = principal.options as Record<string, Record<string, Record<string, unknown>>>
    const sections = options.sections as Record<string, Record<string, unknown>>
    sections.relative = { carsAhead: 99, carsBehind: 'many', bogus: 1 }
    sections.appearance = { fontScale: 150 }
    ;(options.widgets as Record<string, unknown>).relative = { backgroundOpacity: -3, visible: 9 }
    principal.mode = 'sideways'
    const s = normalizeSettings(raw)
    const p = layout(s, 'Principal')
    expect(p.mode).toBe('full')
    expect(p.options?.sections.relative.carsAhead).toBe(10)
    expect(p.options?.sections.relative.carsBehind).toBe(s.relative.carsBehind)
    expect(p.options?.sections.relative).not.toHaveProperty('bogus')
    expect(p.options?.sections).not.toHaveProperty('appearance')
    expect(p.options?.widgets.relative.backgroundOpacity).toBe(0)
    expect(p.options?.widgets.relative).not.toHaveProperty('visible')
  })

  it('drops the options a "Solo posición" layout has on disk', () => {
    const raw = JSON.parse(JSON.stringify(withMazda())) as OverlaySettings
    const p = raw.savedLayouts.list[0] as unknown as Record<string, unknown>
    p.mode = 'position'
    const s = normalizeSettings(raw)
    expect(layout(s, 'Principal').mode).toBe('position')
    expect(layout(s, 'Principal')).not.toHaveProperty('options')
  })
})

describe('live: changing an option', () => {
  it('with a "Posición y opciones" layout in use, writes into that layout only', () => {
    const s = change(withMazda(), (d) => void (d.radar.rangeM = 50))
    expect(layout(s, 'Mazda').options?.sections.radar.rangeM).toBe(50)
    expect(layout(s, 'Principal').options?.sections.radar.rangeM).toBe(DEFAULTS.radar.rangeM)
    expect(s.savedLayouts.shared?.sections.radar.rangeM).toBe(DEFAULTS.radar.rangeM)
  })

  it('through a patch from the settings window too', () => {
    const s = applySettingsPatch(withMazda(), {
      widgets: { fuel: { hideInPits: true } },
      fuel: { avgLaps: 8 }
    })
    expect(layout(s, 'Mazda').options?.widgets.fuel.hideInPits).toBe(true)
    expect(layout(s, 'Mazda').options?.sections.fuel.avgLaps).toBe(8)
    expect(layout(s, 'Principal').options?.sections.fuel.avgLaps).toBe(DEFAULTS.fuel.avgLaps)
  })

  it('with a "Solo posición" layout in use, writes into the shared options', () => {
    let s = change(withMazda(), (d) => void saveLayoutAs(d, 'Óvalo', 2, 'position'))
    s = change(s, (d) => void (d.radar.rangeM = 30))
    expect(s.savedLayouts.shared?.sections.radar.rangeM).toBe(30)
    expect(layout(s, 'Mazda').options?.sections.radar.rangeM).toBe(DEFAULTS.radar.rangeM)
    expect(layout(s, 'Óvalo')).not.toHaveProperty('options')
  })

  it('leaves the global options out of every layout', () => {
    const s = change(withMazda(), (d) => {
      d.appearance.units = 'imperial'
      d.visibility.showWhen = 'always'
    })
    const back = change(s, (d) => void applyLayout(d, 'layout-1'))
    expect(back.appearance.units).toBe('imperial')
    expect(back.visibility.showWhen).toBe('always')
  })
})

describe('a patch made for a layout no longer in use', () => {
  /** The settings window's slider value or list, sent after the tray applied another layout. */
  function late(s: OverlaySettings, patch: unknown, forLayout: string): OverlaySettings {
    const draft = settingsDraft(s)
    Object.assign(draft, applySettingsPatchFor(draft, patch, forLayout))
    return normalizeSettings(draft)
  }

  it('goes into that layout, never into the one in use, and nothing in effect changes', () => {
    // Principal in use, the radar at 30 m; the slider's last value (60) waits for the throttle.
    let s = change(withMazda(), (d) => void applyLayout(d, 'layout-1', 5))
    s = change(s, (d) => void (d.radar.rangeM = 30))
    // Mazda applied (the tray, a shortcut, the car), then the 60 arrives.
    s = change(s, (d) => void applyLayout(d, 'layout-2', 6))
    const before = optionSetOf(s)
    s = late(s, { radar: { rangeM: 60 }, widgets: { radar: { locked: true } } }, 'layout-1')
    expect(layout(s, 'Principal').options?.sections.radar.rangeM).toBe(60)
    expect(layout(s, 'Principal').widgets.radar.locked).toBe(true)
    expect(layout(s, 'Mazda').options?.sections.radar.rangeM).toBe(DEFAULTS.radar.rangeM)
    expect(s.savedLayouts.activeId).toBe('layout-2')
    expect(optionSetOf(s)).toEqual(before)
    expect(s.widgets.radar.locked).toBe(false)
    // The use stamps stay: the tray's recent list does not change.
    expect(layout(s, 'Mazda').usedAt).toBe(6)
    expect(layout(s, 'Principal').usedAt).toBe(5)
  })

  it('for a "Solo posición" layout, into the shared options; the global sections apply', () => {
    let s = change(withMazda(), (d) => void saveLayoutAs(d, 'Óvalo', 2, 'position'))
    s = change(s, (d) => void applyLayout(d, 'layout-2', 3))
    s = late(s, { fuel: { avgLaps: 9 }, appearance: { units: 'imperial' } }, 'layout-3')
    expect(s.savedLayouts.shared?.sections.fuel.avgLaps).toBe(9)
    expect(layout(s, 'Mazda').options?.sections.fuel.avgLaps).toBe(DEFAULTS.fuel.avgLaps)
    expect(s.fuel.avgLaps).toBe(DEFAULTS.fuel.avgLaps)
    expect(s.appearance.units).toBe('imperial')
    expect(layout(s, 'Óvalo')).not.toHaveProperty('options')
  })

  it('a list made on the layout left replaces only that layout’s list', () => {
    let s = change(withMazda(), (d) => void applyLayout(d, 'layout-1', 5))
    const mazdaColumns = layout(s, 'Mazda').options?.sections.standings.columns
    const columns = s.standings.columns.map((c) => (c.id === 'lic' ? { ...c, visible: false } : c))
    s = change(s, (d) => void applyLayout(d, 'layout-2', 6))
    s = late(s, { standings: { columns } }, 'layout-1')
    expect(layout(s, 'Principal').options?.sections.standings.columns).toEqual(columns)
    expect(layout(s, 'Mazda').options?.sections.standings.columns).toEqual(mazdaColumns)
    expect(s.standings.columns).toEqual(mazdaColumns)
  })

  it('made for the layout in use, or for none known, is a plain patch', () => {
    const s = withMazda()
    for (const forLayout of ['layout-2', undefined, 'layout-9', '../x', 7]) {
      expect(applySettingsPatchFor(s, { radar: { rangeM: 44 } }, forLayout)).toEqual(
        applySettingsPatch(s, { radar: { rangeM: 44 } })
      )
    }
  })
})

describe('applying a layout', () => {
  it('swaps the options with the places, in one change, and back', () => {
    const mazda = withMazda()
    const principal = change(mazda, (d) => void applyLayout(d, 'layout-1'))
    expect(principal.relative.carsAhead).toBe(DEFAULTS.relative.carsAhead)
    expect(principal.widgets.relative.backgroundOpacity).toBe(
      DEFAULTS.widgets.relative.backgroundOpacity
    )
    expect(principal.standings.columns).toEqual(DEFAULTS.standings.columns)
    // Mazda kept what was in effect when it was left.
    expect(layout(principal, 'Mazda').options).toEqual(optionSetOf(mazda))
    const back = change(principal, (d) => void applyLayout(d, 'layout-2'))
    expect(optionSetOf(back)).toEqual(optionSetOf(mazda))
    expect(snapshotWidgets(back.widgets)).toEqual(snapshotWidgets(mazda.widgets))
  })

  it('a "Solo posición" one moves the widgets and takes the shared options', () => {
    let s = withMazda()
    s = change(s, (d) => void setLayoutMode(d, 'layout-1', 'position'))
    s = change(s, (d) => void applyLayout(d, 'layout-1'))
    expect(optionSetOf(s)).toEqual(s.savedLayouts.shared)
    expect(s.relative.carsAhead).toBe(DEFAULTS.relative.carsAhead)
  })

  it('works on a draft that was not in line yet (what is in effect goes with the one left)', () => {
    const s = settingsDraft(withMazda())
    s.relative.carsAhead = 9
    applyLayout(s, 'layout-1')
    expect(layout(s, 'Mazda').options?.sections.relative.carsAhead).toBe(9)
    expect(s.relative.carsAhead).toBe(DEFAULTS.relative.carsAhead)
  })
})

describe('modes', () => {
  it('saving as "Solo posición": in use, without options, the shared ones in effect', () => {
    const s = change(withMazda(), (d) => void saveLayoutAs(d, 'Óvalo', 2, 'position'))
    const oval = layout(s, 'Óvalo')
    expect(s.savedLayouts.activeId).toBe(oval.id)
    expect(oval.mode).toBe('position')
    expect(oval).not.toHaveProperty('options')
    expect(s.relative.carsAhead).toBe(DEFAULTS.relative.carsAhead)
    // Its places are the ones you had.
    expect(oval.widgets).toEqual(layout(withMazda(), 'Mazda').widgets)
  })

  it('"Posición y opciones" when saving keeps what is in effect', () => {
    const s = change(withMazda(), (d) => void saveLayoutAs(d, 'GT3', 2))
    expect(layout(s, 'GT3').options).toEqual(optionSetOf(s))
    expect(s.relative.carsAhead).toBe(6)
  })

  it('to "Solo posición": the one in use drops its options and takes the shared ones', () => {
    const s = change(withMazda(), (d) =>
      expect(setLayoutMode(d, 'layout-2', 'position')).toBe(true)
    )
    expect(layout(s, 'Mazda').mode).toBe('position')
    expect(layout(s, 'Mazda')).not.toHaveProperty('options')
    expect(s.relative.carsAhead).toBe(DEFAULTS.relative.carsAhead)
    // The places stay.
    expect(snapshotWidgets(s.widgets)).toEqual(snapshotWidgets(withMazda().widgets))
  })

  it('to "Posición y opciones": a copy of the shared options, nothing changes now', () => {
    let s = change(withMazda(), (d) => void setLayoutMode(d, 'layout-2', 'position'))
    const before = optionSetOf(s)
    s = change(s, (d) => void setLayoutMode(d, 'layout-2', 'full'))
    expect(layout(s, 'Mazda').options).toEqual(before)
    expect(optionSetOf(s)).toEqual(before)
    // Its own from now on: a change does not reach the shared options.
    s = change(s, (d) => void (d.radar.rangeM = 10))
    expect(s.savedLayouts.shared?.sections.radar.rangeM).toBe(DEFAULTS.radar.rangeM)
  })

  it('does nothing for an unknown layout or the mode it has', () => {
    const s = withMazda()
    expect(setLayoutMode(s, 'nope', 'position')).toBe(false)
    expect(setLayoutMode(s, 'layout-1', 'full')).toBe(false)
  })

  it('a duplicate keeps the mode and its own copy of the options', () => {
    let s = change(withMazda(), (d) => void duplicateLayout(d, 'layout-2', 'Mazda (copia)'))
    const copy = layout(s, 'Mazda (copia)')
    expect(copy.mode).toBe('full')
    expect(copy.options).toEqual(layout(s, 'Mazda').options)
    s = change(s, (d) => void (d.relative.carsAhead = 2))
    expect(layout(s, 'Mazda (copia)').options?.sections.relative.carsAhead).toBe(6)
    s = change(s, (d) => void setLayoutMode(d, 'layout-1', 'position'))
    s = change(s, (d) => void duplicateLayout(d, 'layout-1', 'P2'))
    expect(layout(s, 'P2').mode).toBe('position')
  })
})

describe('"Copiar estas opciones a todas"', () => {
  it('copies one widget’s options into every full layout and the shared ones, nothing else', () => {
    let s = withMazda()
    s = change(s, (d) => void saveLayoutAs(d, 'Óvalo', 2, 'position'))
    s = change(s, (d) => void applyLayout(d, 'layout-2'))
    s = change(s, (d) => expect(applyWidgetOptionsToAll(d, 'relative')).toBe(true))
    for (const set of [layout(s, 'Principal').options, s.savedLayouts.shared]) {
      expect(set?.sections.relative).toEqual(s.relative)
      expect(set?.widgets.relative).toEqual(optionSetOf(s).widgets.relative)
      // Another widget's are its own still.
      expect(set?.sections.standings).toEqual(DEFAULTS.standings)
    }
    expect(layout(s, 'Óvalo')).not.toHaveProperty('options')
    // Again: nothing left to change.
    change(s, (d) => expect(applyWidgetOptionsToAll(d, 'relative')).toBe(false))
  })

  it('never changes a place', () => {
    const s = withMazda()
    const after = change(s, (d) => void applyWidgetOptionsToAll(d, 'relative'))
    for (const l of after.savedLayouts.list) {
      expect(l.widgets).toEqual(layout(s, l.name).widgets)
    }
  })
})

describe('files', () => {
  it('version 2 carries a full layout’s options; imported "Posición y opciones" it keeps them', () => {
    const src = withMazda()
    const text = layoutFileText(layout(src, 'Mazda'))
    const target = createDefaultSettings()
    const parsed = parseLayoutFile(text, fallbackOf(target))
    if (!parsed.ok) throw new Error(parsed.error)
    const s = change(target, (d) => void importLayout(d, parsed, 'Importada', 'full'))
    const imported = layout(s, 'Mazda')
    expect(imported.mode).toBe('full')
    expect(imported.options).toEqual(layout(src, 'Mazda').options)
    // Not applied.
    expect(s.relative.carsAhead).toBe(DEFAULTS.relative.carsAhead)
  })

  it('imported "Solo posición": the places only', () => {
    const text = layoutFileText(layout(withMazda(), 'Mazda'))
    const target = createDefaultSettings()
    const parsed = parseLayoutFile(text, fallbackOf(target))
    if (!parsed.ok) throw new Error(parsed.error)
    const s = change(target, (d) => void importLayout(d, parsed, 'Importada', 'position'))
    expect(layout(s, 'Mazda').mode).toBe('position')
    expect(layout(s, 'Mazda')).not.toHaveProperty('options')
  })

  it('a version 1 file imported "Posición y opciones" takes a copy of the shared options', () => {
    const v1 = JSON.stringify({
      format: LAYOUT_FILE_FORMAT,
      version: 1,
      name: 'Viejo',
      widgets: snapshotWidgets(DEFAULTS.widgets)
    })
    // The shared options differ from those in effect: a full layout is in use.
    let target = change(withMazda(), (d) => void setLayoutMode(d, 'layout-1', 'position'))
    target = change(target, (d) => void applyLayout(d, 'layout-1'))
    target = change(target, (d) => void (d.radar.rangeM = 30))
    target = change(target, (d) => void applyLayout(d, 'layout-2'))
    const parsed = parseLayoutFile(v1, fallbackOf(target))
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.options).toBeNull()
    const s = change(target, (d) => void importLayout(d, parsed, 'Importada'))
    expect(layout(s, 'Viejo').mode).toBe('full')
    expect(layout(s, 'Viejo').options?.sections.radar.rangeM).toBe(30)
    expect(layout(s, 'Viejo').options).toEqual(target.savedLayouts.shared)
  })

  it('exports a "Solo posición" layout without options', () => {
    const s = change(withMazda(), (d) => void setLayoutMode(d, 'layout-1', 'position'))
    const raw = JSON.parse(layoutFileText(layout(s, 'Principal'))) as Record<string, unknown>
    expect(raw).not.toHaveProperty('options')
    expect(raw.version).toBe(2)
  })

  it('reads the options of a file through the schema: invalid fields and unknown sections go', () => {
    const raw = JSON.parse(layoutFileText(layout(withMazda(), 'Mazda'))) as {
      options: { sections: Record<string, unknown>; widgets: Record<string, unknown> }
    }
    raw.options.sections.relative = { carsAhead: -4, columns: 'all' }
    raw.options.sections.shortcuts = { toggleOverlay: 'Ctrl+A' }
    raw.options.widgets.radar = { showIn: { race: false }, bounds: { x: 1 } }
    raw.options.widgets.pitboard = { backgroundOpacity: 1 }
    const fallback = fallbackOf(createDefaultSettings())
    const parsed = parseLayoutFile(JSON.stringify(raw), fallback)
    if (!parsed.ok || !parsed.options) throw new Error('not parsed')
    expect(parsed.options.sections.relative.carsAhead).toBe(0)
    expect(parsed.options.sections.relative.columns).toEqual(
      fallback.options.sections.relative.columns
    )
    expect(parsed.options.sections).not.toHaveProperty('shortcuts')
    expect(parsed.options.widgets.radar.showIn).toEqual({
      practice: true,
      qualify: true,
      race: false
    })
    expect(parsed.options.widgets.radar).not.toHaveProperty('bounds')
    expect(parsed.options.widgets).not.toHaveProperty('pitboard')
  })
})

describe('what the renderers receive', () => {
  function thirty(): OverlaySettings {
    let s = createDefaultSettings()
    for (let i = 1; i < MAX_LAYOUTS; i++) {
      s = change(s, (d) => {
        d.relative.carsAhead = i % 10
        saveLayoutAs(d, `L${i}`, i)
      })
    }
    return s
  }

  it('the settings window: every layout, no options; the overlays: the one in use only', () => {
    const s = thirty()
    const win = rendererSettings(s, 'settings')
    expect(win.savedLayouts.list).toHaveLength(MAX_LAYOUTS)
    for (const l of win.savedLayouts.list) expect(l).not.toHaveProperty('options')
    expect(win.savedLayouts).not.toHaveProperty('shared')
    expect(win.savedLayouts.links).toBe(s.savedLayouts.links)
    const ov = rendererSettings(s, 'overlay')
    expect(ov.savedLayouts.list.map((l) => l.id)).toEqual([s.savedLayouts.activeId])
    // The options in effect are all there, at the top level.
    expect(optionSetOf(win)).toEqual(optionSetOf(s))
    expect(optionSetOf(ov)).toEqual(optionSetOf(s))
    // The store's own copy is untouched.
    expect(s.savedLayouts.list.every((l) => l.options !== undefined)).toBe(true)
  })

  it('stays small with 30 full layouts (the store has them all)', () => {
    const s = thirty()
    const size = (x: unknown): number => JSON.stringify(x).length
    expect(size(s)).toBeGreaterThan(250_000)
    expect(size(rendererSettings(s, 'settings'))).toBeLessThan(60_000)
    expect(size(rendererSettings(s, 'overlay'))).toBeLessThan(20_000)
  })
})

describe('sealed option sets', () => {
  it('are frozen, kept by a draft and taken as they are by normalisation', () => {
    const s = withMazda()
    const mazda = layout(s, 'Mazda').options
    const principal = layout(s, 'Principal').options
    expect(isSealedOptionSet(principal)).toBe(true)
    expect(Object.isFrozen(principal?.sections.relative.columns)).toBe(true)
    const draft = settingsDraft(s)
    expect(layout(draft, 'Principal').options).toBe(principal)
    // Everything else is a copy.
    expect(draft.relative).not.toBe(s.relative)
    expect(draft.savedLayouts.list[0]?.widgets).not.toBe(s.savedLayouts.list[0]?.widgets)
    const again = normalizeSettings(draft)
    expect(layout(again, 'Principal').options).toBe(principal)
    // The active layout's is the options in effect, new.
    expect(layout(again, 'Mazda').options).toEqual(mazda)
    expect(() => {
      ;(principal as { widgets: { radar: { hideInPits: boolean } } }).widgets.radar.hideInPits =
        true
    }).toThrow()
  })

  it('an unsealed set (from a file) is validated; the result is sealed', () => {
    const raw = JSON.parse(JSON.stringify(optionSetOf(DEFAULTS))) as unknown
    const set = normalizeOptionSet(raw, optionSetOf(DEFAULTS))
    expect(set).not.toBe(raw)
    expect(isSealedOptionSet(set)).toBe(true)
    expect(deepEqual(set, raw)).toBe(true)
    expect(normalizeOptionSet(set, optionSetOf(DEFAULTS))).toBe(set)
  })
})
