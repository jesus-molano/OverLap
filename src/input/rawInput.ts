/**
 * The controllers' buttons through Raw Input and hid.dll (koffi), read the way SimHub and SDL
 * read them: passively. A message-only window of this process registers for the joystick,
 * gamepad and multi-axis usages with RIDEV_INPUTSINK (reports arrive while another program,
 * iRacing, has the focus) and RIDEV_DEVNOTIFY (arrivals and removals). Windows hands this
 * process its own copy of each report: nothing is acquired or taken from iRacing, no hook,
 * no handle to another process, and no device is opened for reading or writing (only, with no
 * access rights, to read its product name). Windows only.
 *
 * Every call is plain data (no callback into JavaScript): the window is of the built-in STATIC
 * class, and its queue is drained by ControllerSource.poll every POLL_MS.
 */
import koffi, { type LibraryHandle } from 'koffi'
import {
  controllerId,
  cleanControllerName,
  fallbackControllerName,
  type ControllerInfo
} from '@shared/controllers'
import type { ControllerSource, SourceEvent } from './buttons'

const WM_INPUT_DEVICE_CHANGE = 0x00fe
const WM_INPUT = 0x00ff
const PM_REMOVE = 0x0001
const GIDC_ARRIVAL = 1
const GIDC_REMOVAL = 2
const RIDEV_REMOVE = 0x00000001
const RIDEV_INPUTSINK = 0x00000100
const RIDEV_DEVNOTIFY = 0x00002000
const RID_INPUT = 0x10000003
const RIM_TYPEHID = 2
const RIDI_PREPARSEDDATA = 0x20000005
const RIDI_DEVICENAME = 0x20000007
const RIDI_DEVICEINFO = 0x2000000b
const HWND_MESSAGE = -3
const HIDP_INPUT = 0
const BUTTON_PAGE = 0x09
const HIDP_STATUS_SUCCESS = 0x00110000
const OPEN_EXISTING = 3
const FILE_SHARE_READ_WRITE = 3
const HKEY_CURRENT_USER = -2147483647 // 0x80000001, sign-extended as Windows does
const HKEY_LOCAL_MACHINE = -2147483646 // 0x80000002
const RRF_RT_REG_SZ = 0x00000002
const FAILED = 0xffffffff

/** Generic desktop page: joystick, gamepad, multi-axis controller (wheels, boxes, pedals). */
const USAGES = [0x04, 0x05, 0x08] as const

/** x64 layouts. */
const RAWINPUTDEVICE_SIZE = 16
const RAWINPUTHEADER_SIZE = 24
const RAWINPUTDEVICELIST_SIZE = 16
const RID_DEVICE_INFO_SIZE = 32
const MSG_SIZE = 48
const HIDP_CAPS_SIZE = 64
const HIDP_BUTTON_CAPS_SIZE = 72

/** A pointer-sized integer as koffi takes it. */
type Ptr = bigint | number
type Out = Buffer | null

/** The Win32 functions used, typed as declared to koffi below. */
interface Api {
  CreateWindowExW(
    exStyle: number,
    className: string,
    windowName: string,
    style: number,
    x: number,
    y: number,
    w: number,
    h: number,
    parent: Ptr,
    menu: Ptr,
    instance: Ptr,
    param: null
  ): Ptr
  DestroyWindow(hwnd: Ptr): boolean
  RegisterRawInputDevices(list: Buffer, count: number, size: number): boolean
  PeekMessageW(msg: Buffer, hwnd: Ptr, min: number, max: number, remove: number): boolean
  DispatchMessageW(msg: Buffer): Ptr
  GetRawInputData(raw: Ptr, command: number, data: Out, size: Buffer, header: number): number
  GetRawInputDeviceList(list: Out, count: Buffer, size: number): number
  GetRawInputDeviceInfoW(device: Ptr, command: number, data: Out, size: Buffer): number
  HidP_GetCaps(preparsed: Buffer, caps: Buffer): number
  HidP_GetButtonCaps(type: number, caps: Buffer, length: Buffer, preparsed: Buffer): number
  HidP_MaxUsageListLength(type: number, page: number, preparsed: Buffer): number
  HidP_GetUsages(
    type: number,
    page: number,
    collection: number,
    usages: Buffer,
    length: Buffer,
    preparsed: Buffer,
    report: Buffer,
    reportLength: number
  ): number
  HidD_GetProductString(file: Ptr, buf: Buffer, size: number): boolean
  CreateFileW(
    path: string,
    access: number,
    share: number,
    security: null,
    disposition: number,
    flags: number,
    template: Ptr
  ): Ptr
  CloseHandle(file: Ptr): boolean
  RegGetValueW(
    key: Ptr,
    subKey: string,
    value: string,
    flags: number,
    type: null,
    data: Buffer,
    size: Buffer
  ): number
}

