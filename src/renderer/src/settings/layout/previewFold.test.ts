import { describe, expect, it } from 'vitest'
import { FOLD_AT_PX, foldedFor, scrolledFold } from './previewFold'

const WINDOW = 900
const scroll = (top: number, room = 2000): { top: number; height: number; client: number } => ({
  top,
  height: room + 500,
  client: 500
})

describe('scrolledFold (R14)', () => {
  it('folds once the options scroll past the threshold, and unfolds back at the top', () => {
    expect(scrolledFold(false, scroll(0), WINDOW)).toBe(false)
    expect(scrolledFold(false, scroll(FOLD_AT_PX), WINDOW)).toBe(false)
    expect(scrolledFold(false, scroll(FOLD_AT_PX + 1), WINDOW)).toBe(true)
    // In between, it stays as it was: no flicker.
    expect(scrolledFold(true, scroll(20), WINDOW)).toBe(true)
    expect(scrolledFold(false, scroll(20), WINDOW)).toBe(false)
    expect(scrolledFold(true, scroll(4), WINDOW)).toBe(false)
  })

  it('never folds a page with too little to scroll (folding would bring it back up)', () => {
    expect(scrolledFold(false, scroll(100, 300), WINDOW)).toBe(false)
    expect(scrolledFold(false, scroll(100, 400), WINDOW)).toBe(true)
  })
})

describe('foldedFor (R14)', () => {
  it('folds on scroll, always, or never, as chosen', () => {
    expect(foldedFor('auto', false)).toBe(false)
    expect(foldedFor('auto', true)).toBe(true)
    expect(foldedFor('pinned', true)).toBe(false)
    expect(foldedFor('small', false)).toBe(true)
  })
})
