/**
 * View model of the standings header (ux §4.4): session, what is left, and on a second line
 * your projected iRating and safety rating (race) or the session's best lap (practice and
 * qualifying). Flat and formatted, like the line views. Pure. Words come from the dictionary
 * (HeaderInput.m); the examples are the Spanish ones.
 */
import {
  formatIRatingDelta,
  formatLapTime,
  formatRemaining,
  formatSafetyRating,
  formatSessionType,
  signAt
} from '@shared/format'
import type { Messages } from '@shared/i18n'
import type {
  PlayerRatingProjection,
  SafetyRatingProjection,
  StandingsClassBlock,
  StandingsHeader
} from '@shared/types'
import type { IconName } from '@renderer/ui/icons'
import { formatCarNumber } from '@renderer/view/driverCell'
import type { Tone } from '@renderer/ui/tones'
import { primaryBlock, type HeadLines } from './layout'
import { classMeta } from './view'

export type Arrow = Extract<IconName, 'arrow-up' | 'arrow-down'> | ''

export interface HeaderView {
  /** 'CARRERA', or the widget name when the session is unknown. */
  title: string
  /** Single-class session: 'SoF 2.0k · 12 coches' next to the title. */
  meta: string
  /** Sample content (edit mode): the 'VISTA PREVIA' tag. */
  preview: boolean
  /** The chequered flag is out: 'Final' instead of what is left. */
  finished: boolean
  /** '38:19 · ≈19 v', 'Quedan 12 v', '' when unknown. */
  remaining: string
  lines: HeadLines
  /** Practice / qualifying: 'Mejor 2:07.579 · #29', else ''. */
  best: string
  hasIr: boolean
  /** Your projected change now: '+13'. */
  irValue: string
  irTone: Tone
  irArrow: Arrow
  /** 'P4 +31 · P6 -5' (one place up / down), else '±17/pos'; '' when unknown. */
  irSwing: string
  /** 'neutro P6', '' when unknown. */
  irNeutral: string
  hasSr: boolean
  /** Current SR, with the licence letter only when the projection changes it: 'B 3.98'. */
  srFrom: string
  srTo: string
  srTone: Tone
  srArrow: Arrow
  /** '2x'. */
  srIncidents: string
  /** 'margen 4x', 'sin margen', 'margen —'. */
  srBudget: string
  /** dim: nothing measurable yet; neutral: plenty; warn: 1-2 left; bad: none left (a chip). */
  srBudgetTone: 'dim' | 'neutral' | 'warn' | 'bad'
}

export interface HeaderInput {
  header: StandingsHeader | null
  classes: readonly StandingsClassBlock[] | null
  race: boolean
  /** The header options: a toggle hides its part at once, before the next payload. */
  showIRating: boolean
  showSafetyRating: boolean
  showSof: boolean
  showCarCount: boolean
  preview: boolean
  /** The widget's caption ('CLASIFICACIÓN'), the title while the session type is unknown. */
  title: string
  m: Messages
}

/** Tone of a projected change: green up, red down, plain text when it does not move. */
function valueTone(sign: 1 | 0 | -1 | null): Tone {
  return sign === 1 ? 'good' : sign === -1 ? 'bad' : 'neutral'
}

function arrowOf(sign: 1 | 0 | -1 | null): Arrow {
  return sign === 1 ? 'arrow-up' : sign === -1 ? 'arrow-down' : ''
}

/** Your class position, null when your row is not in the payload. */
function playerPosition(classes: readonly StandingsClassBlock[]): number | null {
  for (const c of classes) {
    for (const r of c.rows) if (r.isPlayer && r.classPosition > 0) return r.classPosition
  }
  return null
}

function irSwing(ir: PlayerRatingProjection, pos: number | null, m: Messages): string {
  const parts: string[] = []
  if (pos !== null && pos > 1 && ir.ifGainOne !== null) {
    parts.push(`P${pos - 1} ${formatIRatingDelta(ir.ifGainOne)}`)
  }
  if (pos !== null && ir.ifLoseOne !== null) {
    parts.push(`P${pos + 1} ${formatIRatingDelta(ir.ifLoseOne)}`)
  }
  if (parts.length > 0) return parts.join(' · ')
  return Number.isFinite(ir.perPosition) && ir.perPosition > 0
    ? m.widgets.standings.perPosition(Math.round(ir.perPosition))
    : ''
}

/**
 * The incident margin. Red ('sin margen') only when it is really gone: incidents already used
 * it up, or the projection is below the current SR. A clean driver early in a session (no
 * corners driven yet) reads 'margen —', never red.
 */
