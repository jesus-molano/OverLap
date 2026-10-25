/**
 * Read-only access to a named file mapping through koffi (kernel32), the way the iRacing SDK
 * opens its shared memory: OpenFileMappingW and MapViewOfFile, both with FILE_MAP_READ and
 * nothing more. This module cannot create a mapping nor write to one. Windows x64 only.
 */
import type { MappedView, OpenMapping } from './reader'

const FILE_MAP_READ = 0x0004

type OpenFileMappingW = (access: number, inherit: boolean, name: string) => unknown
type MapViewOfFile = (
  handle: bigint,
  access: number,
  offsetHigh: number,
  offsetLow: number,
  bytes: number
) => unknown
type VirtualQuery = (address: bigint, info: { RegionSize?: unknown }, length: number) => unknown
type RtlMoveMemory = (target: Uint8Array, source: bigint, length: number) => void
type Release = (pointerOrHandle: bigint) => unknown

/** koffi returns pointers and handles as BigInt, NULL as null. */
function pointerOr(v: unknown): bigint | null {
  return typeof v === 'bigint' && v !== 0n ? v : null
}

function sizeOf(v: unknown): number {
  const n = typeof v === 'bigint' ? Number(v) : v
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : 0
}

/** Loads koffi and kernel32's functions; throws when koffi or its binary does not load. */
export async function loadMappingOpener(): Promise<OpenMapping> {
  const { default: koffi } = await import('koffi')
  const kernel32 = koffi.load('kernel32.dll')
  const openFileMapping: OpenFileMappingW = kernel32.func('OpenFileMappingW', 'void *', [
    'uint32_t',
    'bool',
    'str16'
  ])
  const mapViewOfFile: MapViewOfFile = kernel32.func('MapViewOfFile', 'void *', [
    'void *',
    'uint32_t',
    'uint32_t',
    'uint32_t',
    'size_t'
  ])
  // MEMORY_BASIC_INFORMATION (x64): only RegionSize is read.
  const memoryInfo = koffi.struct({
    BaseAddress: 'void *',
    AllocationBase: 'void *',
    AllocationProtect: 'uint32_t',
    PartitionId: 'uint16_t',
    RegionSize: 'size_t',
    State: 'uint32_t',
    Protect: 'uint32_t',
    Type: 'uint32_t'
  })
  const memoryInfoSize = koffi.sizeof(memoryInfo)
  const virtualQuery: VirtualQuery = kernel32.func('VirtualQuery', 'size_t', [
    'void *',
    koffi.out(koffi.pointer(memoryInfo)),
    'size_t'
  ])
  // Copies out of the view into a JS buffer: Electron forbids external buffers (koffi.view).
  const moveMemory: RtlMoveMemory = kernel32.func('RtlMoveMemory', 'void', [
    'void *',
    'void *',
    'size_t'
  ])
  const unmapViewOfFile: Release = kernel32.func('UnmapViewOfFile', 'bool', ['void *'])
  const closeHandle: Release = kernel32.func('CloseHandle', 'bool', ['void *'])

  return (name) => {
    const handle = pointerOr(openFileMapping(FILE_MAP_READ, false, name))
    if (handle === null) return null
    const base = pointerOr(mapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0))
    if (base === null) {
      closeHandle(handle)
      return null
    }
    // The view's committed size bounds every read: one past it would crash the process.
    const info: { RegionSize?: unknown } = {}
    const size = sizeOf(virtualQuery(base, info, memoryInfoSize)) > 0 ? sizeOf(info.RegionSize) : 0
    let open = true
    const close = (): void => {
      if (!open) return
      open = false
      unmapViewOfFile(base)
      closeHandle(handle)
    }
    if (size === 0) {
      close()
      return null
    }
    const view: MappedView = {
      size,
      read(offset, target) {
        if (!open) throw new Error('The shared memory view is closed')
        if (!Number.isSafeInteger(offset) || offset < 0 || offset + target.length > size) {
          throw new RangeError(`Read of ${target.length} bytes at ${offset} outside ${size}`)
        }
        if (target.length > 0) moveMemory(target, base + BigInt(offset), target.length)
      },
      close
    }
    return view
  }
}