function loadApi(): Api {
  const user32 = koffi.load('user32.dll')
  const kernel32 = koffi.load('kernel32.dll')
  const hid = koffi.load('hid.dll')
  const advapi32 = koffi.load('advapi32.dll')
  const f = <K extends keyof Api>(
    lib: LibraryHandle,
    name: K,
    ret: string,
    args: string[]
  ): Api[K] => lib.func(name, ret, args) as unknown as Api[K]
  return {
    CreateWindowExW: f(user32, 'CreateWindowExW', 'uintptr_t', [
      'uint32_t',
      'str16',
      'str16',
      'uint32_t',
      'int32_t',
      'int32_t',
      'int32_t',
      'int32_t',
      'intptr_t',
      'uintptr_t',
      'uintptr_t',
      'void *'
    ]),
    DestroyWindow: f(user32, 'DestroyWindow', 'bool', ['uintptr_t']),
    RegisterRawInputDevices: f(user32, 'RegisterRawInputDevices', 'bool', [
      'void *',
      'uint32_t',
      'uint32_t'
    ]),
    PeekMessageW: f(user32, 'PeekMessageW', 'bool', [
      'void *',
      'uintptr_t',
      'uint32_t',
      'uint32_t',
      'uint32_t'
    ]),
    DispatchMessageW: f(user32, 'DispatchMessageW', 'intptr_t', ['void *']),
    GetRawInputData: f(user32, 'GetRawInputData', 'uint32_t', [
      'uintptr_t',
      'uint32_t',
      'void *',
      'void *',
      'uint32_t'
    ]),
    GetRawInputDeviceList: f(user32, 'GetRawInputDeviceList', 'uint32_t', [
      'void *',
      'void *',
      'uint32_t'
    ]),
    GetRawInputDeviceInfoW: f(user32, 'GetRawInputDeviceInfoW', 'uint32_t', [
      'uintptr_t',
      'uint32_t',
      'void *',
      'void *'
    ]),
    HidP_GetCaps: f(hid, 'HidP_GetCaps', 'int32_t', ['void *', 'void *']),
    HidP_GetButtonCaps: f(hid, 'HidP_GetButtonCaps', 'int32_t', [
      'int32_t',
      'void *',
      'void *',
      'void *'
    ]),
    HidP_MaxUsageListLength: f(hid, 'HidP_MaxUsageListLength', 'uint32_t', [
      'int32_t',
      'uint16_t',
      'void *'
    ]),
    HidP_GetUsages: f(hid, 'HidP_GetUsages', 'int32_t', [
      'int32_t',
      'uint16_t',
      'uint16_t',
      'void *',
      'void *',
      'void *',
      'void *',
      'uint32_t'
    ]),
    HidD_GetProductString: f(hid, 'HidD_GetProductString', 'bool', [
      'uintptr_t',
      'void *',
      'uint32_t'
    ]),
    CreateFileW: f(kernel32, 'CreateFileW', 'intptr_t', [
      'str16',
      'uint32_t',
      'uint32_t',
      'void *',
      'uint32_t',
      'uint32_t',
      'uintptr_t'
    ]),
    CloseHandle: f(kernel32, 'CloseHandle', 'bool', ['intptr_t']),
    RegGetValueW: f(advapi32, 'RegGetValueW', 'int32_t', [
      'intptr_t',
      'str16',
      'str16',
      'uint32_t',
      'void *',
      'void *',
      'void *'
    ])
  }
}

function u32(value = 0): Buffer {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(value >>> 0, 0)
  return b
}

