import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyLayout, linkCar, renameLayout, saveLayoutAs } from '@shared/layouts'
import { createDefaultSettings } from '@shared/settings'
import type { OverlaySettings } from '@shared/types'
import { WIDGET_IDS } from '@shared/widgets'
import {
  commonHiddenReason,
  createTray,
  destroyTray,
  layoutsMenu,
  loadIcon,
  taskbarTheme,
  updateTray,
  widgetLabel,
  type TrayState
} from './tray'

interface MenuItem {
  label?: string
  type?: string
  checked?: boolean
  enabled?: boolean
  accelerator?: string
  registerAccelerator?: boolean
  click?: (item: { checked: boolean }) => void
  submenu?: MenuItem[]
}

/** What the fake nativeImage was built from: one entry per representation. */
interface FakeImage {
  reps: { scaleFactor: number; file: string }[]
}

const fake = vi.hoisted(() => ({
  menus: [] as MenuItem[][],
  tooltips: [] as string[],
  /** Images the tray was given (constructor, then setImage). */
  images: [] as unknown[],
  /** Files that exist; createFromPath of any other gives an empty image. */
  missing: new Set<string>(),
  darkTaskbar: true,
  themeListeners: new Set<() => void>()
}))

vi.mock('electron', () => ({
  Menu: { buildFromTemplate: (template: MenuItem[]) => template },
  Tray: class {
    constructor(image: unknown) {
      fake.images.push(image)
    }
    readonly on = vi.fn()
    setToolTip(text: string): void {
      fake.tooltips.push(text)
    }
    setImage(image: unknown): void {
      fake.images.push(image)
    }
    readonly destroy = vi.fn()
    setContextMenu(menu: MenuItem[]): void {
      fake.menus.push(menu)
    }
    isDestroyed(): boolean {
      return false
    }
  },
  nativeImage: {
    createEmpty: () => {
      const reps: { scaleFactor: number; file: string }[] = []
      return {
        reps,
        addRepresentation: (o: { scaleFactor: number; buffer: Buffer }) =>
          reps.push({ scaleFactor: o.scaleFactor, file: o.buffer.toString() })
      }
    },
    createFromPath: (file: string) => ({
      isEmpty: () => fake.missing.has(file),
      toPNG: () => Buffer.from(file)
    })
  },
  nativeTheme: {
    get shouldUseDarkColorsForSystemIntegratedUI() {
      return fake.darkTaskbar
    },
    on: (_event: string, cb: () => void) => fake.themeListeners.add(cb),
    removeListener: (_event: string, cb: () => void) => fake.themeListeners.delete(cb)
  }
}))
vi.mock('../../resources/tray/tray-dark-16.png?asset', () => ({ default: 'dark-16.png' }))
vi.mock('../../resources/tray/tray-dark-20.png?asset', () => ({ default: 'dark-20.png' }))
vi.mock('../../resources/tray/tray-dark-24.png?asset', () => ({ default: 'dark-24.png' }))
vi.mock('../../resources/tray/tray-dark-32.png?asset', () => ({ default: 'dark-32.png' }))
vi.mock('../../resources/tray/tray-light-16.png?asset', () => ({ default: 'light-16.png' }))
vi.mock('../../resources/tray/tray-light-20.png?asset', () => ({ default: 'light-20.png' }))
vi.mock('../../resources/tray/tray-light-24.png?asset', () => ({ default: 'light-24.png' }))
vi.mock('../../resources/tray/tray-light-32.png?asset', () => ({ default: 'light-32.png' }))

const ACTIONS = {
  openSettings: () => {},
  applyLayout: () => {},
  setWidgetVisible: () => {},
  setRadarRange: () => {},
  setShowWhen: () => {},
  setEditMode: () => {},
  setOverlayHidden: () => {},
  openSettingsFolder: () => {},
  quit: () => {}
}

function state(settings: OverlaySettings, autoHidden: TrayState['autoHidden'] = {}): TrayState {
  return {
    status: { state: 'mock', source: 'mock', note: 'none', detail: '' },
    settings,
    editMode: false,
    overlayHidden: false,
    autoHidden
  }
}

const MODE_LABELS = new Set(['Modo edición', 'Edit mode', 'Mostrar el overlay', 'Show the overlay'])

