/**
 * The "Mostrar en" / "Ocultar en boxes" rules of the telemetry config,
 * evaluated on every tick. Tracks which widgets they hide and reports only the
 * changes (allocation-free: the callback is the loop's, made once).
 */
import {
  currentSessionType,
  isCarInPits,
  resolvePlayerCarIdx,
  ruleHiddenReason,
  sessionKind
} from '@shared/sessionInfo'
import type { VisibilityRule } from '@shared/sessionInfo'
import type { TelemetryFrame } from '@shared/telemetry'
import type { HiddenReason, SessionMeta, TelemetryConfig } from '@shared/types'
import { WIDGET_IDS, type WidgetId } from '@shared/widgets'

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

  /** Session type from SessionNum, the player's pit state from their CarIdx. */
  update(rules: TelemetryConfig['rules'], frame: TelemetryFrame, session: SessionMeta): void {
    const kind = sessionKind(currentSessionType(frame, session))
    const inPits = isCarInPits(frame, resolvePlayerCarIdx(frame, session))
    for (const id of WIDGET_IDS) {
      // Main always sends a rule per widget; a missing one never hides.
      const rule = rules[id] as VisibilityRule | undefined
      this.set(id, rule ? ruleHiddenReason(rule, kind, inPits) : null)
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
