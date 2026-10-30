import { describe, expect, it, vi } from 'vitest'
import { createDefaultSettings } from '@shared/settings'
import { exportBackup, readBackup, type BackupDeps } from './backupFiles'

function deps(over: Partial<BackupDeps> = {}): BackupDeps & { written: Map<string, string> } {
  const written = new Map<string, string>()
  return {
    written,
    pickSavePath: async (name) => `C:/docs/${name}`,
    pickOpenPath: async () => 'C:/docs/OverLap-2026-10-30.json',
    writeText: (path, text) => void written.set(path, text),
    sizeOf: () => 10,
    readText: () => '',
    readBests: () => '{"version":1,"bests":{}}',
    baseName: (p) => p.split('/').at(-1) ?? p,
    ...over
  }
}

describe('backup files (R40)', () => {
  it('waits for the bests when they come from the telemetry process', async () => {
    const d = deps({ readBests: () => Promise.resolve('{"version":1,"bests":{"k":1}}') })
    const r = await exportBackup(createDefaultSettings(), '2.2.0', new Date(2026, 9, 30), d)
    expect(r).toEqual({ ok: true, file: 'OverLap-2026-10-30.json' })
    const text = d.written.get('C:/docs/OverLap-2026-10-30.json') ?? ''
    expect(text).toContain('"k"')
  })

  it('writes everything where the user chooses, named by the date', async () => {
    const d = deps()
    const r = await exportBackup(createDefaultSettings(), '2.2.0', new Date(2026, 9, 30), d)
    expect(r).toEqual({ ok: true, file: 'OverLap-2026-10-30.json' })
    const text = d.written.get('C:/docs/OverLap-2026-10-30.json') ?? ''
    expect(JSON.parse(text)).toMatchObject({
      format: 'overlap-backup',
      personalBests: { version: 1 }
    })
  })

  it('says nothing when cancelled, and a failure when it cannot write', async () => {
    expect(
      await exportBackup(
        createDefaultSettings(),
        'x',
        new Date(),
        deps({ pickSavePath: async () => null })
      )
    ).toBeNull()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failing = deps({
      writeText: () => {
        throw new Error('EACCES')
      }
    })
    expect(await exportBackup(createDefaultSettings(), 'x', new Date(), failing)).toEqual({
      ok: false
    })
  })

  it('reads one back, refusing a file too big or unreadable before parsing it', async () => {
    const s = createDefaultSettings()
    const d = deps()
    await exportBackup(s, '2.2.0', new Date(2026, 9, 30), d)
    const text = d.written.get('C:/docs/OverLap-2026-10-30.json') ?? ''
    const back = await readBackup(deps({ readText: () => text }))
    expect(back?.ok).toBe(true)
    expect(await readBackup(deps({ pickOpenPath: async () => null }))).toBeNull()
    expect(await readBackup(deps({ sizeOf: () => 17 * 1024 * 1024 }))).toEqual({
      ok: false,
      error: 'too-big'
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unreadable = deps({
      readText: () => {
        throw new Error('EBUSY')
      }
    })
    expect(await readBackup(unreadable)).toEqual({ ok: false, error: 'read' })
  })
})