function widgetItems(): MenuItem[] {
  return (fake.menus.at(-1) ?? []).filter(
    (i) => i.type === 'checkbox' && !MODE_LABELS.has(i.label ?? '')
  )
}

/** The item of the last menu with this label. */
function item(label: string): MenuItem {
  const found = (fake.menus.at(-1) ?? []).find((i) => i.label === label)
  if (!found) throw new Error(`no menu item ${label}`)
  return found
}

function english(settings: OverlaySettings): OverlaySettings {
  settings.appearance.language = 'en'
  return settings
}

/** Every label of the last menu, submenus included, in order. */
function labels(): string[] {
  const out: string[] = []
  const walk = (items: MenuItem[]): void => {
    for (const i of items) {
      if (i.label !== undefined) out.push(i.label)
      if (i.submenu) walk(i.submenu)
    }
  }
  walk(fake.menus.at(-1) ?? [])
  return out
}

afterEach(() => {
  destroyTray()
  fake.menus = []
  fake.tooltips = []
  fake.images = []
  fake.missing.clear()
  fake.darkTaskbar = true
})

describe('tray icon', () => {
  it('has the art of the taskbar theme for every display scale', () => {
    expect((loadIcon('dark') as unknown as FakeImage).reps).toEqual([
      { scaleFactor: 1, file: 'dark-16.png' },
      { scaleFactor: 1.25, file: 'dark-20.png' },
      { scaleFactor: 1.5, file: 'dark-24.png' },
      { scaleFactor: 2, file: 'dark-32.png' }
    ])
    expect((loadIcon('light') as unknown as FakeImage).reps.map((r) => r.file)).toEqual([
      'light-16.png',
      'light-20.png',
      'light-24.png',
      'light-32.png'
    ])
  })

  it('skips a missing size with a warning instead of failing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fake.missing.add('dark-20.png')
    const reps = (loadIcon('dark') as unknown as FakeImage).reps
    expect(reps.map((r) => r.scaleFactor)).toEqual([1, 1.5, 2])
    expect(warn).toHaveBeenCalledOnce()
  })

  it('follows the taskbar theme, and stops listening once destroyed', () => {
    fake.darkTaskbar = false
    expect(taskbarTheme()).toBe('light')
    createTray(state(createDefaultSettings()), ACTIONS)
    const first = fake.images[0] as FakeImage
    expect(first.reps[0]?.file).toBe('light-16.png')
    expect(fake.themeListeners.size).toBe(1)

    // An 'updated' that does not change the taskbar (the apps' theme, say) keeps the icon.
    for (const cb of fake.themeListeners) cb()
    expect(fake.images).toHaveLength(1)

    fake.darkTaskbar = true
    for (const cb of fake.themeListeners) cb()
    expect(fake.images).toHaveLength(2)
    expect((fake.images[1] as FakeImage).reps[0]?.file).toBe('dark-16.png')

    destroyTray()
    expect(fake.themeListeners.size).toBe(0)
  })
})

describe('widgetLabel', () => {
  it('adds the rule that hides the widget, in lower case', () => {
    expect(widgetLabel('es', 'battle', undefined)).toBe('Batalla')
    expect(widgetLabel('es', 'battle', 'practice')).toBe('Batalla (oculto en práctica)')
    expect(widgetLabel('es', 'inputs', 'pits')).toBe('Pedales (oculto en boxes)')
    expect(widgetLabel('es', 'battle', null)).toBe('Batalla (oculto)')
  })

  it('speaks English', () => {
    expect(widgetLabel('en', 'battle', undefined)).toBe('Battle')
    expect(widgetLabel('en', 'battle', 'practice')).toBe('Battle (hidden in practice)')
    expect(widgetLabel('en', 'inputs', 'pits')).toBe('Inputs (hidden in the pits)')
    expect(widgetLabel('en', 'standings', 'qualify')).toBe('Standings (hidden in qualifying)')
  })
})

