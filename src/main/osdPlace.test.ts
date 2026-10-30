import { describe, expect, it } from 'vitest'
import type { DisplayInfo } from './overlayLayout'
import { OSD_SIZE, gameDisplay, osdBounds } from './osdPlace'

const LEFT: DisplayInfo = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1
}
const RIGHT: DisplayInfo = {
  id: 2,
  bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
  workArea: { x: 1920, y: 0, width: 2560, height: 1400 },
  scaleFactor: 1
}
const at = (x: number, y: number): { x: number; y: number; width: number; height: number } => ({
  x,
  y,
  width: 200,
  height: 100
})

describe('gameDisplay (R37)', () => {
  it('is the display holding most of the widgets that are on', () => {
    expect(gameDisplay([at(2000, 50), at(3000, 900), at(100, 100)], [LEFT, RIGHT], 1)).toBe(RIGHT)
  })

  it('is the primary one on a tie, or with no widget on', () => {
    expect(gameDisplay([at(2000, 50), at(100, 100)], [LEFT, RIGHT], 1)).toBe(LEFT)
    expect(gameDisplay([], [LEFT, RIGHT], 2)).toBe(RIGHT)
    expect(gameDisplay([], [], 1)).toBeUndefined()
  })
})

describe('osdBounds (R37)', () => {
  it('is at the top centre of the work area it is given', () => {
    expect(osdBounds(RIGHT.workArea)).toEqual({
      x: 1920 + (2560 - OSD_SIZE.width) / 2,
      y: 36,
      ...OSD_SIZE
    })
  })
})