/** A NUL-terminated UTF-16 string from `buf`, at most `chars` characters. */
function wide(buf: Buffer, chars = buf.length >> 1): string {
  let end = 0
  while (end < chars && end * 2 + 1 < buf.length && buf.readUInt16LE(end * 2) !== 0) end++
  return buf.toString('utf16le', 0, end * 2)
}

/** A handle as a bigint (koffi gives numbers or bigints for pointer-sized integers). */
function big(value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(value)
  return 0n
}

interface Device {
  info: ControllerInfo
  preparsed: Buffer
  usages: Buffer
  maxUsages: number
  /** reportId -> the last copy of that report (identical ones are not decoded again). */
  last: Map<number, Buffer>
}

/**
 * Opens the reader: a message-only window registered for raw input. Throws when Windows
 * refuses (the caller reports controllers as unavailable).
 */
export function openRawInput(): ControllerSource {
  const api = loadApi()
  const hwnd = big(
    api.CreateWindowExW(0, 'STATIC', 'OverLap input', 0, 0, 0, 0, 0, HWND_MESSAGE, 0, 0, null)
  )
  if (hwnd === 0n) throw new Error('CreateWindowExW failed')

  const register = (flags: number, target: bigint): boolean => {
    const list = Buffer.alloc(RAWINPUTDEVICE_SIZE * USAGES.length)
    USAGES.forEach((usage, i) => {
      const o = i * RAWINPUTDEVICE_SIZE
      list.writeUInt16LE(0x01, o)
      list.writeUInt16LE(usage, o + 2)
      list.writeUInt32LE(flags, o + 4)
      list.writeBigUInt64LE(target, o + 8)
    })
    return api.RegisterRawInputDevices(list, USAGES.length, RAWINPUTDEVICE_SIZE) === true
  }
  if (!register(RIDEV_INPUTSINK | RIDEV_DEVNOTIFY, hwnd)) {
    api.DestroyWindow(hwnd)
    throw new Error('RegisterRawInputDevices failed')
  }

  const devices = new Map<bigint, Device | null>()
  const msg = Buffer.alloc(MSG_SIZE)
  let data = Buffer.alloc(1024)
  const size = u32()
  let closed = false

  const describe = (h: bigint): Device | null => {
    if (devices.has(h)) return devices.get(h) ?? null
    let device: Device | null
    try {
      device = readDevice(api, h)
    } catch {
      device = null
    }
    // Not a game controller (or gone already): remembered, so its reports cost nothing.
    devices.set(h, device)
    return device
  }

  const arrive = (h: bigint, emit: (e: SourceEvent) => void): void => {
    const d = describe(h)
    if (d) emit({ kind: 'arrival', handle: h.toString(), device: d.info })
  }

  // Already connected: Windows also sends an arrival for each, which is then a no-op.
  for (const h of listDevices(api)) arrive(h, () => {})
  let pendingArrivals = [...devices.entries()].filter(([, d]) => d !== null).map(([h]) => h)

  const onInput = (hRaw: bigint, emit: (e: SourceEvent) => void): void => {
    // One call in the usual case: the reused buffer fits (a report is a few dozen bytes).
    size.writeUInt32LE(data.length, 0)
    let got = api.GetRawInputData(hRaw, RID_INPUT, data, size, RAWINPUTHEADER_SIZE)
    if (got === FAILED) {
      size.writeUInt32LE(0, 0)
      if (api.GetRawInputData(hRaw, RID_INPUT, null, size, RAWINPUTHEADER_SIZE) === FAILED) return
      const needed = size.readUInt32LE(0)
      if (needed <= data.length) return
      data = Buffer.alloc(Math.max(needed, data.length * 2))
      size.writeUInt32LE(data.length, 0)
      got = api.GetRawInputData(hRaw, RID_INPUT, data, size, RAWINPUTHEADER_SIZE)
    }
    if (got === FAILED || got < RAWINPUTHEADER_SIZE + 8) return
    if (data.readUInt32LE(0) !== RIM_TYPEHID) return
    const h = data.readBigUInt64LE(8)
    const d = describe(h)
    if (!d) return
    const sizeHid = data.readUInt32LE(RAWINPUTHEADER_SIZE)
    const count = data.readUInt32LE(RAWINPUTHEADER_SIZE + 4)
    const base = RAWINPUTHEADER_SIZE + 8
    for (let r = 0; r < count; r++) {
      const start = base + r * sizeHid
      if (sizeHid === 0 || start + sizeHid > got) break
      const report = data.subarray(start, start + sizeHid)
      const reportId = report[0] ?? 0
      const prev = d.last.get(reportId)
      if (prev && prev.equals(report)) continue
      d.last.set(reportId, Buffer.from(report))
      const pressed = decode(api, d, report)
      if (pressed) emit({ kind: 'report', handle: h.toString(), reportId, pressed })
    }
  }

  return {
    poll(emit) {
      if (closed) return
      for (const h of pendingArrivals) arrive(h, emit)
      pendingArrivals = []
      // Only this window's messages; DispatchMessageW lets STATIC's procedure (DefWindowProc)
      // clean up after each WM_INPUT.
      while (api.PeekMessageW(msg, hwnd, 0, 0, PM_REMOVE) === true) {
        const type = msg.readUInt32LE(8)
        const wParam = msg.readBigUInt64LE(16)
        const lParam = msg.readBigUInt64LE(24)
        if (type === WM_INPUT) {
          onInput(lParam, emit)
        } else if (type === WM_INPUT_DEVICE_CHANGE) {
          if (wParam === BigInt(GIDC_ARRIVAL)) {
            if (devices.get(lParam) === null) devices.delete(lParam)
            arrive(lParam, emit)
          } else if (wParam === BigInt(GIDC_REMOVAL)) {
            if (devices.get(lParam)) emit({ kind: 'removal', handle: lParam.toString() })
            devices.delete(lParam)
          }
        }
        api.DispatchMessageW(msg)
      }
    },
    close() {
      if (closed) return
      closed = true
      try {
        register(RIDEV_REMOVE, 0n)
      } finally {
        api.DestroyWindow(hwnd)
        devices.clear()
      }
    }
  }
}