describe('tray menu', () => {
  it('keeps the checkbox as what the user enabled and notes a rule only on enabled widgets', () => {
    const settings = createDefaultSettings()
    settings.widgets.inputs.visible = false
    createTray(state(settings, { battle: 'practice', inputs: 'pits' }), ACTIONS)
    const items = widgetItems()
    expect(items.find((i) => i.label?.startsWith('Batalla'))).toMatchObject({
      label: 'Batalla (oculto en práctica)',
      checked: true
    })
    expect(items.find((i) => i.label?.startsWith('Pedales'))).toMatchObject({
      label: 'Pedales',
      checked: false
    })
  })

  it('rebuilds the menu only when a rule note changes', () => {
    const settings = createDefaultSettings()
    createTray(state(settings), ACTIONS)
    updateTray(state(settings))
    expect(fake.menus).toHaveLength(1)
    updateTray(state(settings, { battle: 'practice' }))
    expect(fake.menus).toHaveLength(2)
    // Hidden for no known reason is a change too.
    updateTray(state(settings, { battle: null }))
    expect(fake.menus).toHaveLength(3)
    updateTray(state(settings, { battle: null }))
    expect(fake.menus).toHaveLength(3)
  })

  it('words everything in Spanish by default, the status from its codes', () => {
    createTray(state(createDefaultSettings(), { battle: 'practice' }), ACTIONS)
    const all = labels()
    expect(all[0]).toBe('Modo simulado (mock)')
    for (const label of [
      'Ajustes…',
      'Relativo',
      'Batalla (oculto en práctica)',
      'Alcance del radar',
      'Modo edición',
      'Abrir carpeta de ajustes',
      'Salir'
    ]) {
      expect(all).toContain(label)
    }
    expect(fake.tooltips.at(-1)).toBe('OverLap · Modo simulado (mock)')
  })

  it('speaks English when the interface language is English', () => {
    const s = state(english(createDefaultSettings()), { battle: 'practice' })
    s.status = { state: 'error', source: 'iracing', note: 'none', detail: 'boom' }
    createTray(s, ACTIONS)
    const all = labels()
    expect(all[0]).toBe('Telemetry error: boom')
    for (const label of [
      'Settings…',
      'Relative',
      'Standings',
      'Battle (hidden in practice)',
      'Inputs',
      'Radar range',
      '20 m',
      'Edit mode',
      'Open settings folder',
      'Quit'
    ]) {
      expect(all).toContain(label)
    }
    expect(all.some((l) => /Ajustes|Salir|Modo|Oculto|oculto/.test(l))).toBe(false)
    expect(fake.tooltips.at(-1)).toBe('OverLap · Telemetry error: boom')
  })

  it('rebuilds the menu and tooltip when the language changes, and only then', () => {
    const settings = createDefaultSettings()
    createTray(state(settings), ACTIONS)
    updateTray(state(english(createDefaultSettings())))
    expect(fake.menus).toHaveLength(2)
    expect(labels()).toContain('Settings…')
    expect(fake.tooltips.at(-1)).toBe('OverLap · Simulated mode (mock)')
    updateTray(state(english(createDefaultSettings())))
    expect(fake.menus).toHaveLength(2)
    updateTray(state(createDefaultSettings()))
    expect(fake.menus).toHaveLength(3)
    expect(labels()).toContain('Ajustes…')
  })
})

