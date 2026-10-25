import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { formatDriverName } from '@shared/format'
import { messagesFor } from '@shared/i18n'
import { lineMetrics, linesEm, panelHeightPx, planLines } from './layout'
import { previewStandings, type PreviewOptions } from './preview'
import { toHeaderView } from './headerView'

const DEFAULTS: PreviewOptions = DEFAULT_SETTINGS.standings

const positions = (o: Partial<PreviewOptions> = {}): number[][] =>
  previewStandings({ ...DEFAULTS, ...o }).classes.map((c) => c.rows.map((r) => r.classPosition))

describe('previewStandings', () => {
  it('compact defaults: the top 3, three rows around you at P5, the other class leader', () => {
    const d = previewStandings(DEFAULTS)
    expect(positions()).toEqual([[1, 2, 3, 4, 5, 6, 7, 8], [1]])
    expect(d.classes[0]?.isPlayerClass).toBe(true)
    expect(d.classes[0]?.rows.find((r) => r.isPlayer)?.classPosition).toBe(5)
    expect(d.classes[0]?.rows.some((r) => r.gapBefore)).toBe(false)
  })

  it('shows every row state in the default view', () => {
    const rows = previewStandings(DEFAULTS).classes[0]?.rows ?? []
    expect(rows.some((r) => r.status === 'pits')).toBe(true)
    expect(rows.some((r) => r.outLap)).toBe(true)
    expect(rows.some((r) => r.interval?.kind === 'laps')).toBe(true)
    expect(rows.some((r) => r.lastLapKind === 'class-best')).toBe(true)
    expect(rows.some((r) => r.lastLapKind === 'personal-best')).toBe(true)
    expect(rows.some((r) => r.status === 'off-track')).toBe(true)
    expect(rows.some((r) => r.penalty === 'meatball')).toBe(true)
  })

  it('has names that exercise every name format', () => {
    const names = previewStandings({ ...DEFAULTS, mode: 'full' }).classes.flatMap((c) =>
      c.rows.map((r) => r.driverName)
    )
    expect(names.some((n) => /^\p{L}+-\p{L}+ /u.test(n))).toBe(true)
    expect(names.map((n) => formatDriverName(n, 'surname'))).toContain('van der Berg')
    expect(names.map((n) => formatDriverName(n, 'abbr'))).toContain('J. Smith Jr')
  })

  it('follows the row options like the provider', () => {
    expect(positions({ topRows: 1, aroundRows: 1 })).toEqual([[1, 4, 5, 6], [1]])
    const sep = previewStandings({ ...DEFAULTS, topRows: 1, aroundRows: 1 }).classes[0]?.rows
    expect(sep?.map((r) => r.gapBefore)).toEqual([false, true, false, false])
    expect(positions({ topRows: 0, aroundRows: 0 })).toEqual([[5], [1]])
    expect(positions({ otherClassLeaders: false })).toEqual([[1, 2, 3, 4, 5, 6, 7, 8]])
    const full = positions({ mode: 'full' })
    expect(full[0]).toHaveLength(12)
    expect(full[1]).toHaveLength(5)
  })

  it('clamps odd row counts', () => {
    expect(positions({ topRows: Number.NaN, aroundRows: 99 })[0]).toHaveLength(12)
  })

  it('follows the header toggles', () => {
    const off = previewStandings({ ...DEFAULTS, headerIRating: false, headerSafetyRating: false })
    expect(off.header.iRating).toBeNull()
    expect(off.header.safetyRating).toBeNull()
    expect(previewStandings(DEFAULTS).header.iRating).not.toBeNull()
  })

  it('sizes the default window to about 300 px, with no empty band', () => {
    const d = previewStandings(DEFAULTS)
    const m = lineMetrics('comfortable')
    const plan = planLines(d.classes, { oneLineLeaders: true }, m)
    const head = toHeaderView({
      header: d.header,
      classes: d.classes,
      race: true,
      showIRating: true,
      showSafetyRating: true,
      showSof: true,
      showCarCount: true,
      preview: true,
      title: '',
      m: messagesFor('es')
    })
    const px = panelHeightPx(linesEm(plan, m), head.lines, 13)
    expect(px).toBeGreaterThan(250)
    expect(px).toBeLessThan(330)
  })

  it('returns a fresh payload that does not share rows with the fixture', () => {
    const a = previewStandings(DEFAULTS)
    const b = previewStandings(DEFAULTS)
    expect(a).not.toBe(b)
    expect(a.classes[0]?.rows[0]).not.toBe(b.classes[0]?.rows[0])
    expect(a).toEqual(b)
  })
})
