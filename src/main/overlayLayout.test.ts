import { describe, expect, it } from 'vitest'
import type { Rect } from '@shared/types'
import { WIDGET_DEFS, type WidgetId } from '@shared/widgets'
import {
  acceptRect,
  anyShown,
  applyFit,
  boundsDrift,
  buildLayout,
  displayAtPoint,
  displayNumbers,
  dropRect,
  fittedBounds,
  hostWindowBounds,
  owningDisplay,
  partition,
  placeWidget,
  reconcileWindows,
  sameDisplays,
  sameLayoutContent,
  toLocal,
  toScreen,
  windowOrigin,
  type DisplayInfo
} from './overlayLayout'

/** Primary 1920x1080 (taskbar 40 px), a 2560x1440 at 150 % to its left, a 1280x1024 above. */
const PRIMARY: DisplayInfo = {
  id: 10,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  scaleFactor: 1
}
const LEFT: DisplayInfo = {
  id: 20,
  bounds: { x: -1707, y: -200, width: 1707, height: 960 },
  workArea: { x: -1707, y: -200, width: 1707, height: 920 },
  scaleFactor: 1.5
}
const TOP: DisplayInfo = {
  id: 30,
  bounds: { x: 0, y: -1024, width: 1280, height: 1024 },
  workArea: { x: 0, y: -1024, width: 1280, height: 1024 },
  scaleFactor: 1
}
const ALL = [PRIMARY, LEFT, TOP]

function rect(x: number, y: number, width: number, height: number): Rect {
  return { x, y, width, height }
}

describe('displayNumbers', () => {
  it('numbers the primary display 1, then the others left to right, top to bottom', () => {
    expect([...displayNumbers([TOP, PRIMARY, LEFT], PRIMARY.id)]).toEqual([
      [10, 1],
      [20, 2],
      [30, 3]
    ])
    const below = { ...TOP, id: 40, bounds: { ...TOP.bounds, y: 1080 } }
    // Primary unknown: everything by position.
    expect([...displayNumbers([below, TOP, PRIMARY], LEFT.id)]).toEqual([
      [30, 1],
      [10, 2],
      [40, 3]
    ])
  })
})

describe('sameDisplays', () => {
  it('compares id, bounds, work area and scale factor, in any order', () => {
    expect(sameDisplays(ALL, [TOP, LEFT, PRIMARY])).toBe(true)
    expect(sameDisplays(ALL, [PRIMARY, LEFT])).toBe(false)
    expect(sameDisplays([PRIMARY], [{ ...PRIMARY, id: 11 }])).toBe(false)
    expect(sameDisplays([PRIMARY], [{ ...PRIMARY, scaleFactor: 1.25 }])).toBe(false)
    expect(sameDisplays([PRIMARY], [{ ...PRIMARY, workArea: PRIMARY.bounds }])).toBe(false)
    expect(sameDisplays([PRIMARY], [{ ...PRIMARY, bounds: rect(0, 0, 1920, 1200) }])).toBe(false)
    expect(sameDisplays([], [])).toBe(true)
  })
})

describe('owningDisplay / displayAtPoint', () => {
  it('is the display containing the centre', () => {
    // Mostly on the primary display, but its centre is on the left one.
    expect(owningDisplay(rect(-210, 100, 400, 100), ALL)).toBe(LEFT)
    expect(owningDisplay(rect(-190, 100, 400, 100), ALL)).toBe(PRIMARY)
    expect(owningDisplay(rect(100, -300, 50, 50), ALL)).toBe(TOP)
  })

  it('falls back to the most overlap, then the nearest display', () => {
    // Centre in the gap left of TOP (x < 0, y < -200): overlaps TOP only.
    expect(owningDisplay(rect(-60, -500, 100, 20), ALL)).toBe(TOP)
    expect(owningDisplay(rect(5000, 5000, 10, 10), ALL)).toBe(PRIMARY)
    expect(owningDisplay(rect(0, 0, 10, 10), [])).toBeUndefined()
  })

  it('finds the display under a point', () => {
    expect(displayAtPoint({ x: -1, y: 0 }, ALL)).toBe(LEFT)
    expect(displayAtPoint({ x: 0, y: -1 }, ALL)).toBe(TOP)
    expect(displayAtPoint({ x: 1919, y: 1079 }, ALL)).toBe(PRIMARY)
  })
})

describe('placeWidget', () => {
  const def = WIDGET_DEFS.relative.defaultBounds

  it('keeps saved bounds that are still visible, clamped into their display', () => {
    expect(placeWidget(rect(-500, 100, 460, 252), def, ALL, PRIMARY)).toEqual(
      rect(-500, 100, 460, 252)
    )
    expect(placeWidget(rect(1800, 100, 460, 252), def, ALL, PRIMARY)).toEqual(
      rect(1460, 100, 460, 252)
    )
  })

  it('falls back to the default place on the primary work area when its display is gone', () => {
    expect(placeWidget(rect(-1500, 100, 460, 252), def, [PRIMARY], PRIMARY)).toEqual(
      rect(def.x, def.y, def.width, def.height)
    )
  })
})