describe('tray menu: hiding the overlay and the shortcuts', () => {
  it('has a show checkbox (checked: shown, as the widgets) next to edit mode, with shortcuts', () => {
    createTray(state(createDefaultSettings()), ACTIONS)
    expect(item('Mostrar el overlay')).toMatchObject({
      type: 'checkbox',
      checked: true,
      accelerator: 'Ctrl+Shift+H',
      registerAccelerator: false
    })
    expect(item('Modo edición')).toMatchObject({
      type: 'checkbox',
      checked: false,
      accelerator: 'Ctrl+Shift+E',
      registerAccelerator: false
    })
    const all = labels()
    expect(all.indexOf('Mostrar el overlay')).toBe(all.indexOf('Modo edición') - 1)
  })

  it('unchecks it while hidden and says so in the tooltip', () => {
    const s = state(createDefaultSettings())
    s.overlayHidden = true
    createTray(s, ACTIONS)
    expect(item('Mostrar el overlay').checked).toBe(false)
    expect(fake.tooltips.at(-1)).toBe('OverLap · Overlay oculto · Modo simulado (mock)')
    const en = state(english(createDefaultSettings()))
    en.overlayHidden = true
    updateTray(en)
    expect(item('Show the overlay').checked).toBe(false)
    expect(fake.tooltips.at(-1)).toBe('OverLap · Overlay hidden · Simulated mode (mock)')
  })

  it('shows the configured combinations, and none for a shortcut turned off', () => {
    const settings = createDefaultSettings()
    settings.shortcuts = {
      toggleOverlay: 'F13',
      toggleEditMode: '',
      cycleDeltaReference: '',
      nextLayout: '',
      openSettings: ''
    }
    createTray(state(settings), ACTIONS)
    expect(item('Mostrar el overlay')).toMatchObject({
      accelerator: 'F13',
      registerAccelerator: false
    })
    expect(item('Modo edición').accelerator).toBeUndefined()
    expect(item('Modo edición').registerAccelerator).toBeUndefined()
  })

  it('rebuilds the menu when the hidden state or a shortcut changes', () => {
    const settings = createDefaultSettings()
    createTray(state(settings), ACTIONS)
    const hidden = state(settings)
    hidden.overlayHidden = true
    updateTray(hidden)
    expect(fake.menus).toHaveLength(2)
    const changed = createDefaultSettings()
    changed.shortcuts.toggleOverlay = 'Ctrl+Alt+H'
    updateTray({ ...hidden, settings: changed })
    expect(fake.menus).toHaveLength(3)
    expect(item('Mostrar el overlay').accelerator).toBe('Ctrl+Alt+H')
  })

  it('hides and shows through the action', () => {
    const setOverlayHidden = vi.fn()
    createTray(state(createDefaultSettings()), { ...ACTIONS, setOverlayHidden })
    // Unchecked: hidden; checked again: shown.
    item('Mostrar el overlay').click?.({ checked: false })
    expect(setOverlayHidden).toHaveBeenLastCalledWith(true)
    item('Mostrar el overlay').click?.({ checked: true })
    expect(setOverlayHidden).toHaveBeenLastCalledWith(false)
  })
})

