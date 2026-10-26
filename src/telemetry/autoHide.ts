/**
 * The visibility rules of the telemetry config, evaluated on every tick: the global ones
 * (when to show the overlay, garage screen, hidden iRacing UI, session screen, replays) first,
 * then each widget's "Mostrar en" / "Ocultar en boxes". Tracks which widgets they hide and
 * reports only the changes (allocation-free: the callback is the loop's, made once).
 */
import {
  currentSessionType,
  isCarInPits,
  resolveFocusCarIdx,
  resolvePlayerCarIdx,
  ruleHiddenReason,
  sessionKind
} from '@shared/sessionInfo'
import { isInCar, screenHiddenReason, type ReplayMode, type ScreenFacts } from '@shared/simScreen'
import type { TelemetryFrame } from '@shared/telemetry'
import type { HiddenReason, SessionMeta, TelemetryConfig, VisibilityOptions } from '@shared/types'
import { WIDGET_IDS, followsCamera, keepsLiveInReplay, type WidgetId } from '@shared/widgets'

/** `reason`: the rule hiding the widget (a code, worded by each window), null when shown. */
export type AutoHideListener = (
  widget: WidgetId,
  hidden: boolean,
  reason: HiddenReason | null
) => void

type Rule = TelemetryConfig['rules'][WidgetId]

/** ScreenFacts with mutable fields: one object, refilled on every tick. */
type Facts = { -readonly [K in keyof ScreenFacts]: ScreenFacts[K] }

export class AutoHide {
  /** Rule hiding each widget, null while shown. */
  private readonly reasons = Object.fromEntries(WIDGET_IDS.map((id) => [id, null])) as Record<
    WidgetId,
    HiddenReason | null
  >
  private readonly facts: Facts = { mode: 'none', inCar: null, kind: null }

  constructor(private readonly onChange: AutoHideListener) {}

  isHidden(id: WidgetId): boolean {
    return this.reasons[id] !== null
  }

  /**
   * `frame`: what the sim shows now (the screen rules read it). `live`: the frame the widgets'
   * data comes from, the same one except in a replay of the tape (`mode` 'tape'), where it is
   * the last live frame: the session type and the pits rule follow it, like the standings kept
   * on screen. The pits rule looks at the car the widgets are about (the one on camera at a
   * replay's live point, see resolveFocusCarIdx). `inCar`: whether you are in the car (the
   * loop's InCarHold; by default IsOnTrack of the live frame, with no hold).
   */
  update(
    config: Pick<TelemetryConfig, 'rules' | 'visibility'>,
    frame: TelemetryFrame,
    session: SessionMeta,
    mode: ReplayMode,
    live: TelemetryFrame = frame,
    inCar: boolean | null = isInCar(live)
  ): void {
    // Main always sends the global rules; missing ones never hide.
    const visibility = config.visibility as VisibilityOptions | undefined
    const kind = sessionKind(currentSessionType(live, session))
    const focus = resolveFocusCarIdx(live, session)
    const inPits = isCarInPits(live, focus)
    // The camera on another car at the live point: only the widgets that follow it stay.
    const otherCar = mode === 'live' && focus !== resolvePlayerCarIdx(live, session)
    const facts = this.facts
    facts.mode = mode
    facts.inCar = inCar
    facts.kind = kind
    for (const id of WIDGET_IDS) {
      // Main always sends a rule per widget; a missing one never hides.
      const rule = config.rules[id] as Rule | undefined
      let reason = visibility
        ? screenHiddenReason(visibility, frame, facts, rule?.showOnSessionScreen === true)
        : null
      // The tape is not live: only what shows the live race as last seen stays.
      if (reason === null && mode === 'tape' && !keepsLiveInReplay(id)) reason = 'replay-player'
      if (reason === null && otherCar && !followsCamera(id)) reason = 'camera-other'
      if (reason === null && rule) reason = ruleHiddenReason(rule, kind, inPits)
      this.set(id, reason)
    }
  }

  /** Session unknown (connection lost): every widget is shown again. */
  showAll(): void {
    for (const id of WIDGET_IDS) this.set(id, null)
  }

  private set(id: WidgetId, reason: HiddenReason | null): void {
    if (reason === this.reasons[id]) return
    this.reasons[id] = reason
    this.onChange(id, reason !== null, reason)
  }
}
