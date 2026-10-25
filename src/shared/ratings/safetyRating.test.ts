import { describe, it, expect } from 'vitest'
import {
  cpiFromSr,
  cpiToHold,
  licenseFromLevel,
  projectSafetyRating,
  projectSr,
  sessionWeight
} from './safetyRating'
import type { SafetyRatingInput } from './safetyRating'

const R = 0
const D = 1
const C = 2
const B = 3
const A = 4
const PRO = 5

/** LicLevel of a class index and band (1..4). */
function level(licClass: number, band: number): number {
  return licClass * 4 + band
}

function input(over: Partial<SafetyRatingInput>): SafetyRatingInput {
  return {
    licLevel: level(C, 3),
    licSubLevel: 300,
    incidents: 0,
    corners: 0,
    sessionType: 'Race',
    ...over
  }
}

describe('licence level', () => {
  it('splits LicLevel into class and band (Nishizumi SR docs)', () => {
    expect(licenseFromLevel(13)).toEqual({ licClass: B, band: 1 })
    expect(licenseFromLevel(20)).toEqual({ licClass: A, band: 4 })
    expect(licenseFromLevel(10)).toEqual({ licClass: C, band: 2 })
    expect(licenseFromLevel(1)).toEqual({ licClass: R, band: 1 })
    expect(licenseFromLevel(24)).toEqual({ licClass: PRO, band: 4 })
  })

  it('rejects unknown levels', () => {
    expect(licenseFromLevel(0)).toBeNull()
    expect(licenseFromLevel(25)).toBeNull()
    expect(licenseFromLevel(Number.NaN)).toBeNull()
  })
})

describe('CPI <-> SR mapping', () => {
  it('CPI needed to hold 3.00 per class (MODEL.md 3.3)', () => {
    expect(cpiToHold(R)).toBeCloseTo(10.8, 1)
    expect(cpiToHold(D)).toBeCloseTo(15.7, 1)
    expect(cpiToHold(C)).toBeCloseTo(22.9, 1)
    expect(cpiToHold(B)).toBeCloseTo(33.3, 1)
    expect(cpiToHold(A)).toBeCloseTo(48.5, 1)
    expect(cpiToHold(PRO)).toBeCloseTo(70.7, 1)
  })

  it('other entries of the table', () => {
    expect(cpiToHold(R, 1)).toBeCloseTo(5.1, 1)
    expect(cpiToHold(PRO, 4)).toBeCloseTo(102.9, 1)
    // Overlapping bands: C 3.00 = B 2.00 = A 1.00.
    expect(cpiToHold(C, 3)).toBeCloseTo(cpiToHold(B, 2), 9)
    expect(cpiToHold(B, 2)).toBeCloseTo(cpiToHold(A, 1), 9)
  })

  it('inverts 2.99 on band 2 of C (INTEGRATION.md worked example)', () => {
    expect(cpiFromSr(2.99, C, 2)).toBeCloseTo(30.0963, 3)
  })
})

describe('projectSr (the JS pipeline)', () => {
  it('C 2.99, three clean laps of 14 corners: band crossing to 3.4601', () => {
    const r = projectSr(2.99, C, 42, 0, 2)
    expect(r.sr).toBeCloseTo(3.4601, 4)
    expect(r.cpi).toBeCloseTo(30.9515, 3)
    expect(r.band).toBe(3)
  })

  it('21 corners and 4x from 2.75: race vs open qualifying weights', () => {
    expect(projectSr(2.75, C, 21, 4, 2).sr).toBeCloseTo(2.6696, 3)
    expect(projectSr(2.75, C, 21 * 0.5, 4 * 0.5, 2).sr).toBeCloseTo(2.7091, 3)
  })

  it('a whole-number crossing is worth about +0.43, not a hard-coded 0.40', () => {
    // Clean corners just enough to cross: the raw value barely moves, the remap adds 0.427.
    const r = projectSr(2.999, C, 2, 0, 2)
    expect(r.sr - 3).toBeCloseTo(0.4274, 2)
  })
})