describe('tray menu: when to show the overlay', () => {
  /** Every enabled widget hidden by `reason`. */
  function allHidden(settings: OverlaySettings, reason: 'out-of-car' | 'not-race'): TrayState {
    return state(
      settings,
      Object.fromEntries(
        WIDGET_IDS.filter((id) => settings.widgets[id].visible).map((id) => [id, reason])
      )
    )
  }

  it('offers the three choices, the current one checked, and sets them through the action', () => {
    const setShowWhen = vi.fn()
    createTray(state(createDefaultSettings()), { ...ACTIONS, setShowWhen })
    const menu = item('Cuándo mostrar')
    expect(menu.submenu?.map((i) => [i.label, i.type, i.checked])).toEqual([
      ['Solo cuando estás en el coche', 'radio', true],
      ['Solo en carrera', 'radio', false],
      ['Siempre', 'radio', false]
    ])
    menu.submenu?.[2]?.click?.({ checked: true })
    expect(setShowWhen).toHaveBeenCalledWith('always')
    // After the radar range, before the show checkbox.
    const all = labels()
    expect(all.indexOf('Cuándo mostrar')).toBeGreaterThan(all.indexOf('Alcance del radar'))
    expect(all.indexOf('Cuándo mostrar')).toBeLessThan(all.indexOf('Mostrar el overlay'))
  })

  it('checks the choice of the settings and speaks English', () => {
    const settings = english(createDefaultSettings())
    settings.visibility.showWhen = 'race'
    createTray(state(settings), ACTIONS)
    expect(item('When to show').submenu?.map((i) => [i.label, i.checked])).toEqual([
      ['Only when you are in the car', false],
      ['Races only', true],
      ['Always', false]
    ])
  })

  it('says once, under the status and in the tooltip, why every widget is hidden', () => {
    createTray(allHidden(createDefaultSettings(), 'out-of-car'), ACTIONS)
    const menu = fake.menus.at(-1) ?? []
    expect(menu[0]?.label).toBe('Modo simulado (mock)')
    expect(menu[1]).toEqual({ label: 'Oculto: fuera del coche', enabled: false })
    // No note repeated on every widget.
    expect(widgetItems().map((i) => i.label)).toContain('Relativo')
    expect(widgetItems().every((i) => !i.label?.includes('oculto'))).toBe(true)
    expect(fake.tooltips.at(-1)).toBe('OverLap · Oculto: fuera del coche · Modo simulado (mock)')

    const en = allHidden(english(createDefaultSettings()), 'not-race')
    updateTray(en)
    expect(fake.menus.at(-1)?.[1]).toEqual({ label: 'Hidden: races only', enabled: false })
    expect(fake.tooltips.at(-1)).toBe('OverLap · Hidden: races only · Simulated mode (mock)')
    // The user's own hiding says so first.
    updateTray({ ...en, overlayHidden: true })
    expect(fake.tooltips.at(-1)).toBe('OverLap · Overlay hidden · Simulated mode (mock)')
  })

  it('notes each widget when they are not all hidden for one reason', () => {
    const settings = createDefaultSettings()
    // The standings stay on the session screen: the others note why they are hidden.
    const s = allHidden(settings, 'out-of-car')
    delete s.autoHidden.standings
    createTray(s, ACTIONS)
    expect(fake.menus.at(-1)?.[1]).toEqual({ type: 'separator' })
    expect(labels()).toContain('Relativo (oculto: fuera del coche)')
    expect(labels()).toContain('Posiciones')
    expect(fake.tooltips.at(-1)).toBe('OverLap · Modo simulado (mock)')
  })

  it('finds the common reason among the enabled widgets only', () => {
    const settings = createDefaultSettings()
    for (const id of WIDGET_IDS) settings.widgets[id].visible = id === 'relative'
    expect(commonHiddenReason({ settings, autoHidden: { relative: 'garage' } })).toBe('garage')
    expect(commonHiddenReason({ settings, autoHidden: { relative: null } })).toBeUndefined()
    expect(commonHiddenReason({ settings, autoHidden: { radar: 'garage' } })).toBeUndefined()
    settings.widgets.radar.visible = true
    expect(
      commonHiddenReason({ settings, autoHidden: { relative: 'garage', radar: 'ui-hidden' } })
    ).toBeUndefined()
    // Nothing enabled: nothing to say.
    for (const id of WIDGET_IDS) settings.widgets[id].visible = false
    expect(commonHiddenReason({ settings, autoHidden: {} })).toBeUndefined()
  })

  it('rebuilds the menu when the choice changes', () => {
    const settings = createDefaultSettings()
    createTray(state(settings), ACTIONS)
    const changed = createDefaultSettings()
    changed.visibility.showWhen = 'always'
    updateTray(state(changed))
    expect(fake.menus).toHaveLength(2)
    expect(item('Cuándo mostrar').submenu?.[2]?.checked).toBe(true)
  })
})

