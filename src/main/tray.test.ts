import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings } from '@shared/settings'
import type { OverlaySettings } from '@shared/types'
import {
  createTray,
  destroyTray,
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
  setWidgetVisible: () => {},
  setRadarRange: () => {},
  setEditMode: () => {},
  openSettingsFolder: () => {},
  quit: () => {}
}

function state(settings: OverlaySettings, autoHidden: TrayState['autoHidden'] = {}): TrayState {
  return {
    status: { state: 'mock', source: 'mock', note: 'none', detail: '' },
    settings,
    editMode: false,
    autoHidden
  }
}

function widgetItems(): MenuItem[] {
  return (fake.menus.at(-1) ?? []).filter(
    (i) => i.type === 'checkbox' && i.label !== 'Modo edición' && i.label !== 'Edit mode'
  )
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
      'Radar: alcance',
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
