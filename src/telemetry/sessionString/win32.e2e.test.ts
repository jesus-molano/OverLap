/**
 * The reader on a real Windows file mapping: a test-only one this file creates and writes the
 * way iRacing writes its shared memory, read back through koffi with FILE_MAP_READ. The sim's
 * own mapping is never opened here.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { driverIdentity } from '@shared/driver'
import { formatDriverName, shownDriverName } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import { parseSessionMeta } from '@shared/session'
import { parseSessionYaml } from '@shared/sessionYaml'
import { IRSDK_VER, SessionStringReader } from './reader'
import { encodeCp1252 } from './testing/cp1252'
import { sdkMemory, writeHeader } from './testing/sdkMemory'
import { createTestMapping, testMappingName, type TestMapping } from './testing/testMapping'
import { loadMappingOpener } from './win32'

const YAML = `---
WeekendInfo:
 TrackName: spa 2024 up
 TrackDisplayName: Circuit de Spa-Francorchamps
 TeamRacing: 0

DriverInfo:
 DriverCarIdx: 1
 Drivers:
 - CarIdx: 1
   UserName: Lucía Peñalver
   AbbrevName: Peñalver, L
   Initials: LP
   UserID: 900001
   TeamName: Lucía Peñalver
   CarNumber: "11"
 - CarIdx: 2
   UserName: Jérôme Duchêne
   AbbrevName: Duchêne, J
   Initials: JD
   UserID: 900002
   TeamName: Équipe “Rapide” €
   CarNumber: "22"
 - CarIdx: 3
   UserName: Zoë Ångström
   AbbrevName: Ångström, Z
   Initials: ZÅ
   UserID: 900003
   TeamName: Zoë Ångström
   CarNumber: "33"
 - CarIdx: 7
   UserName: ?????? ?????
   AbbrevName: ?????, ?
   Initials: ??
   UserID: 900007
   TeamName: ?????? ?????
   CarNumber: "7"

...
`

const ES = messagesFor('es')
const EN = messagesFor('en')

describe.skipIf(process.platform !== 'win32')('SessionStringReader on a file mapping', () => {
  let mapping: TestMapping | null = null
  const logs: string[] = []

  afterEach(() => {
    mapping?.close()
    mapping = null
    logs.length = 0
  })

  async function setup(memory: Uint8Array): Promise<SessionStringReader> {
    const name = testMappingName()
    mapping = await createTestMapping(name, memory.length)
    mapping.write(0, memory)
    return new SessionStringReader(name, await loadMappingOpener(), (m) => logs.push(m))
  }

  it('reads back the exact text and the names come out whole', async () => {
    const reader = await setup(sdkMemory(encodeCp1252(YAML), { offset: 4096, update: 3 }))
    const text = reader.read()
    expect(text).toBe(YAML)
    expect(logs).toEqual([])

    const meta = parseSessionMeta(parseSessionYaml(text ?? ''))
    const name = (carIdx: number): string => meta.drivers.get(carIdx)?.userName ?? ''
    expect([name(1), name(2), name(3)]).toEqual([
      'Lucía Peñalver',
      'Jérôme Duchêne',
      'Zoë Ångström'
    ])
    expect(meta.drivers.get(2)?.teamName).toBe('Équipe “Rapide” €')

    // iRacing's '?' name: no name in the rows, the widgets' placeholder on screen.
    const unknown = meta.drivers.get(7)
    expect(unknown?.userName).toBe('?????? ?????')
    const identity = unknown ? driverIdentity(unknown) : null
    expect(identity).toMatchObject({ driverName: '', carNumber: '7' })
    expect(identity?.teamName).toBeUndefined()
    const shown = (m: typeof ES): string =>
      shownDriverName(
        formatDriverName(identity?.driverName ?? '', 'abbr'),
        identity?.teamName,
        identity?.carNumber ?? '',
        m
      ).text
    expect(shown(ES)).toBe('Piloto #7')
    expect(shown(EN)).toBe('Driver #7')
    reader.close()
  })

  it('follows new versions through the same view', async () => {
    const reader = await setup(sdkMemory(encodeCp1252(YAML), { size: 64 * 1024, update: 1 }))
    expect(reader.read()).toBe(YAML)
    const next = 'WeekendInfo:\n TrackDisplayName: Autódromo Hermanos Rodríguez\n'
    mapping?.write(0, sdkMemory(encodeCp1252(next), { size: 64 * 1024, update: 2 }))
    expect(reader.read()).toBe(next)
    reader.close()
  })

  it('reopens after close and reads nothing once the mapping is gone', async () => {
    const reader = await setup(sdkMemory(encodeCp1252(YAML)))
    for (let i = 0; i < 25; i++) {
      expect(reader.read()).toBe(YAML)
      reader.close()
    }
    mapping?.close()
    mapping = null
    expect(reader.read()).toBeNull()
    expect(logs).toHaveLength(1)
  })

  it('refuses a corrupt header without reading past the view', async () => {
    const memory = sdkMemory(encodeCp1252(YAML), { size: 8192, length: 1 << 30 })
    const reader = await setup(memory)
    expect(reader.read()).toBeNull()
    expect(logs).toHaveLength(1)
    reader.close()
  })

  it("bounds the string by the mapping's own size, to the last byte", async () => {
    // Two pages, the string filling the second one with no NUL to stop at.
    const text = `A: ${'é'.repeat(4093)}`
    const reader = await setup(
      sdkMemory(encodeCp1252(text), { size: 8192, offset: 4096, length: 4096 })
    )
    expect(reader.read()).toBe(text)
    // One byte more would be past the view: refused, not read.
    const header = new Uint8Array(24)
    writeHeader(header, { ver: IRSDK_VER, update: 2, length: 4097, offset: 4096 })
    mapping?.write(0, header)
    expect(reader.read()).toBeNull()
    expect(logs).toHaveLength(1)
    reader.close()
  })

  it('keeps reading after the writer lets go, and close() releases the last handle', async () => {
    const reader = await setup(sdkMemory(encodeCp1252(YAML)))
    expect(reader.read()).toBe(YAML)
    // The writer closes its handle (the sim exiting): ours keeps the mapping alive.
    mapping?.close()
    mapping = null
    expect(reader.read()).toBe(YAML)
    // Nothing of ours left open: the name is gone with the mapping.
    reader.close()
    expect(reader.read()).toBeNull()
  })
})