describe('tray layouts submenu', () => {
  function withLayouts(): OverlaySettings {
    const s = createDefaultSettings()
    saveLayoutAs(s, 'Mazda')
    saveLayoutAs(s, 'GT3')
    s.savedLayouts.activeId = 'layout-2'
    return s
  }

  it('lists the layouts in order, the one in use checked, then the settings page', () => {
    const s = withLayouts()
    const menu = layoutsMenu(state(s), ACTIONS)
    expect(menu.map((i) => [i.label, i.type, i.checked])).toEqual([
      ['Principal', 'radio', false],
      ['Mazda', 'radio', true],
      ['GT3', 'radio', false],
      [undefined, 'separator', undefined],
      ['Gestionar disposiciones…', undefined, undefined]
    ])
  })

  it('is in the menu, after the show-when choices, and applies the clicked layout', () => {
    const applyLayout = vi.fn()
    const openSettings = vi.fn()
    createTray(state(withLayouts()), { ...ACTIONS, applyLayout, openSettings })
    const sub = item('Disposición').submenu ?? []
    sub[2]?.click?.({ checked: true })
    expect(applyLayout).toHaveBeenCalledWith('layout-3')
    sub.at(-1)?.click?.({ checked: false })
    expect(openSettings).toHaveBeenCalledExactlyOnceWith('layouts')
    const labels = (fake.menus.at(-1) ?? []).map((i) => i.label)
    expect(labels.indexOf('Disposición')).toBe(labels.indexOf('Cuándo mostrar') + 1)
  })

  it('marks the layout of the car you are in while the automatic mode is on', () => {
    const s = withLayouts()
    linkCar(s, { carId: 67, carName: 'Mazda MX-5 Cup' }, 'layout-2')
    const labels = (st: TrayState): (string | undefined)[] =>
      layoutsMenu(st, ACTIONS).map((i) => i.label)
    expect(labels({ ...state(s), carId: 67 })[1]).toBe('Mazda')
    s.layouts.autoSwitch = true
    expect(labels({ ...state(s), carId: 67 })[1]).toBe('Mazda · coche actual')
    expect(labels({ ...state(s), carId: 99 })[1]).toBe('Mazda')
    s.appearance.language = 'en'
    expect(layoutsMenu({ ...state(s), carId: 67 }, ACTIONS).at(-1)?.label).toBe('Manage layouts…')
  })

  /** Principal and `n - 1` more ('L2'...), saved a second apart; 'L2' in use last. */
  function manyLayouts(n: number): OverlaySettings {
    const s = createDefaultSettings()
    for (let i = 2; i <= n; i++) saveLayoutAs(s, `L${i}`, i * 1_000)
    applyLayout(s, 'layout-2', 100_000)
    return s
  }

  it('past five layouts: the one in use, then the latest used first, then only "Más…"', () => {
    const s = manyLayouts(30)
    const openSettings = vi.fn()
    const menu = layoutsMenu(state(s), { ...ACTIONS, openSettings })
    expect(menu.map((i) => [i.label, i.type, i.checked])).toEqual([
      ['L2', 'radio', true],
      ['L30', 'radio', false],
      ['L29', 'radio', false],
      ['L28', 'radio', false],
      ['L27', 'radio', false],
      [undefined, 'separator', undefined],
      ['Más…', undefined, undefined]
    ])
    ;(menu[6]?.click as (() => void) | undefined)?.()
    expect(openSettings).toHaveBeenCalledExactlyOnceWith('layouts')
    // The car you are in keeps its layout listed, marked.
    linkCar(s, { carId: 67, carName: 'Mazda MX-5 Cup' }, 'layout-1')
    s.layouts.autoSwitch = true
    expect(layoutsMenu({ ...state(s), carId: 67 }, ACTIONS).map((i) => i.label)).toEqual([
      'L2',
      'Principal · coche actual',
      'L30',
      'L29',
      'L28',
      undefined,
      'Más…'
    ])
    s.appearance.language = 'en'
    expect(layoutsMenu(state(s), ACTIONS).at(-1)?.label).toBe('More…')
  })

  it('lists five layouts whole, without "Más…"; an old file (no usedAt) falls back to the order', () => {
    expect(layoutsMenu(state(manyLayouts(5)), ACTIONS).map((i) => i.label)).toEqual([
      'Principal',
      'L2',
      'L3',
      'L4',
      'L5',
      undefined,
      'Gestionar disposiciones…'
    ])
    const old = manyLayouts(8)
    for (const l of old.savedLayouts.list) delete l.usedAt
    old.savedLayouts.activeId = 'layout-6'
    expect(layoutsMenu(state(old), ACTIONS).map((i) => i.label)).toEqual([
      'L6',
      'Principal',
      'L2',
      'L3',
      'L4',
      undefined,
      'Más…'
    ])
  })

  it('rebuilds the menu when another layout becomes a recent one', () => {
    const s = manyLayouts(8)
    createTray(state(s), ACTIONS)
    const next = structuredClone(s)
    applyLayout(next, 'layout-3', 200_000)
    updateTray(state(next))
    expect(fake.menus).toHaveLength(2)
    expect(item('Disposición').submenu?.map((i) => i.label)).toContain('L3')
  })

  it('rebuilds the menu when a layout is renamed, added or applied, not otherwise', () => {
    const s = withLayouts()
    createTray(state(s), ACTIONS)
    updateTray(state(structuredClone(s)))
    expect(fake.menus).toHaveLength(1)
    const renamed = structuredClone(s)
    renameLayout(renamed, 'layout-3', 'GT3 R')
    updateTray(state(renamed))
    const applied = structuredClone(renamed)
    applied.savedLayouts.activeId = 'layout-1'
    updateTray(state(applied))
    expect(fake.menus).toHaveLength(3)
    expect(item('Disposición').submenu?.[0]?.checked).toBe(true)
    expect(item('Disposición').submenu?.[2]?.label).toBe('GT3 R')
  })
})
