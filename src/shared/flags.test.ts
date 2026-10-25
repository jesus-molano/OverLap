import { GlobalFlags } from '@irsdk-node/types'
import { describe, expect, it } from 'vitest'
import { CAUTION_FLAGS, LAPS_REMAIN_UNLIMITED, SessionFlag } from './flags'

describe('SessionFlag', () => {
  it('mirrors the irsdk GlobalFlags values', () => {
    for (const [name, value] of Object.entries(SessionFlag)) {
      expect(GlobalFlags[name as keyof typeof GlobalFlags], name).toBe(value)
    }
  })

  it('has the derived constants', () => {
    expect(CAUTION_FLAGS).toBe(0xc000)
    expect(LAPS_REMAIN_UNLIMITED).toBe(32767)
  })
})
