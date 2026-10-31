/**
 * Edit-mode sample of the spotter: everything it can say at once, so the window is placed and
 * sized on realistic content, for the bar style in use.
 * «Cercanía»: on the left a car closing in (just over half full, amber), on the right two cars
 * alongside (full, red, the «2»).
 * «Dónde te cubre»: on the left a car over the front 60 % of yours, the one before it about to
 * come alongside at your rear; on the right two cars (the «2»), one at your nose, one level with
 * your rear wheels.
 */
import type { SpotterBarStyle, SpotterData } from '@shared/types'

export function previewSpotter(style: SpotterBarStyle = 'closeness'): SpotterData {
  const right: SpotterData['right'] = {
    count: 2,
    segs: [
      { from: 0, to: 0.3 },
      { from: 0.52, to: 1 }
    ],
    cover: 0.78,
    unknown: false,
    nearFront: 0,
    nearRear: 0,
    close: 1
  }
  if (style === 'closeness') {
    return {
      active: true,
      visible: true,
      left: {
        count: 0,
        segs: [],
        cover: 0,
        unknown: false,
        nearFront: 0,
        nearRear: 0.6,
        close: 0.56
      },
      right
    }
  }
  return {
    active: true,
    visible: true,
    left: {
      count: 1,
      segs: [{ from: 0, to: 0.6 }],
      cover: 0.6,
      unknown: false,
      nearFront: 0,
      nearRear: 0.6,
      close: 1
    },
    right
  }
}
