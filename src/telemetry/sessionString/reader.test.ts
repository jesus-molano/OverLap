import { describe, expect, it } from 'vitest'
import { HEADER_SIZE, MAX_ATTEMPTS, SessionStringReader, type MappedView } from './reader'
import { encodeCp1252 } from './testing/cp1252'
import { sdkMemory, writeHeader } from './testing/sdkMemory'

const NAME = 'Local\\OverLapTest-reader'
const YAML = '---\nDriverInfo:\n Drivers:\n - CarIdx: 3\n   UserName: Jérôme Duchêne\n...\n'

/** In-memory MappedView: throws on any read outside it, like the real one must never do. */
class FakeView implements MappedView {
  closes = 0
  /** [offset, length] of every copy. */
  readonly reads: [number, number][] = []
  /** Runs after each copy (iRacing writing meanwhile). */
  afterRead: ((offset: number, length: number) => void) | null = null
  failReads = false

  constructor(public memory: Uint8Array) {}

  get size(): number {
    return this.memory.length
  }

  read(offset: number, target: Uint8Array): void {
    if (this.failReads) throw new Error('access violation')
    if (offset < 0 || offset + target.length > this.memory.length) {
      throw new RangeError(`read outside the view: ${offset}+${target.length}`)
    }
    target.set(this.memory.subarray(offset, offset + target.length))
    this.reads.push([offset, target.length])
    this.afterRead?.(offset, target.length)
  }

  close(): void {
    this.closes++
  }
}

interface Setup {
  reader: SessionStringReader
  /** The name of every open. */
  opened: string[]
  logs: string[]
}

/** A reader over `views` (one per open, null = not found), with its opens and log lines. */
function setup(views: (FakeView | null | Error)[]): Setup {
  const opened: string[] = []
  const logs: string[] = []
  const queue = [...views]
  const reader = new SessionStringReader(
    NAME,
    (name) => {
      opened.push(name)
      const next = queue.shift() ?? null
      if (next instanceof Error) throw next
      return next
    },
    (message) => logs.push(message)
  )
  return { reader, opened, logs }
}

function view(text = YAML, o: Parameters<typeof sdkMemory>[1] = {}): FakeView {
  return new FakeView(sdkMemory(encodeCp1252(text), o))
}

