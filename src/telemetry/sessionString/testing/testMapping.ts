/**
 * A file mapping of the tests' own, written the way iRacing writes its shared memory, for the
 * reader's integration test. Only names under TEST_MAPPING_PREFIX: never the SDK's mapping,
 * and never one that already exists.
 */
import { randomUUID } from 'node:crypto'

export const TEST_MAPPING_PREFIX = 'Local\\OverLapTest-'

const PAGE_READWRITE = 0x04
const FILE_MAP_WRITE = 0x0002
const FILE_MAP_READ = 0x0004
/** CreateFileMappingW's hFile for a mapping backed by the paging file. */
const INVALID_HANDLE_VALUE = -1

export interface TestMapping {
  readonly name: string
  write(offset: number, bytes: Uint8Array): void
  close(): void
}

/** A fresh test-only name: 'Local\OverLapTest-<pid>-<uuid>'. */
export function testMappingName(): string {
  return `${TEST_MAPPING_PREFIX}${process.pid}-${randomUUID()}`
}

export async function createTestMapping(name: string, size: number): Promise<TestMapping> {
  if (!name.startsWith(TEST_MAPPING_PREFIX)) {
    throw new Error(`Test mappings must be named ${TEST_MAPPING_PREFIX}*, not ${name}`)
  }
  const { default: koffi } = await import('koffi')
  const kernel32 = koffi.load('kernel32.dll')
  const openFileMapping: (access: number, inherit: boolean, name: string) => unknown =
    kernel32.func('OpenFileMappingW', 'void *', ['uint32_t', 'bool', 'str16'])
  const createFileMapping: (
    file: number,
    attributes: null,
    protect: number,
    sizeHigh: number,
    sizeLow: number,
    name: string
  ) => unknown = kernel32.func('CreateFileMappingW', 'void *', [
    'intptr_t',
    'void *',
    'uint32_t',
    'uint32_t',
    'uint32_t',
    'str16'
  ])
  const mapViewOfFile: (h: bigint, access: number, hi: number, lo: number, n: number) => unknown =
    kernel32.func('MapViewOfFile', 'void *', [
      'void *',
      'uint32_t',
      'uint32_t',
      'uint32_t',
      'size_t'
    ])
  const moveMemory: (target: bigint, source: Uint8Array, length: number) => void = kernel32.func(
    'RtlMoveMemory',
    'void',
    ['void *', 'void *', 'size_t']
  )
  const release = (fn: string): ((h: bigint) => unknown) => kernel32.func(fn, 'bool', ['void *'])
  const unmapViewOfFile = release('UnmapViewOfFile')
  const closeHandle = release('CloseHandle')

  const existing = openFileMapping(FILE_MAP_READ, false, name)
  if (typeof existing === 'bigint') {
    closeHandle(existing)
    throw new Error(`${name} already exists`)
  }
  const handle = createFileMapping(INVALID_HANDLE_VALUE, null, PAGE_READWRITE, 0, size, name)
  if (typeof handle !== 'bigint') throw new Error(`Could not create ${name}`)
  const base = mapViewOfFile(handle, FILE_MAP_WRITE, 0, 0, 0)
  if (typeof base !== 'bigint') {
    closeHandle(handle)
    throw new Error(`Could not map ${name}`)
  }
  let open = true
  return {
    name,
    write(offset, bytes) {
      if (!open || offset < 0 || offset + bytes.length > size) {
        throw new RangeError(`Write of ${bytes.length} bytes at ${offset} outside ${size}`)
      }
      moveMemory(base + BigInt(offset), bytes, bytes.length)
    },
    close() {
      if (!open) return
      open = false
      unmapViewOfFile(base)
      closeHandle(handle)
    }
  }
}
