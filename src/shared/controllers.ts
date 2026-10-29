/**
 * Buttons of game controllers (a wheel or its rim, a button box, pedals, a shifter, a
 * handbrake) as shortcut bindings. They are read passively by the input process (src/input,
 * Raw Input: shared with iRacing, nothing is blocked or opened for reading) and named here.
 * Pure.
 *
 * A controller is `joy:<vid>:<pid>:<iface>` (lowercase hex): the USB vendor and product ids,
 * and `0` (no interface or collection, or only `MI_00`), or the interface and collection
 * numbers of the device path (`MI_01&COL02` gives `0102`: a Fanatec base or a box may expose several collections, each its own device). The
 * USB instance (which changes with the port) is left out, so two identical controllers share
 * their bindings. A binding is the controller and the button's HID usage on the Button page,
 * from 1 as Windows' game controller panel numbers them: `joy:046d:c24f:0:7`.
 */

/** A controller's id: `joy:046d:c24f:0`. */
export const CONTROLLER_ID_RE = /^joy:[0-9a-f]{4}:[0-9a-f]{4}:[0-9a-f]{1,8}$/
/** A button binding: `joy:046d:c24f:0:7` (button 1..65535, no leading zero). */
export const BUTTON_BINDING_RE = /^(joy:[0-9a-f]{4}:[0-9a-f]{4}:[0-9a-f]{1,8}):([1-9][0-9]{0,4})$/

/** The highest button number (a HID usage is 16 bits). */
export const MAX_BUTTON = 0xffff

/** How many controller names settings.buttonDeviceNames keeps. */
export const MAX_DEVICE_NAMES = 32
/** A controller's name is cut to this many characters. */
export const MAX_DEVICE_NAME = 80

export interface ButtonBinding {
  /** The controller: `joy:046d:c24f:0`. */
  device: string
  /** The button: its HID usage on the Button page, from 1. */
  button: number
}

/** A connected controller as the input process reports it. */
export interface ControllerInfo {
  id: string
  /** Its product name ('G29 Driving Force Racing Wheel'), or `VID 046D PID C24F`. */
  name: string
  /** How many buttons it declares (on the Button page). */
  buttons: number
}

export function isControllerId(value: unknown): value is string {
  return typeof value === 'string' && CONTROLLER_ID_RE.test(value)
}

/** The binding in `value`, when it is a valid one (exactly in its canonical spelling). */
export function parseButtonBinding(value: unknown): ButtonBinding | null {
  if (typeof value !== 'string') return null
  const m = BUTTON_BINDING_RE.exec(value)
  if (!m || m[1] === undefined || m[2] === undefined) return null
  const button = Number(m[2])
  if (button > MAX_BUTTON) return null
  return { device: m[1], button }
}

export function isButtonBinding(value: unknown): value is string {
  return parseButtonBinding(value) !== null
}

/** `joy:046d:c24f:0` and 7 -> `joy:046d:c24f:0:7`. */
export function buttonBinding(device: string, button: number): string {
  return `${device}:${button}`
}

function hex4(n: number): string {
  return (n & 0xffff).toString(16).padStart(4, '0')
}

/**
 * The id of the controller with this vendor and product id and Raw Input device path
 * (`\\?\HID#VID_046D&PID_C24F&MI_00#8&17280a47&0&0000#{...}`): the interface and collection
 * numbers of the path, `0` without either.
 */
export function controllerId(vid: number, pid: number, path: string): string {
  const upper = path.toUpperCase()
  const mi = /[#&\\]MI_([0-9A-F]{2})/.exec(upper)?.[1] ?? ''
  const col = /[#&\\]COL([0-9A-F]{2,4})/.exec(upper)?.[1] ?? ''
  const both = `${mi === '' ? '00' : mi}${col}`.toLowerCase()
  // The first (or only) interface without collections, the usual case: plain 0.
  const iface = both === '00' ? '0' : both
  return `joy:${hex4(vid)}:${hex4(pid)}:${iface}`
}

/** What a controller without a product name is called: `VID 046D PID C24F`. */
export function fallbackControllerName(id: string): string {
  const parts = id.split(':')
  return `VID ${(parts[1] ?? '').toUpperCase()} PID ${(parts[2] ?? '').toUpperCase()}`
}

/** A product name made safe to show and store: no control characters, trimmed, cut short. */
export function cleanControllerName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (text === '') return null
  return text.length > MAX_DEVICE_NAME ? text.slice(0, MAX_DEVICE_NAME).trimEnd() : text
}

/**
 * settings.buttonDeviceNames from anything: valid ids with a clean name, at most
 * MAX_DEVICE_NAMES of them (the first ones), and only those `keep` names when it is given
 * (the controllers some binding uses).
 */
export function normalizeDeviceNames(
  raw: unknown,
  keep?: ReadonlySet<string>
): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out
  let n = 0
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_DEVICE_NAMES) break
    if (!isControllerId(id) || (keep !== undefined && !keep.has(id))) continue
    const name = cleanControllerName(value)
    if (name === null) continue
    out[id] = name
    n++
  }
  return out
}

/** The controllers the bindings use (the button ones among `bindings`). */
export function boundControllers(bindings: Iterable<string>): Set<string> {
  const out = new Set<string>()
  for (const b of bindings) {
    const parsed = parseButtonBinding(b)
    if (parsed) out.add(parsed.device)
  }
  return out
}

/**
 * The names to keep after the controllers in `connected` were seen: each bound controller
 * connected now gets its current name, the others keep theirs, and names of controllers no
 * binding uses are dropped. The same object when nothing changes.
 */
export function updateDeviceNames(
  names: Readonly<Record<string, string>>,
  bound: ReadonlySet<string>,
  connected: readonly ControllerInfo[]
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const id of bound) {
    const now = connected.find((c) => c.id === id)
    const name = (now && cleanControllerName(now.name)) ?? names[id]
    if (name !== undefined) out[id] = name
  }
  const before = Object.keys(names)
  const after = Object.keys(out)
  const same = before.length === after.length && after.every((id) => names[id] === out[id])
  return same ? names : normalizeDeviceNames(out)
}
