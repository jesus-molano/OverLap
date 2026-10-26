import { describe, expect, it } from 'vitest'
import {
  CAPTURE_MARGIN_DIP,
  FORWARD_IN_EDIT,
  ignoreArgs,
  mouseMode,
  panelAt,
  type HitPanel,
  type MouseInputs
} from './mouseMode'

const TOP: HitPanel = { rect: { x: 100, y: 100, width: 200, height: 100 }, locked: false }
const UNDER: HitPanel = { rect: { x: 150, y: 150, width: 200, height: 200 }, locked: false }
const LOCKED: HitPanel = { rect: { x: 150, y: 150, width: 200, height: 200 }, locked: true }

function inputs(over: Partial<MouseInputs>): MouseInputs {
  return {
    editing: true,
    healthy: true,
    dragging: false,
    current: 'forward',
    cursor: { x: 0, y: 0 },
    panels: [TOP, UNDER],
    ...over
  }
}

describe('panelAt', () => {
  it('finds the topmost panel under the point, edges included on the left and top', () => {
    expect(panelAt({ x: 160, y: 160 }, [TOP, UNDER], 0)).toBe(TOP)
    expect(panelAt({ x: 340, y: 340 }, [TOP, UNDER], 0)).toBe(UNDER)
    expect(panelAt({ x: 100, y: 100 }, [TOP], 0)).toBe(TOP)
    expect(panelAt({ x: 300, y: 150 }, [TOP], 0)).toBeNull()
    expect(panelAt({ x: 0, y: 0 }, [], 0)).toBeNull()
  })

  it('grows every panel by the margin', () => {
    expect(panelAt({ x: 96, y: 150 }, [TOP], 4)).toBe(TOP)
    expect(panelAt({ x: 95, y: 150 }, [TOP], 4)).toBeNull()
    expect(panelAt({ x: 303, y: 150 }, [TOP], 4)).toBe(TOP)
  })
})

describe('mouseMode', () => {
  it('ignores the mouse outside edit mode or when the window is not healthy', () => {
    const over = { x: 160, y: 160 }
    expect(mouseMode(inputs({ editing: false, cursor: over, dragging: true }))).toBe('ignore')
    expect(mouseMode(inputs({ healthy: false, cursor: over, dragging: true }))).toBe('ignore')
  })

  it('captures during a drag lease wherever the cursor is', () => {
    expect(mouseMode(inputs({ dragging: true, cursor: { x: 5000, y: 5000 } }))).toBe('capture')
  })

  it('captures over the topmost unlocked panel, never over a locked one', () => {
    expect(mouseMode(inputs({ cursor: { x: 160, y: 160 } }))).toBe('capture')
    expect(mouseMode(inputs({ cursor: { x: 340, y: 340 } }))).toBe('capture')
    // The locked panel is on top: the unlocked one below does not take the mouse there.
    expect(mouseMode(inputs({ panels: [LOCKED, TOP], cursor: { x: 160, y: 160 } }))).toBe('forward')
    expect(mouseMode(inputs({ panels: [LOCKED, TOP], cursor: { x: 120, y: 120 } }))).toBe('capture')
  })

  it('forwards outside every panel', () => {
    expect(mouseMode(inputs({ cursor: { x: 10, y: 10 } }))).toBe('forward')
    expect(mouseMode(inputs({ panels: [], cursor: { x: 160, y: 160 } }))).toBe('forward')
  })

  it('captures over the edit chip of a locked panel or a ghost, and only there', () => {
    const chip = { x: 200, y: 154, width: 100, height: 20 }
    const locked: HitPanel = { ...LOCKED, chip }
    expect(mouseMode(inputs({ panels: [locked], cursor: { x: 210, y: 160 } }))).toBe('capture')
    expect(mouseMode(inputs({ panels: [locked], cursor: { x: 210, y: 180 } }))).toBe('forward')
    // Hysteresis around the chip too, once captured.
    const near = { x: 210, y: 174 + CAPTURE_MARGIN_DIP - 1 }
    expect(mouseMode(inputs({ panels: [locked], cursor: near, current: 'forward' }))).toBe(
      'forward'
    )
    expect(mouseMode(inputs({ panels: [locked], cursor: near, current: 'capture' }))).toBe(
      'capture'
    )
    // No chip reported: a locked panel never takes the mouse.
    expect(mouseMode(inputs({ panels: [LOCKED], cursor: { x: 210, y: 160 } }))).toBe('forward')
  })

  it('captures over a chip a panel painted later covers: the chips are drawn above them all', () => {
    // From a saved layout: the alerts' chip under the radar, the battle's under a fitted sample.
    const chip = { x: 200, y: 154, width: 100, height: 20 }
    const under: HitPanel = { ...LOCKED, chip }
    const lockedTop: HitPanel = { rect: { x: 190, y: 140, width: 50, height: 50 }, locked: true }
    const top: HitPanel = { ...lockedTop, locked: false }
    for (const cover of [lockedTop, top]) {
      expect(mouseMode(inputs({ panels: [cover, under], cursor: { x: 210, y: 160 } }))).toBe(
        'capture'
      )
    }
    // Off the chip the panel on top decides: a locked one gives the mouse to the game.
    expect(mouseMode(inputs({ panels: [lockedTop, under], cursor: { x: 210, y: 185 } }))).toBe(
      'forward'
    )
    expect(mouseMode(inputs({ panels: [top, under], cursor: { x: 210, y: 185 } }))).toBe('capture')
  })

  it('lets the mouse through a ghost to the panels below it, but over its chip', () => {
    const chip = { x: 100, y: 100, width: 80, height: 20 }
    const ghost: HitPanel = { ...TOP, locked: true, ghost: true, chip }
    // Over the ghost's chip: its eye takes the click.
    expect(mouseMode(inputs({ panels: [ghost, UNDER], cursor: { x: 120, y: 110 } }))).toBe(
      'capture'
    )
    // Elsewhere on the ghost: the unlocked panel below it, or the game.
    expect(mouseMode(inputs({ panels: [ghost, UNDER], cursor: { x: 200, y: 160 } }))).toBe(
      'capture'
    )
    expect(mouseMode(inputs({ panels: [ghost, LOCKED], cursor: { x: 200, y: 160 } }))).toBe(
      'forward'
    )
    expect(mouseMode(inputs({ panels: [ghost], cursor: { x: 200, y: 160 } }))).toBe('forward')
  })

  it('keeps the mouse within the margin only while already captured', () => {
    const near = { x: 100 - CAPTURE_MARGIN_DIP, y: 120 }
    expect(mouseMode(inputs({ cursor: near, current: 'forward' }))).toBe('forward')
    expect(mouseMode(inputs({ cursor: near, current: 'capture' }))).toBe('capture')
    expect(mouseMode(inputs({ cursor: { x: near.x - 1, y: 120 }, current: 'capture' }))).toBe(
      'forward'
    )
  })
})

describe('ignoreArgs', () => {
  it('maps each mode to its setIgnoreMouseEvents arguments', () => {
    expect(ignoreArgs('ignore')).toEqual([true])
    expect(ignoreArgs('capture')).toEqual([false])
    expect(ignoreArgs('forward', true)).toEqual([true, { forward: true }])
    expect(ignoreArgs('forward', false)).toEqual([true])
    expect(ignoreArgs('ignore', true)).toEqual([true])
    expect(FORWARD_IN_EDIT).toBe(true)
  })
})
