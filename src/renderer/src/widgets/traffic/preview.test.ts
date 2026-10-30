/**
 * The traffic sample as the settings page draws it: the look windows applied as the provider
 * applies them (a longer window brings further cars in), and a busy field where the count per
 * group shows.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { PREVIEW_TRAFFIC, previewTraffic, type PreviewWindows } from './preview'

const D: PreviewWindows = DEFAULT_SETTINGS.traffic
const counts = (w: Partial<PreviewWindows> = {}, field: 'spread' | 'busy' = 'spread'): number[] => {
  const d = previewTraffic({ ...D, ...w }, field)
  return [d.hazards.length, d.slower.length, d.faster.length]
}

describe('previewTraffic', () => {
  it('draws the usual sample with the default windows', () => {
    const d = previewTraffic(D)
    expect(d.hazards).toEqual(PREVIEW_TRAFFIC.hazards)
    expect(d.slower).toEqual(PREVIEW_TRAFFIC.slower)
    expect(d.faster).toEqual(PREVIEW_TRAFFIC.faster)
  })

  it('brings further cars in with a longer window, and drops them with a shorter one', () => {
    expect(counts()).toEqual([1, 2, 2])
    expect(counts({ behindS: 30 })).toEqual([1, 2, 5])
    expect(counts({ aheadS: 30 })).toEqual([1, 5, 2])
    expect(counts({ hazardS: 20 })).toEqual([2, 2, 2])
    expect(counts({ hazardS: 2 })[0]).toBe(0)
    // Each step of a window can change what is drawn (closest first, as the provider sends).
    expect(counts({ behindS: 16 })).toEqual([1, 2, 3])
    const far = previewTraffic({ ...D, behindS: 30 }).faster.map((e) => Math.abs(e.gapS))
    expect(far).toEqual([...far].sort((a, b) => a - b))
  })

  it('puts five cars close by in each group in the busy field, inside the narrowest window', () => {
    expect(counts({ behindS: 2, aheadS: 2, hazardS: 2 }, 'busy')).toEqual([5, 5, 5])
    const ids = previewTraffic(D, 'busy')
    const all = [...ids.hazards, ...ids.slower, ...ids.faster].map((e) => e.driver.carIdx)
    expect(new Set(all).size).toBe(all.length)
  })
})
