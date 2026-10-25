/**
 * Whether the mouse cursor shows right now, read-only, through koffi (user32 GetCursorInfo).
 * iRacing hides the cursor while you drive, and then nothing can be dragged in edit mode: main
 * reads this only while editing, to say how to free it. Electron has no API for it. Windows x64
 * only; anywhere else, or if koffi does not load, the answer is "unknown" (null).
 */

/** CURSORINFO.flags: the cursor is showing... */
export const CURSOR_SHOWING = 0x1
/** ...or Windows suppresses it (touch or pen input): not visible either. */
export const CURSOR_SUPPRESSED = 0x2

/** True: showing; false: hidden or suppressed; null: unknown. */
export type CursorProbe = () => boolean | null

/** The cursor shows for these CURSORINFO.flags (normalised as a DWORD). */
export function cursorShowingFrom(flags: unknown): boolean | null {
  if (typeof flags !== 'number' || !Number.isFinite(flags)) return null
  const f = flags >>> 0
  return (f & CURSOR_SHOWING) !== 0 && (f & CURSOR_SUPPRESSED) === 0
}

type GetCursorInfo = (info: { cbSize: number; flags?: unknown }) => unknown

async function loadGetCursorInfo(): Promise<() => boolean | null> {
  const { default: koffi } = await import('koffi')
  const user32 = koffi.load('user32.dll')
  const point = koffi.struct({ x: 'int32_t', y: 'int32_t' })
  const cursorInfo = koffi.struct({
    cbSize: 'uint32_t',
    flags: 'uint32_t',
    hCursor: 'void *',
    ptScreenPos: point
  })
  const size = koffi.sizeof(cursorInfo)
  const getCursorInfo: GetCursorInfo = user32.func('GetCursorInfo', 'bool', [
    koffi.inout(koffi.pointer(cursorInfo))
  ])
  return () => {
    const info: { cbSize: number; flags?: unknown } = { cbSize: size, flags: 0 }
    return getCursorInfo(info) === true ? cursorShowingFrom(info.flags) : null
  }
}

/**
 * A probe that loads koffi on its first call and answers null until it has (and for good if it
 * cannot: logged once). Each call is one GetCursorInfo, a few microseconds.
 */
export function createCursorProbe(
  load: () => Promise<() => boolean | null> = loadGetCursorInfo,
  platform: string = process.platform
): CursorProbe {
  let read: (() => boolean | null) | null = null
  let state: 'idle' | 'loading' | 'ready' | 'failed' = platform === 'win32' ? 'idle' : 'failed'
  return () => {
    if (state === 'idle') {
      state = 'loading'
      load().then(
        (fn) => {
          read = fn
          state = 'ready'
        },
        (err: unknown) => {
          state = 'failed'
          console.warn('[main] cannot read the cursor state (GetCursorInfo):', err)
        }
      )
    }
    if (state !== 'ready' || read === null) return null
    try {
      return read()
    } catch {
      return null
    }
  }
}
