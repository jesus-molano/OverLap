import { afterEach, describe, expect, it, vi } from 'vitest'
import { INFO_BAR_SIZES } from '@shared/infoBar'
import { messagesFor } from '@shared/i18n'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

/** A fresh module (its memory empty), with `storage` as the window's local storage. */
async function load(storage?: Partial<Storage>): Promise<typeof import('./barSwitch')> {
  vi.resetModules()
  if (storage) vi.stubGlobal('localStorage', storage)
  return import('./barSwitch')
}

describe("an info bar's switch over its size", () => {
  it("offers the shown sizes ('off' is the switch)", async () => {
    const b = await load()
    expect(b.SHOWN_SIZES).toEqual(INFO_BAR_SIZES.filter((s) => s !== 'off'))
    for (const lang of ['es', 'en'] as const) {
      const m = messagesFor(lang).settings.infoBar
      for (const s of b.SHOWN_SIZES) expect(m.sizeChoices[s].label).toBeTruthy()
      expect(m.show.headerBar).toBeTruthy()
      expect(m.show.subheaderBar).toBeTruthy()
      expect(m.show.footerBar).toBeTruthy()
    }
  })

  it("stores 'off' when switched off, the last shown size (else normal) when on", async () => {
    const b = await load()
    expect(b.sizeForSwitch(false, 'large')).toBe('off')
    expect(b.sizeForSwitch(true, 'large')).toBe('large')
    expect(b.sizeForSwitch(true, 'small')).toBe('small')
    expect(b.sizeForSwitch(true, undefined)).toBe('normal')
    expect(b.sizeForSwitch(true, 'off')).toBe('normal')
    expect(b.sizeForSwitch(true, 'huge')).toBe('normal')
  })

  it('remembers the last shown size per bar, never off', async () => {
    const b = await load()
    expect(b.lastShownSize('relative.headerBar')).toBeUndefined()
    b.rememberShownSize('relative.headerBar', 'small')
    b.rememberShownSize('relative.headerBar', 'off')
    b.rememberShownSize('standings.footerBar', 'large')
    expect(b.lastShownSize('relative.headerBar')).toBe('small')
    expect(b.lastShownSize('standings.footerBar')).toBe('large')
  })

  it("keeps it in the window's storage when there is one, ignores a broken one", async () => {
    const saved = new Map<string, string>()
    const storage = {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => void saved.set(k, v)
    }
    const first = await load(storage)
    first.rememberShownSize('fuel.headerBar', 'large')
    const again = await load(storage)
    expect(again.lastShownSize('fuel.headerBar')).toBe('large')

    saved.set([...saved.keys()][0] ?? '', '{"fuel.headerBar":"off","x":"small"}')
    const odd = await load(storage)
    expect(odd.lastShownSize('fuel.headerBar')).toBeUndefined()
    expect(odd.lastShownSize('x')).toBe('small')

    const throwing = await load({
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      }
    })
    throwing.rememberShownSize('fuel.headerBar', 'small')
    expect(throwing.lastShownSize('fuel.headerBar')).toBe('small')
  })
})
