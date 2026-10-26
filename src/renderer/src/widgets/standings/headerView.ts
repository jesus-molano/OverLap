/**
 * View model of the standings header (ux §4.4): session, your incidents and what is left, and
 * on a second line your projected iRating and safety rating (race) or the session's best lap
 * (practice and qualifying). Flat and formatted, like the line views. Pure. Words come from the
 * dictionary (HeaderInput.m); the examples are the Spanish ones.
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
import { toIncidentCountView, type IncidentCountView } from '@renderer/view/incidents'
import type { Tone } from '@renderer/ui/tones'
import { primaryBlock, type HeadLines } from './layout'
import { classMeta } from './view'

export type Arrow = Extract<IconName, 'arrow-up' | 'arrow-down'> | ''

export interface HeaderView {
  /** 'CARRERA', or the widget name when the session is unknown. */
  title: string
  /** Single-class session: the class meta ('SoF 2.0k', '12 coches') next to the title. */
  meta: string
  /** Sample content (edit mode): the 'VISTA PREVIA' tag. */
  preview: boolean
  /** You took the chequered flag (anyone, without your row): 'Final' instead of what is left. */
  finished: boolean
  /** '38:19  ≈19 v' (en-spaced), 'Quedan 12 v', 'Última vuelta', '' when unknown. */
  remaining: string
  /** Your incident count on line 1 ('3x'), '' when hidden or unknown; the rest as in IncidentCount. */
  incCount: string
  incTeam: string
  incLimit: string
  incTone: IncidentCountView['tone']
  lines: HeadLines
  /** Practice / qualifying: 'Mejor 2:07.579  #29' (en-spaced), else ''. */
  best: string
  hasIr: boolean
  /** Your projected change now: '+13'. */
  irValue: string
  irTone: Tone
  irArrow: Arrow
  /**
   * What one place up is worth: 'P4 +31'; without your row, the iRating per position
   * ('±17/pos'); '' when unknown or nothing to gain (P1). Each swing is its own group in the
   * header (two strings, not a list, so an unchanged header keeps its object).
   */
  irSwingUp: string
  /** What one place down costs: 'P6 −5'; '' when unknown. */
  irSwingDown: string
  /** 'neutro P6', '' when unknown. */
  irNeutral: string
  hasSr: boolean
  /** Current SR, with the licence letter only when the projection changes it: 'B 3.98'. */
  srFrom: string
  srTo: string
  srTone: Tone
  srArrow: Arrow
  /** '2x'; '' while line 1 shows your incident count (it would say the same twice). */
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
  showIncidents: boolean
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

/**
 * The race is over for you: your row took the flag, or no lap is left for you (the cool-down:
 * also for a car parked in its box that never took it). Without your row (spectating), once
 * anyone did. The leader's flag alone is not it: you may still be on your last lap.
 */
function raceFinished(h: StandingsHeader | null, classes: readonly StandingsClassBlock[]): boolean {
  if (h?.lapsRemaining === 0) return true
  let any = false
  for (const c of classes) {
    for (const r of c.rows) {
      if (r.isPlayer) return r.status === 'finished'
      if (r.status === 'finished') any = true
    }
  }
  return any
}

/**
 * What is left: 'Última vuelta' on a race's last lap with no clock running (the flag is out,
 * or a race by laps), else the clock and/or the laps ('38:19  ≈19 v').
 */
function remainingText(h: StandingsHeader, race: boolean, m: Messages): string {
  if (race && h.lapsRemaining === 1 && h.timeRemainingS === null) {
    return m.widgets.standings.lastLap
  }
  return formatRemaining(h.lapsRemaining, h.timeRemainingS, m)
}

interface IrSwing {
  up: string
  down: string
}

const NO_SWING: IrSwing = Object.freeze({ up: '', down: '' })

/** One place up and one down from your position; the per-position figure without it. */
function irSwing(ir: PlayerRatingProjection, pos: number | null, m: Messages): IrSwing {
  const up =
    pos !== null && pos > 1 && ir.ifGainOne !== null
      ? `P${pos - 1} ${formatIRatingDelta(ir.ifGainOne)}`
      : ''
  const down =
    pos !== null && ir.ifLoseOne !== null ? `P${pos + 1} ${formatIRatingDelta(ir.ifLoseOne)}` : ''
  if (up !== '' || down !== '') return { up, down }
  return Number.isFinite(ir.perPosition) && ir.perPosition > 0
    ? { up: m.widgets.standings.perPosition(Math.round(ir.perPosition)), down: '' }
    : NO_SWING
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

/** 'Mejor 2:07.579  #29' from the leader of your class (the best lap outside races). */
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
  const swing = ir !== null ? irSwing(ir, playerPosition(classes), m) : NO_SWING
  const neutral =
    ir !== null && Number.isFinite(ir.breakEvenPosition) && ir.breakEvenPosition > 0
      ? Math.round(ir.breakEvenPosition)
      : null
  const inc = i.showIncidents ? toIncidentCountView(h?.incidents ?? null, m) : null

  return {
    title: formatSessionType(h?.sessionType ?? null, m) || i.title,
    meta: single !== undefined ? classMeta(single, i.showSof, i.showCarCount, m) : '',
    preview: i.preview,
    finished: i.race && raceFinished(h, classes),
    remaining: h !== null ? remainingText(h, i.race, m) : '',
    incCount: inc?.count ?? '',
    incTeam: inc?.team ?? '',
    incLimit: inc?.limit ?? '',
    incTone: inc?.tone ?? 'neutral',
    lines: ir !== null || sr !== null || best !== '' ? 2 : 1,
    best,
    hasIr: ir !== null,
    irValue: ir !== null ? formatIRatingDelta(ir.iRatingDelta) : '',
    irTone: valueTone(irSign),
    irArrow: arrowOf(irSign),
    irSwingUp: swing.up,
    irSwingDown: swing.down,
    irNeutral: neutral !== null ? t.breakEven(neutral) : '',
    hasSr: sr !== null,
    srFrom,
    srTo,
    srTone: valueTone(srSign),
    srArrow: arrowOf(srSign),
    srIncidents:
      sr !== null && inc === null ? t.incidents(Math.max(0, Math.round(sr.incidents)) || 0) : '',
    srBudget: budget.text,
    srBudgetTone: budget.tone
  }
}

/**
 * How much of the header fits the panel width (em of its font): '' everything; 'm' without the
 * per-position iRating; 's' also without the neutral position, the SR you start from and the
 * team's incidents; 'xs' also without the SR's incident count and the incident limit (your
 * count always stays).
 */
export type HeaderTier = '' | 'm' | 's' | 'xs'

export function headerTier(widthEm: number): HeaderTier {
  if (!(widthEm > 0) || widthEm >= 31) return ''
  if (widthEm >= 26) return 'm'
  if (widthEm >= 21) return 's'
  return 'xs'
}