function listDevices(api: Api): bigint[] {
  const count = u32()
  if (api.GetRawInputDeviceList(null, count, RAWINPUTDEVICELIST_SIZE) === FAILED) return []
  const n = count.readUInt32LE(0)
  if (n === 0) return []
  const list = Buffer.alloc(RAWINPUTDEVICELIST_SIZE * n)
  const got = api.GetRawInputDeviceList(list, count, RAWINPUTDEVICELIST_SIZE) as number
  if (got === FAILED) return []
  const out: bigint[] = []
  for (let i = 0; i < got; i++) {
    if (list.readUInt32LE(i * RAWINPUTDEVICELIST_SIZE + 8) === RIM_TYPEHID) {
      out.push(list.readBigUInt64LE(i * RAWINPUTDEVICELIST_SIZE))
    }
  }
  return out
}

/** A game controller's id, name, buttons and parsing data; null for any other device. */
function readDevice(api: Api, h: bigint): Device | null {
  const info = Buffer.alloc(RID_DEVICE_INFO_SIZE)
  info.writeUInt32LE(RID_DEVICE_INFO_SIZE, 0)
  const infoSize = u32(RID_DEVICE_INFO_SIZE)
  if (api.GetRawInputDeviceInfoW(h, RIDI_DEVICEINFO, info, infoSize) === FAILED) return null
  if (info.readUInt32LE(4) !== RIM_TYPEHID) return null
  const vid = info.readUInt32LE(8)
  const pid = info.readUInt32LE(12)
  const usagePage = info.readUInt16LE(20)
  const usage = info.readUInt16LE(22)
  if (usagePage !== 0x01 || !(USAGES as readonly number[]).includes(usage)) return null

  const nameChars = u32()
  api.GetRawInputDeviceInfoW(h, RIDI_DEVICENAME, null, nameChars)
  const pathBuf = Buffer.alloc((nameChars.readUInt32LE(0) + 1) * 2)
  if (api.GetRawInputDeviceInfoW(h, RIDI_DEVICENAME, pathBuf, nameChars) === FAILED) return null
  const path = wide(pathBuf)

  const preparsedSize = u32()
  api.GetRawInputDeviceInfoW(h, RIDI_PREPARSEDDATA, null, preparsedSize)
  if (preparsedSize.readUInt32LE(0) === 0) return null
  const preparsed = Buffer.alloc(preparsedSize.readUInt32LE(0))
  if (api.GetRawInputDeviceInfoW(h, RIDI_PREPARSEDDATA, preparsed, preparsedSize) === FAILED) {
    return null
  }

  const id = controllerId(vid, pid, path)
  const maxUsages = Math.max(
    0,
    api.HidP_MaxUsageListLength(HIDP_INPUT, BUTTON_PAGE, preparsed) as number
  )
  return {
    info: {
      id,
      name: productName(api, path) ?? oemName(api, vid, pid) ?? fallbackControllerName(id),
      buttons: buttonCount(api, preparsed)
    },
    preparsed,
    usages: Buffer.alloc(Math.max(1, maxUsages) * 2),
    maxUsages,
    last: new Map()
  }
}

