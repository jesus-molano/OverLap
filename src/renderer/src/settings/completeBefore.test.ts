import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SettingsPatch } from '@shared/types'
import { beforeComplete, noteStyleApplied, rememberBeforeComplete } from './completeBefore'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v)
  }
}

const OWN: SettingsPatch = { standings: { showHeader: false } } as SettingsPatch
const LATER: SettingsPatch = { relative: { showHeader: false } } as SettingsPatch

describe('what the widgets showed before «Completo»', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('is remembered by «Completo» and forgotten again when that is undone', () => {
    const undo = noteStyleApplied('complete', OWN, false)
    expect(beforeComplete()).toEqual(OWN)
    undo()
    expect(beforeComplete()).toBeNull()
  })

  it('is forgotten by «OverLap», and undoing OverLap offers the take-back again', () => {
    rememberBeforeComplete(OWN)
    const undo = noteStyleApplied('overlap', LATER, false)
    expect(beforeComplete()).toBeNull()
    undo()
    expect(beforeComplete()).toEqual(OWN)
  })

  it('is forgotten by a take-back, and back after undoing it', () => {
    rememberBeforeComplete(OWN)
    const undo = noteStyleApplied('compact', LATER, true)
    expect(beforeComplete()).toBeNull()
    undo()
    expect(beforeComplete()).toEqual(OWN)
  })

  it('stays as it is for a look alone without the take-back', () => {
    rememberBeforeComplete(OWN)
    const undo = noteStyleApplied('clean', LATER, false)
    expect(beforeComplete()).toEqual(OWN)
    undo()
    expect(beforeComplete()).toEqual(OWN)
  })
})