describe('sessionWeight', () => {
  it('applies the Sporting Code multipliers', () => {
    expect(sessionWeight('Race')).toBe(1)
    expect(sessionWeight('Heat Race')).toBe(1)
    expect(sessionWeight('Practice')).toBe(0.5)
    expect(sessionWeight('Open Qualify')).toBe(0.5)
    expect(sessionWeight('Warmup')).toBe(0.5)
    expect(sessionWeight('Lone Qualify')).toBe(0.35)
    expect(sessionWeight('Lone Practice')).toBe(0.35)
    expect(sessionWeight('Time Trial')).toBe(0.35)
    expect(sessionWeight('Offline Testing')).toBe(0.5)
    expect(sessionWeight('')).toBe(0)
    expect(sessionWeight('Something else')).toBe(0)
  })
})

describe('projectSafetyRating', () => {
  it('is null when the licence, the SR or the session type is unknown', () => {
    expect(projectSafetyRating(input({ licLevel: 0 }))).toBeNull()
    expect(projectSafetyRating(input({ licSubLevel: 0 }))).toBeNull()
    expect(projectSafetyRating(input({ sessionType: '' }))).toBeNull()
    expect(projectSafetyRating(input({ sessionType: 'Unknown' }))).toBeNull()
  })

  it('reproduces the worked example end to end', () => {
    const p = projectSafetyRating(
      input({ licLevel: level(C, 2), licSubLevel: 299, corners: 42, incidents: 0 })
    )!
    expect(p.current).toBe(2.99)
    expect(p.projected).toBe(3.46)
    expect(p.licClass).toBe('C')
    expect(p.projectedLicClass).toBe('C')
    expect(p.corners).toBe(42)
    expect(p.incidents).toBe(0)
  })

  it('weights corners and incidents by session type', () => {
    const base = { licLevel: level(C, 2), licSubLevel: 275, corners: 21, incidents: 4 }
    expect(projectSafetyRating(input({ ...base, sessionType: 'Race' }))!.projected).toBe(2.67)
    expect(projectSafetyRating(input({ ...base, sessionType: 'Open Qualify' }))!.projected).toBe(
      2.71
    )
    const lone = projectSafetyRating(input({ ...base, sessionType: 'Lone Qualify' }))!
    expect(lone.projected).toBeCloseTo(projectSr(2.75, C, 21 * 0.35, 4 * 0.35, 2).sr, 2)
    expect(lone.projected).toBeGreaterThan(2.71)
  })

  it('a clean session raises SR and many incidents lower it', () => {
    const clean = projectSafetyRating(
      input({ licLevel: level(C, 2), licSubLevel: 250, corners: 100 })
    )!
    expect(clean.projected).toBeGreaterThan(2.5)
    const messy = projectSafetyRating(
      input({ licLevel: level(C, 2), licSubLevel: 250, corners: 100, incidents: 20 })
    )!
    expect(messy.projected).toBeLessThan(2.5)
  })

  it('is monotonic: more incidents never help, more clean corners never hurt', () => {
    let prev = Infinity
    for (let inc = 0; inc <= 40; inc++) {
      const sr = projectSafetyRating(input({ corners: 200, incidents: inc }))!.projected
      expect(sr).toBeLessThanOrEqual(prev)
      prev = sr
    }
    // Class A: no fast-track promotion re-rendering the value 1.00 lower.
    prev = -Infinity
    for (let corners = 0; corners <= 3000; corners += 50) {
      const sr = projectSafetyRating(
        input({ licLevel: level(A, 3), licSubLevel: 312, corners })
      )!.projected
      expect(sr).toBeGreaterThanOrEqual(prev)
      prev = sr
    }
  })

  it('does not move before a corner is driven', () => {
    // 3.00 still on band 2 (a rounded 2.996): the JS would jump to 3.43 here.
    const edge = projectSafetyRating(input({ licLevel: level(C, 2), licSubLevel: 300 }))!
    expect(edge.projected).toBe(3)
    expect(edge.incidentBudget).toBe(0)
    const withIncidents = projectSafetyRating(input({ incidents: 4 }))!
    expect(withIncidents.projected).toBe(3)
  })

  it('handles an SR below 1.00 although LicLevel cannot express band 0', () => {
    const still = projectSafetyRating(input({ licLevel: level(C, 1), licSubLevel: 50 }))!
    expect(still.projected).toBe(0.5)
    const clean = projectSafetyRating(
      input({ licLevel: level(C, 1), licSubLevel: 50, corners: 100 })
    )!
    expect(clean.projected).toBeGreaterThan(0.5)
    expect(clean.projected).toBeLessThan(1)
  })

  it('caps the SR at 4.99', () => {
    const p = projectSafetyRating(
      input({ licLevel: level(A, 4), licSubLevel: 499, corners: 2000 })
    )!
    expect(p.projected).toBe(4.99)
    expect(p.projectedLicClass).toBe('A')
  })

  describe('incident budget', () => {
    it('C 3.00 over 220 race corners: about 9 incidents', () => {
      const p = projectSafetyRating(input({ corners: 220 }))!
      expect(p.incidentBudget).toBe(9) // 220 / 22.9 CPI
      // Using it all keeps SR; one more loses it.
      const atBudget = projectSafetyRating(input({ corners: 220, incidents: 9 }))!
      expect(atBudget.projected).toBeGreaterThanOrEqual(3)
      expect(atBudget.incidentBudget).toBe(0)
      const over = projectSafetyRating(input({ corners: 220, incidents: 10 }))!
      expect(over.projected).toBeLessThan(3)
      expect(over.incidentBudget).toBe(0)
    })

    it('counts what is left after the incidents already taken', () => {
      expect(projectSafetyRating(input({ corners: 220, incidents: 5 }))!.incidentBudget).toBe(4)
      expect(projectSafetyRating(input({ corners: 220, incidents: 30 }))!.incidentBudget).toBe(0)
    })

    it('does not depend on the session weight (it cancels out)', () => {
      for (const sessionType of ['Race', 'Open Qualify', 'Lone Qualify', 'Time Trial']) {
        expect(projectSafetyRating(input({ corners: 220, sessionType }))!.incidentBudget).toBe(9)
      }
    })

    it('is tighter in higher classes at the same SR', () => {
      const budget = (licClass: number): number =>
        projectSafetyRating(input({ licLevel: level(licClass, 3), corners: 400 }))!.incidentBudget
      expect(budget(R)).toBeGreaterThan(budget(C))
      expect(budget(C)).toBeGreaterThan(budget(A))
      expect(budget(A)).toBeGreaterThan(budget(PRO))
    })
  })

  describe('fast-track promotion', () => {
    it('a rookie reaching 3.00 is projected in class D (about 1.00 lower)', () => {
      const p = projectSafetyRating(
        input({ licLevel: level(R, 2), licSubLevel: 295, corners: 60 })
      )!
      const raw = projectSr(2.95, R, 60, 0, 2)
      expect(raw.sr).toBeGreaterThanOrEqual(3)
      expect(p.licClass).toBe('R')
      expect(p.projectedLicClass).toBe('D')
      expect(p.projected).toBeCloseTo(raw.sr - 1, 2)
    })

    it('D, C and B are promoted when crossing 4.00', () => {
      const cases: [number, string][] = [
        [D, 'C'],
        [C, 'B'],
        [B, 'A']
      ]
      for (const [licClass, next] of cases) {
        const p = projectSafetyRating(
          input({ licLevel: level(licClass, 3), licSubLevel: 398, corners: 100 })
        )!
        expect(p.projectedLicClass).toBe(next)
        expect(p.projected).toBeCloseTo(projectSr(3.98, licClass, 100, 0, 3).sr - 1, 2)
      }
    })

    it('a band crossing below the threshold keeps the class letter', () => {
      const p = projectSafetyRating(
        input({ licLevel: level(D, 2), licSubLevel: 298, corners: 60 })
      )!
      expect(p.projected).toBeGreaterThan(3.3)
      expect(p.projectedLicClass).toBe('D')
    })

    it('never for A or Pro, nor when already above the threshold', () => {
      const a = projectSafetyRating(
        input({ licLevel: level(A, 3), licSubLevel: 398, corners: 100 })
      )!
      expect(a.projected).toBeGreaterThan(4)
      expect(a.projectedLicClass).toBe('A')
      const pro = projectSafetyRating(
        input({ licLevel: level(PRO, 3), licSubLevel: 398, corners: 100 })
      )!
      expect(pro.projectedLicClass).toBe('P')
      // C 4.20 has not been promoted yet (participation pending): no projection either.
      const waiting = projectSafetyRating(
        input({ licLevel: level(C, 4), licSubLevel: 420, corners: 100 })
      )!
      expect(waiting.projectedLicClass).toBe('C')
      expect(waiting.projected).toBeGreaterThan(4.2)
    })

    it('keeps the budget in the current class', () => {
      const p = projectSafetyRating(
        input({ licLevel: level(D, 3), licSubLevel: 398, corners: 100 })
      )!
      expect(p.incidentBudget).toBe(Math.floor(100 / cpiFromSr(3.98, D, 3)))
    })
  })
})