describe('partition', () => {
  const rects = new Map<WidgetId, Rect>([
    ['relative', rect(60, 260, 460, 252)],
    ['radar', rect(-800, 0, 220, 260)],
    ['standings', rect(100, -500, 540, 400)],
    ['inputs', rect(820, 860, 360, 120)]
  ])

  it('groups the enabled widgets by display, WIDGET_IDS order', () => {
    const parts = partition(rects, (id) => id !== 'inputs', ALL)
    expect(parts).toEqual(
      new Map([
        [10, ['relative']],
        [20, ['radar']],
        [30, ['standings']]
      ])
    )
    const all = partition(rects, () => true, ALL)
    expect(all.get(10)).toEqual(['relative', 'inputs'])
  })

  it('leaves out displays with no enabled widget', () => {
    expect(partition(rects, (id) => id === 'radar', ALL)).toEqual(new Map([[20, ['radar']]]))
    expect(partition(rects, () => false, ALL).size).toBe(0)
  })
})

describe('reconcileWindows', () => {
  it('keeps the windows whose display is still needed', () => {
    const plan = reconcileWindows(
      [
        { key: 1, displayId: 10 },
        { key: 2, displayId: 20 }
      ],
      [20, 10]
    )
    expect(plan).toEqual({
      assign: new Map([
        [1, 10],
        [2, 20]
      ]),
      create: [],
      destroy: []
    })
  })

  it('reuses a window whose display id changed instead of creating one', () => {
    const plan = reconcileWindows(
      [
        { key: 1, displayId: 10 },
        { key: 2, displayId: 20 }
      ],
      [10, 21]
    )
    expect(plan.assign).toEqual(
      new Map([
        [1, 10],
        [2, 21]
      ])
    )
    expect(plan.create).toEqual([])
    expect(plan.destroy).toEqual([])
  })

  it('creates what is missing and destroys the leftovers', () => {
    expect(reconcileWindows([], [10, 20])).toEqual({
      assign: new Map(),
      create: [10, 20],
      destroy: []
    })
    expect(
      reconcileWindows(
        [
          { key: 1, displayId: 10 },
          { key: 2, displayId: null },
          { key: 3, displayId: 30 }
        ],
        [10]
      )
    ).toEqual({ assign: new Map([[1, 10]]), create: [], destroy: [2, 3] })
  })

  it('never gives two windows the same display', () => {
    const plan = reconcileWindows(
      [
        { key: 1, displayId: 10 },
        { key: 2, displayId: 10 }
      ],
      [10, 10]
    )
    expect(plan).toEqual({ assign: new Map([[1, 10]]), create: [], destroy: [2] })
  })
})

describe('coordinates', () => {
  it('converts between screen DIP and window-local px, the window origin being the display', () => {
    const origin = windowOrigin(LEFT)
    expect(origin).toEqual({ x: -1707, y: -200 })
    expect(hostWindowBounds(LEFT)).toEqual(LEFT.bounds)
    expect(hostWindowBounds(LEFT)).not.toBe(LEFT.bounds)
    const r = rect(-1000, 50, 300, 200)
    expect(toLocal(r, origin)).toEqual(rect(707, 250, 300, 200))
    expect(toScreen(toLocal(r, origin), origin)).toEqual(r)
  })
})

describe('buildLayout / sameLayoutContent', () => {
  const rects = new Map<WidgetId, Rect>([
    ['relative', rect(-1000, 50, 460, 252)],
    ['radar', rect(-600, 300, 220, 260)]
  ])
  const placements = new Map<WidgetId, number>([['radar', 3]])
  const base = {
    display: LEFT,
    index: 2,
    widgets: ['relative', 'radar'] as WidgetId[],
    rects,
    placements,
    session: 4,
    ackSeq: 7,
    revision: 12
  }

  it('describes the display and the panels in window-local px', () => {
    expect(buildLayout(base)).toEqual({
      revision: 12,
      session: 4,
      ackSeq: 7,
      display: {
        id: 20,
        index: 2,
        bounds: rect(0, 0, 1707, 960),
        workArea: rect(0, 0, 1707, 920),
        scaleFactor: 1.5
      },
      panels: [
        { widget: 'relative', rect: rect(707, 250, 460, 252), placement: 0 },
        { widget: 'radar', rect: rect(1107, 500, 220, 260), placement: 3 }
      ]
    })
  })

  it('compares everything but the revision', () => {
    const a = buildLayout(base)
    expect(sameLayoutContent(a, buildLayout({ ...base, revision: 99 }))).toBe(true)
    expect(sameLayoutContent(a, buildLayout({ ...base, session: 5 }))).toBe(false)
    expect(sameLayoutContent(a, buildLayout({ ...base, ackSeq: 8 }))).toBe(false)
    expect(sameLayoutContent(a, buildLayout({ ...base, index: 3 }))).toBe(false)
    expect(sameLayoutContent(a, buildLayout({ ...base, widgets: ['relative'] }))).toBe(false)
    expect(
      sameLayoutContent(a, buildLayout({ ...base, placements: new Map([['radar', 4]]) }))
    ).toBe(false)
    const moved = new Map(rects).set('radar', rect(-600, 301, 220, 260))
    expect(sameLayoutContent(a, buildLayout({ ...base, rects: moved }))).toBe(false)
    const taskbar = { ...LEFT, workArea: LEFT.bounds }
    expect(sameLayoutContent(a, buildLayout({ ...base, display: taskbar }))).toBe(false)
  })
})