export function srBudget(
  sr: SafetyRatingProjection,
  m: Messages
): {
  text: string
  tone: HeaderView['srBudgetTone']
} {
  const t = m.widgets.standings
  const budget = Number.isFinite(sr.incidentBudget) ? Math.max(0, Math.floor(sr.incidentBudget)) : 0
  const incidents = Number.isFinite(sr.incidents) ? Math.max(0, Math.round(sr.incidents)) : 0
  const losing = signAt(sr.projected - sr.current, 2) === -1
  if (budget === 0 && (incidents > 0 || losing)) return { text: t.noBudget, tone: 'bad' }
  if (budget === 0) return { text: t.budgetUnknown, tone: 'dim' }
  return { text: t.budget(budget), tone: budget <= 2 ? 'warn' : 'neutral' }
}

/** 'Mejor 2:07.579 · #29' from the leader of your class (the best lap outside races). */
function bestLine(classes: readonly StandingsClassBlock[], m: Messages): string {
  const block = classes[primaryBlock(classes)]
  const leader = block?.rows.find((r) => r.classPosition === 1)
  if (leader === undefined || leader.bestLap === null) return ''
  const time = formatLapTime(leader.bestLap)
  if (time === '—') return ''
  const num = formatCarNumber(leader.carNumber)
  const t = m.widgets.standings
  return num !== '' ? t.bestBy(time, num) : t.best(time)
}

export function toHeaderView(i: HeaderInput): HeaderView {
  const h = i.header
  const m = i.m
  const t = m.widgets.standings
  const classes = i.classes ?? []
  const ir = i.race && i.showIRating ? (h?.iRating ?? null) : null
  const sr = i.showSafetyRating ? (h?.safetyRating ?? null) : null
  const best = i.race ? '' : bestLine(classes, m)
  const single = classes.length === 1 ? classes[0] : undefined

  let srFrom = ''
  let srTo = ''
  let srSign: 1 | 0 | -1 | null = null
  let budget: ReturnType<typeof srBudget> = { text: '', tone: 'dim' }
  if (sr !== null) {
    const letters = sr.licClass !== sr.projectedLicClass
    srFrom = (letters ? `${sr.licClass} ` : '') + formatSafetyRating(sr.current)
    srTo = (letters ? `${sr.projectedLicClass} ` : '') + formatSafetyRating(sr.projected)
    // Compared as shown (hundredths), so the arrow never contradicts the numbers.
    srSign = signAt(sr.projected - sr.current, 2)
    budget = srBudget(sr, m)
  }
  const irSign = ir !== null ? signAt(ir.iRatingDelta, 0) : null
  const neutral =
    ir !== null && Number.isFinite(ir.breakEvenPosition) && ir.breakEvenPosition > 0
      ? Math.round(ir.breakEvenPosition)
      : null

  return {
    title: formatSessionType(h?.sessionType ?? null, m) || i.title,
    meta: single !== undefined ? classMeta(single, i.showSof, i.showCarCount, m) : '',
    preview: i.preview,
    finished: i.race && classes.some((c) => c.rows.some((r) => r.status === 'finished')),
    remaining: h !== null ? formatRemaining(h.lapsRemaining, h.timeRemainingS, m) : '',
    lines: ir !== null || sr !== null || best !== '' ? 2 : 1,
    best,
    hasIr: ir !== null,
    irValue: ir !== null ? formatIRatingDelta(ir.iRatingDelta) : '',
    irTone: valueTone(irSign),
    irArrow: arrowOf(irSign),
    irSwing: ir !== null ? irSwing(ir, playerPosition(classes), m) : '',
    irNeutral: neutral !== null ? t.breakEven(neutral) : '',
    hasSr: sr !== null,
    srFrom,
    srTo,
    srTone: valueTone(srSign),
    srArrow: arrowOf(srSign),
    srIncidents: sr !== null ? t.incidents(Math.max(0, Math.round(sr.incidents)) || 0) : '',
    srBudget: budget.text,
    srBudgetTone: budget.tone
  }
}

/**
 * How much of the header fits the panel width (em of its font): '' everything; 'm' without the
 * per-position iRating; 's' also without the neutral position and the SR you start from;
 * 'xs' also without the incident count.
 */
export type HeaderTier = '' | 'm' | 's' | 'xs'

export function headerTier(widthEm: number): HeaderTier {
  if (!(widthEm > 0) || widthEm >= 31) return ''
  if (widthEm >= 26) return 'm'
  if (widthEm >= 21) return 's'
  return 'xs'
}
