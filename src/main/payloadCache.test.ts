import { describe, expect, it } from 'vitest'
import type { OverlayStatus, WidgetDataMessage } from '@shared/types'
import { PayloadCache, isLiveStatus } from './payloadCache'

const STANDINGS = { widget: 'standings', payload: {} } as unknown as WidgetDataMessage
const RADAR = { widget: 'radar', payload: {} } as unknown as WidgetDataMessage

function status(state: OverlayStatus['state']): OverlayStatus {
  return { state, source: 'mock', note: 'none', detail: '' }
}

describe('PayloadCache', () => {
  it('keeps the latest payload per widget', () => {
    const c = new PayloadCache()
    const newer = { ...STANDINGS }
    c.remember(STANDINGS)
    c.remember(RADAR)
    c.remember(newer)
    expect(c.latest('standings')).toBe(newer)
    expect(c.latest('radar')).toBe(RADAR)
    expect(c.latest('inputs')).toBeUndefined()
  })

  it('forgets one widget, everything on a status that is not live, and on clear', () => {
    const c = new PayloadCache()
    c.remember(STANDINGS)
    c.remember(RADAR)
    c.forget('radar')
    expect(c.latest('radar')).toBeUndefined()
    c.onStatus(status('connected'))
    c.onStatus(status('mock'))
    expect(c.latest('standings')).toBe(STANDINGS)
    c.onStatus(status('waiting'))
    expect(c.latest('standings')).toBeUndefined()
    c.remember(RADAR)
    c.clear()
    expect(c.latest('radar')).toBeUndefined()
  })

  it('treats only connected and mock as live', () => {
    expect(isLiveStatus(status('connected'))).toBe(true)
    expect(isLiveStatus(status('mock'))).toBe(true)
    for (const s of ['starting', 'waiting', 'error'] as const) {
      expect(isLiveStatus(status(s))).toBe(false)
    }
  })
})
