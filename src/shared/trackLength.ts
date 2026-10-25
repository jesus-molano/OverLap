const MIN_M = 100
const MAX_M = 50_000
const M_PER_MI = 1609.344

// Number with an optional comma or dot decimal, then an optional unit.
const LENGTH_RE = /^(\d+(?:[.,]\d+)?)\s*(km|mi|m)?$/i

/**
 * Parses WeekendInfo.TrackLength ("5.79 km") into metres.
 *
 * Unitless values (numbers or bare number strings) are taken as metres when
 * >= 100 and as km otherwise: no real track is shorter than 100 m or longer
 * than 100 km. Returns null for anything unparseable or outside 100..50 000 m.
 */
export function parseTrackLength(raw: unknown): number | null {
  if (typeof raw === 'number') return unitless(raw)
  if (typeof raw !== 'string') return null

  const m = LENGTH_RE.exec(raw.trim())
  if (!m || m[1] === undefined) return null
  const value = Number(m[1].replace(',', '.'))
  const unit = m[2]?.toLowerCase()
  if (unit === undefined) return unitless(value)
  return sane(unit === 'km' ? value * 1000 : unit === 'mi' ? value * M_PER_MI : value)
}

function unitless(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null
  return sane(value >= MIN_M ? value : value * 1000)
}

function sane(metres: number): number | null {
  if (!Number.isFinite(metres) || metres < MIN_M || metres > MAX_M) return null
  // Round to millimetres so "5.79 km" is exactly 5790.
  return Math.round(metres * 1000) / 1000
}
