import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings } from '@shared/settings'
import type { OverlaySettings } from '@shared/types'
import { createTray, destroyTray, updateTray, widgetLabel, type TrayState } from './tray'

interface MenuItem {
  label?: string
  type?: string
  checked?: boolean
  enabled?: boolean
  submenu?: MenuItem[]
}

const fake = vi.hoisted(() => ({ menus: [] as MenuItem[][], tooltips: [] as string[] }))

vi.mock('electron', () => ({
  Menu: { buildFromTemplate: (template: MenuItem[]) => template },
  Tray: class {
    readonly on = vi.fn()
    setToolTip(text: string): void {
      fake.tooltips.push(text)
    }
    readonly destroy = vi.fn()
    setContextMenu(menu: MenuItem[]): void {
      fake.menus.push(menu)
    }
    isDestroyed(): boolean {
      return false
    }
  },
  nativeImage: { createFromPath: () => ({ isEmpty: () => true }) }
}))
vi.mock('../../resources/icon.png?asset', () => ({ default: 'icon.png' }))

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
  // The fake icon is empty: the tray warns about it.
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

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
