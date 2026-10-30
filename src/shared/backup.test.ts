import { describe, expect, it } from 'vitest'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  backupText,
  factorySettings,
  importedSettings,
  parseBackup
} from './backup'
import { saveLayoutAs } from './layouts'
import { createDefaultSettings, normalizeSettings } from './settings'

const BESTS = JSON.stringify({ version: 1, bests: { 'a|b|c': { lapTime: 90 } } })

describe('backup of everything (R40)', () => {
  it('round-trips every setting and the bests file', () => {
    const s = createDefaultSettings()
    s.appearance.accent = '#33ccff'
    s.shortcuts.nextLayout = 'F14'
    s.relative.carsAhead = 5
    saveLayoutAs(s, 'GT3')
    const saved = normalizeSettings(JSON.parse(JSON.stringify(s)))
    const text = backupText(saved, BESTS, '2.2.0', new Date('2026-10-30T10:00:00Z'))
    const file = JSON.parse(text) as Record<string, unknown>
    expect(file.format).toBe(BACKUP_FORMAT)
    expect(file.version).toBe(BACKUP_VERSION)
    expect(file.app).toBe('2.2.0')
    const back = parseBackup(text)
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.settings).toEqual(saved)
    expect(back.settings.savedLayouts.list.map((l) => l.name)).toContain('GT3')
    expect(JSON.parse(back.bests ?? 'null')).toEqual(JSON.parse(BESTS))
    expect(back.createdAt).toBe('2026-10-30T10:00:00.000Z')
  })

  it('writes no bests when there are none, or their file is not JSON', () => {
    const s = createDefaultSettings()
    for (const bests of [null, '{not json']) {
      const back = parseBackup(backupText(s, bests, '2.2.0', new Date(0)))
      expect(back.ok && back.bests).toBeNull()
    }
  })

  it('normalises what it reads: an old or odd file loads as settings files do', () => {
    const back = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        settings: { appearance: { accent: 'not a colour', units: 'imperial' }, junk: 1 }
      })
    )
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.settings.appearance.units).toBe('imperial')
    expect(back.settings.appearance.accent).toBe(createDefaultSettings().appearance.accent)
    expect('junk' in back.settings).toBe(false)
  })

  it('refuses what is not a backup, or one of a newer version', () => {
    expect(parseBackup('{')).toEqual({ ok: false, error: 'json' })
    expect(parseBackup('[]')).toEqual({ ok: false, error: 'format' })
    // A layout file is not a backup.
    expect(parseBackup(JSON.stringify({ format: 'overlap-layout', version: 1 }))).toEqual({
      ok: false,
      error: 'format'
    })
    expect(
      parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, settings: {} }))
    ).toEqual({ ok: false, error: 'version' })
    expect(parseBackup(' '.repeat(16 * 1024 * 1024 + 1))).toEqual({ ok: false, error: 'too-big' })
  })

  it('names the file by its date', () => {
    expect(backupFileName(new Date(2026, 9, 3))).toBe('OverLap-2026-10-03.json')
  })
})

describe('«Restablecer todo» and what an import puts in (R40)', () => {
  it('gives a new install in the language in use, its one layout named in it', () => {
    const s = createDefaultSettings()
    s.appearance.language = 'en'
    s.appearance.accent = '#33ccff'
    saveLayoutAs(s, 'GT3')
    const r = factorySettings(s)
    expect(r.appearance.language).toBe('en')
    expect(r.appearance.accent).toBe(createDefaultSettings().appearance.accent)
    expect(r.savedLayouts.list).toHaveLength(1)
    expect(r.settingsWindow.welcome).toBe(false)
    const fresh = normalizeSettings({ version: 6, appearance: { language: 'en' } })
    expect(r).toEqual(fresh)
  })

  it('never brings the first-run welcome back with an import', () => {
    const s = createDefaultSettings()
    s.settingsWindow.welcome = true
    const read = parseBackup(backupText(s, null, 'x', new Date(0)))
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(importedSettings(read).settingsWindow.welcome).toBe(false)
  })
})
