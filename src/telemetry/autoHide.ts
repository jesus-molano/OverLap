/**
 * The visibility rules of the telemetry config, evaluated on every tick: the global ones
 * (garage screen, hidden iRacing UI, replays) first, then each widget's "Mostrar en" /
 * "Ocultar en boxes". Tracks which widgets they hide and reports only the changes
 * (allocation-free: the callback is the loop's, made once).
 */
import {
  currentSessionType,
  isCarInPits,
  resolveFocusCarIdx,
  ruleHiddenReason,
  sessionKind
} from '@shared/sessionInfo'
import type { VisibilityRule } from '@shared/sessionInfo'
import { isReplayPlaying, screenHiddenReason } from '@shared/simScreen'
import type { TelemetryFrame } from '@shared/telemetry'
import type { HiddenReason, SessionMeta, TelemetryConfig, VisibilityOptions } from '@shared/types'
import { WIDGET_IDS, followsCamera, type WidgetId } from '@shared/widgets'

/** `reason`: the rule hiding the widget (a code, worded by each window), null when shown. */
export type AutoHideListener = (
  widget: WidgetId,
  hidden: boolean,
  reason: HiddenReason | null
) => void

export class AutoHide {
  /** Rule hiding each widget, null while shown. */
  private readonly reasons = Object.fromEntries(WIDGET_IDS.map((id) => [id, null])) as Record<
    WidgetId,
    HiddenReason | null
  >

  constructor(private readonly onChange: AutoHideListener) {}

  isHidden(id: WidgetId): boolean {
    return this.reasons[id] !== null
  }

  /**
   * Session type from SessionNum; the pits rule looks at the car the widgets are about (the
   * one on camera while a replay plays, see resolveFocusCarIdx).
   */
  update(
    config: Pick<TelemetryConfig, 'rules' | 'visibility'>,
    frame: TelemetryFrame,
    session: SessionMeta
  ): void {
    // Main always sends the global rules; missing ones never hide.
    const visibility = config.visibility as VisibilityOptions | undefined
    const screen = visibility ? screenHiddenReason(visibility, frame) : null
    const replay = isReplayPlaying(frame)
    const kind = sessionKind(currentSessionType(frame, session))
    const inPits = isCarInPits(frame, resolveFocusCarIdx(frame, session))
    for (const id of WIDGET_IDS) {
      // Main always sends a rule per widget; a missing one never hides.
      const rule = config.rules[id] as VisibilityRule | undefined
      let reason = screen
      // Its data is your live car's: over a replay it would show the wrong moment, or car.
      if (reason === null && replay && !followsCamera(id)) reason = 'replay-player'
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
