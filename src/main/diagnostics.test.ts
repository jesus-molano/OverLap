import { describe, expect, it } from 'vitest'
import { NO_WIDGET_STATUS } from '@shared/testing/shortcuts'
import { createDefaultSettings } from '@shared/settings'
import { anonymous, diagnosticsText, type DiagnosticsInput } from './diagnostics'

function input(over: Partial<DiagnosticsInput> = {}): DiagnosticsInput {
  return {
    version: '2.2.0',
    versions: { electron: '44.0.0', chrome: '150.0', node: '24.1.0' },
    os: 'Windows_NT 10.0.26200 x64',
    status: { state: 'error', source: 'iracing', note: 'native-missing', detail: 'bad module' },
    editMode: false,
    overlayHidden: true,
    settings: createDefaultSettings(),
    autoHidden: { battle: 'practice', fuel: null },
    shortcuts: {
      actions: {
        toggleOverlay: 'ok',
        toggleEditMode: 'unavailable',
        cycleDeltaReference: 'disabled',
        nextLayout: 'disabled',
        openSettings: 'ok',
        ...NO_WIDGET_STATUS
      },
      unavailable: ['CommandOrControl+Shift+E']
    },
    displays: [
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, primary: true }
    ],
    saveFailing: false,
    settingsFile: 'C:\\Users\\Ana\\AppData\\Roaming\\iracing-overlay\\settings.json',
    logFile: 'C:\\Users\\Ana\\AppData\\Roaming\\iracing-overlay\\overlap.log',
    home: 'C:\\Users\\Ana',
    ...over
  }
}

describe('diagnosticsText (R35)', () => {
  it('says the versions, the status, the hiding and what does not work', () => {
    const text = diagnosticsText(input())
    expect(text).toContain('OverLap 2.2.0 (Electron 44.0.0, Chrome 150.0, Node 24.1.0)')
    expect(text).toContain('Status: error source=iracing note=native-missing detail=bad module')
    expect(text).toContain('Overlay hidden by the user: yes; edit mode: off')
    expect(text).toContain('Shortcuts not working: toggleEditMode (1 bindings)')
    expect(text).toMatch(/ {2}battle: on at .* hidden-now=practice/)
    expect(text).toMatch(/ {2}fuel: on at .* hidden-now=unknown/)
    expect(text).toContain('  1: 1920x1080 at 0,0 scale 1 primary')
  })

  it('leaves the user name out of the paths', () => {
    const text = diagnosticsText(input())
    expect(text).not.toContain('Ana')
    expect(text).toContain(
      'Settings: %USERPROFILE%\\AppData\\Roaming\\iracing-overlay\\settings.json'
    )
    // A path elsewhere is kept as it is.
    expect(diagnosticsText(input({ logFile: 'D:\\logs\\overlap.log' }))).toContain(
      'Log: D:\\logs\\overlap.log'
    )
  })

  it('leaves the user name out of the error detail too (R35)', () => {
    const detail =
      "Cannot find module 'c:/users/ana/AppData/Local/Programs/OverLap/irsdk.node'; " +
      "ENOENT: open 'C:\\\\Users\\\\Ana\\\\Documents\\\\iRacing\\\\x.ibt'"
    const text = diagnosticsText(
      input({ status: { state: 'error', source: 'iracing', note: 'native-missing', detail } })
    )
    expect(text).not.toMatch(/ana/i)
    expect(text).toContain("'%USERPROFILE%/AppData/Local/Programs/OverLap/irsdk.node'")
    expect(text).toContain("'%USERPROFILE%\\\\Documents\\\\iRacing\\\\x.ibt'")
  })

  it('replaces only the whole home folder', () => {
    expect(anonymous('C:\\Users\\Anabel\\x', 'C:\\Users\\Ana')).toBe('C:\\Users\\Anabel\\x')
    expect(anonymous('at C:\\Users\\Ana', 'C:\\Users\\Ana')).toBe('at %USERPROFILE%')
    expect(anonymous('C:\\Users\\Ana\\x', '')).toBe('C:\\Users\\Ana\\x')
  })

  it('names no layout, car or driver', () => {
    const settings = createDefaultSettings()
    settings.savedLayouts.list[0]!.name = 'Mi Porsche secreto'
    const text = diagnosticsText(input({ settings }))
    expect(text).not.toContain('Porsche')
    expect(text).toContain('layouts: 1')
  })
})