describe('SessionStringReader', () => {
  it('returns the session string at the header offset, decoded as Windows-1252', () => {
    const v = view()
    const { reader, opened, logs } = setup([v])
    expect(reader.read()).toBe(YAML)
    expect(opened).toEqual([NAME])
    expect(logs).toEqual([])
    // Header, the string (sessionInfoLen bytes, NUL padding included), the counter again.
    expect(v.reads).toEqual([
      [0, 24],
      [1024, encodeCp1252(YAML).length + 256],
      [12, 4]
    ])
  })

  it('cuts the string at its NUL and reads the current version on every call', () => {
    const v = view('A: 1\n')
    const { reader } = setup([v])
    expect(reader.read()).toBe('A: 1\n')
    v.memory = sdkMemory(encodeCp1252('B: Zoë\n'), { update: 2 })
    expect(reader.read()).toBe('B: Zoë\n')
  })

  it("is '' while iRacing has written no session info", () => {
    const { reader } = setup([view('', { length: 0 })])
    expect(reader.read()).toBe('')
  })

  it('opens the mapping once per connection and again after close', () => {
    const first = view()
    const second = view()
    const { reader, opened } = setup([first, second])
    expect(reader.read()).toBe(YAML)
    expect(reader.read()).toBe(YAML)
    expect(opened).toHaveLength(1)
    reader.close()
    expect(first.closes).toBe(1)
    // Closing twice (disconnect, then process exit) releases nothing more.
    reader.close()
    expect(first.closes).toBe(1)
    expect(reader.read()).toBe(YAML)
    expect(opened).toHaveLength(2)
    reader.close()
    expect(second.closes).toBe(1)
  })

  it('opens nothing until the first read (a reconnect loop holds no handle)', () => {
    const { reader, opened } = setup([])
    for (let i = 0; i < 20; i++) reader.close()
    expect(opened).toEqual([])
  })

  it('gives up for the connection when the mapping is missing, logging once', () => {
    const later = view()
    const { reader, opened, logs } = setup([null, null, later])
    expect(reader.read()).toBeNull()
    expect(reader.read()).toBeNull()
    expect(opened).toHaveLength(1)
    reader.close()
    expect(reader.read()).toBeNull()
    expect(opened).toHaveLength(2)
    expect(logs).toHaveLength(1)
    reader.close()
    expect(reader.read()).toBe(YAML)
  })

  it('survives an open that throws', () => {
    const { reader, logs } = setup([new Error('koffi exploded')])
    expect(reader.read()).toBeNull()
    expect(logs.some((l) => l.includes('koffi exploded'))).toBe(true)
  })

  it('reads nothing without an opener (koffi did not load)', () => {
    const reader = new SessionStringReader(NAME, null, () => {
      throw new Error('nothing to log')
    })
    expect(reader.read()).toBeNull()
    reader.close()
  })

  describe('a header that does not describe a string inside the view', () => {
    const cases: [string, FakeView][] = [
      ['a view smaller than the header', new FakeView(new Uint8Array(HEADER_SIZE - 1))],
      ['another SDK version', view(YAML, { ver: 3 })],
      ['a negative length', view(YAML, { length: -1 })],
      ['a string inside the header', view(YAML, { offset: 8 })],
      ['a string past the end', view(YAML, { size: 2048, offset: 1024, length: 4096 })],
      ['a huge length', view(YAML, { size: 2048, length: 0x7fffffff })],
      ['a negative offset', view(YAML, { size: 2048, offset: -2_000_000_000 })]
    ]

    it.each(cases)('%s: null, never a read outside it, one log line', (_, v) => {
      const { reader, logs } = setup([v])
      expect(reader.read()).toBeNull()
      expect(reader.read()).toBeNull()
      expect(v.reads.every(([offset, length]) => offset + length <= HEADER_SIZE)).toBe(true)
      expect(logs).toHaveLength(1)
    })
  })

  it('copies again when the update counter moved during the copy', () => {
    const v = view('Old: 1\n', { update: 5 })
    let copies = 0
    v.afterRead = (offset) => {
      if (offset !== 1024 || copies++ > 0) return
      // iRacing writes version 6 while the first copy of the string is under way.
      v.memory = sdkMemory(encodeCp1252('New: 2\n'), { update: 6 })
    }
    const { reader } = setup([v])
    expect(reader.read()).toBe('New: 2\n')
    expect(v.reads.filter(([offset]) => offset === 1024)).toHaveLength(2)
  })

  it(`gives up after ${MAX_ATTEMPTS} copies torn by new versions`, () => {
    const v = view()
    const length = encodeCp1252(YAML).length + 256
    let update = 1
    v.afterRead = (offset) => {
      if (offset === 1024) writeHeader(v.memory, { ver: 2, update: ++update, length, offset })
    }
    const { reader, logs } = setup([v])
    expect(reader.read()).toBeNull()
    expect(v.reads.filter(([offset]) => offset === 1024)).toHaveLength(MAX_ATTEMPTS)
    expect(reader.read()).toBeNull()
    expect(logs).toHaveLength(1)
    // Once iRacing is done writing, the next version change reads fine.
    v.afterRead = null
    expect(reader.read()).toBe(YAML)
  })

  it('turns a failing copy into null and one log line', () => {
    const v = view()
    v.failReads = true
    const { reader, logs } = setup([v])
    expect(reader.read()).toBeNull()
    expect(reader.read()).toBeNull()
    expect(logs).toEqual(['Could not read the session info from shared memory: access violation'])
    v.failReads = false
    expect(reader.read()).toBe(YAML)
  })
})