describe('acceptRect', () => {
  const min = WIDGET_DEFS.radar.minSize

  it('converts to screen DIP, rounds and keeps it on the window display', () => {
    const origin = windowOrigin(LEFT)
    expect(acceptRect(rect(10.4, 20.6, 300.2, 200.5), origin, LEFT, min)).toEqual(
      rect(-1697, -179, 300, 201)
    )
    // Past the right edge of LEFT (window-local 1707): moved back inside, never onto PRIMARY.
    expect(acceptRect(rect(1600, 0, 300, 200), origin, LEFT, min)).toEqual(
      rect(-300, -200, 300, 200)
    )
  })

  it('raises the size to the minimum and shrinks it to the display', () => {
    const origin = windowOrigin(PRIMARY)
    expect(acceptRect(rect(100, 100, 10, 10), origin, PRIMARY, min)).toEqual(
      rect(100, 100, min.width, min.height)
    )
    expect(acceptRect(rect(0, 0, 5000, 5000), origin, PRIMARY, min)).toEqual(rect(0, 0, 1920, 1080))
    expect(acceptRect(rect(Number.NaN, 0, 300, 200), origin, PRIMARY, min)).toBeNull()
  })
})

describe('dropRect', () => {
  it('places the widget under the cursor on the target display, at the grab offset', () => {
    // Dropped on a 150 % display: DIP stay DIP, nothing is scaled.
    expect(
      dropRect(
        { x: -1000, y: 100 },
        { x: 40, y: 10 },
        { width: 220, height: 260 },
        WIDGET_DEFS.radar.minSize,
        LEFT
      )
    ).toEqual(rect(-1040, 90, 220, 260))
  })

  it('clamps into the target display and raises the size to the minimum', () => {
    expect(
      dropRect(
        { x: -5, y: 700 },
        { x: 0, y: 0 },
        { width: 50, height: 50 },
        WIDGET_DEFS.radar.minSize,
        LEFT
      )
    ).toEqual(rect(-120, 620, 120, 140))
  })
})

describe('applyFit / fittedBounds', () => {
  const work = PRIMARY.workArea

  it('grows and shrinks keeping the anchored edge', () => {
    expect(applyFit(rect(100, 100, 400, 200), 300, 'top', work, 60)).toEqual(
      rect(100, 100, 400, 300)
    )
    expect(applyFit(rect(100, 500, 400, 200), 100, 'bottom', work, 60)).toEqual(
      rect(100, 600, 400, 100)
    )
  })

  it('stops at the work area on the growing side and at the minimum height', () => {
    expect(applyFit(rect(100, 900, 400, 100), 9_000, 'top', work, 60)).toEqual(
      rect(100, 900, 400, 140)
    )
    expect(applyFit(rect(100, 100, 400, 100), 9_000, 'bottom', work, 60)).toEqual(
      rect(100, 0, 400, 200)
    )
    expect(applyFit(rect(100, 100, 400, 100), 5, 'top', work, 60)).toEqual(rect(100, 100, 400, 60))
  })

  it('returns the same rect when nothing changes', () => {
    const r = rect(100, 100, 400, 200)
    expect(applyFit(r, 200.4, 'top', work, 60)).toBe(r)
  })

  it('saves only the height, on the saved place', () => {
    expect(fittedBounds(rect(-1500, 100, 400, 200), 260, 'top')).toEqual(rect(-1500, 100, 400, 260))
    expect(fittedBounds(rect(-1500, 100, 400, 200), 260, 'bottom')).toEqual(
      rect(-1500, 40, 400, 260)
    )
  })
})

describe('anyShown / boundsDrift', () => {
  it('tells whether any hosted widget is drawn', () => {
    expect(anyShown(['relative', 'radar'], (id) => id === 'radar')).toBe(true)
    expect(anyShown(['relative'], () => false)).toBe(false)
    expect(anyShown([], () => true)).toBe(false)
  })

  it('reports a drift of more than 1 DIP on any edge', () => {
    const want = rect(0, 0, 1920, 1080)
    expect(boundsDrift(rect(1, -1, 1920, 1080), want)).toBe(false)
    expect(boundsDrift(rect(0, 0, 1921, 1081), want)).toBe(false)
    expect(boundsDrift(rect(2, 0, 1920, 1080), want)).toBe(true)
    expect(boundsDrift(rect(0, 0, 1920, 1078), want)).toBe(true)
    expect(boundsDrift(rect(0, 0, 2880, 1620), want)).toBe(true)
  })
})