/** How many buttons (Button page usages) the controller declares for input. */
function buttonCount(api: Api, preparsed: Buffer): number {
  const caps = Buffer.alloc(HIDP_CAPS_SIZE)
  if (api.HidP_GetCaps(preparsed, caps) >>> 0 !== HIDP_STATUS_SUCCESS) return 0
  const n = caps.readUInt16LE(46)
  if (n === 0) return 0
  const length = Buffer.alloc(2)
  length.writeUInt16LE(n, 0)
  const list = Buffer.alloc(HIDP_BUTTON_CAPS_SIZE * n)
  if (api.HidP_GetButtonCaps(HIDP_INPUT, list, length, preparsed) >>> 0 !== HIDP_STATUS_SUCCESS) {
    return 0
  }
  const usages = new Set<number>()
  for (let i = 0; i < length.readUInt16LE(0); i++) {
    const o = i * HIDP_BUTTON_CAPS_SIZE
    if (list.readUInt16LE(o) !== BUTTON_PAGE) continue
    const min = list.readUInt16LE(o + 56)
    const max = list.readUInt8(o + 12) !== 0 ? list.readUInt16LE(o + 58) : min
    for (let u = min; u <= max && usages.size < 4096; u++) usages.add(u)
  }
  return usages.size
}

/** The buttons down in one report; null when the report has none of the Button page. */
function decode(api: Api, d: Device, report: Buffer): number[] | null {
  if (d.maxUsages === 0) return null
  const length = u32(d.maxUsages)
  const status = api.HidP_GetUsages(
    HIDP_INPUT,
    BUTTON_PAGE,
    0,
    d.usages,
    length,
    d.preparsed,
    report,
    report.length
  ) as number
  // INCOMPATIBLE_REPORT_ID and friends: this report carries no buttons, it changes nothing.
  if (status >>> 0 !== HIDP_STATUS_SUCCESS) return null
  const n = Math.min(length.readUInt32LE(0), d.maxUsages)
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(d.usages.readUInt16LE(i * 2))
  return out
}

/** The product string, opening the device with no access rights (no reading or writing). */
function productName(api: Api, path: string): string | null {
  const handle = big(api.CreateFileW(path, 0, FILE_SHARE_READ_WRITE, null, OPEN_EXISTING, 0, 0))
  if (handle === -1n || handle === 0n) return null
  try {
    const buf = Buffer.alloc(256)
    return api.HidD_GetProductString(handle, buf, buf.length) === true
      ? cleanControllerName(wide(buf))
      : null
  } finally {
    api.CloseHandle(handle)
  }
}

/** The name Windows' game controller panel shows (DirectInput's OEM key), when there is one. */
function oemName(api: Api, vid: number, pid: number): string | null {
  const hex = (n: number): string => n.toString(16).toUpperCase().padStart(4, '0')
  const key = `System\\CurrentControlSet\\Control\\MediaProperties\\PrivateProperties\\Joystick\\OEM\\VID_${hex(vid)}&PID_${hex(pid)}`
  for (const root of [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE]) {
    const buf = Buffer.alloc(512)
    const size = u32(buf.length)
    if (api.RegGetValueW(root, key, 'OEMName', RRF_RT_REG_SZ, null, buf, size) === 0) {
      const name = cleanControllerName(wide(buf))
      if (name !== null) return name
    }
  }
  return null
}
