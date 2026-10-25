/**
 * The last payload of each widget, handed to the window that hosts it whenever that window
 * becomes able to show it (first load, reload, recovery, a widget moved to another display):
 * one sent while a window loads is lost, and the telemetry process never repeats an unchanged
 * payload (a static practice table would stay empty). Forgotten whenever it would be stale.
 * No Electron.
 */
import type { OverlayStatus, WidgetDataMessage } from '@shared/types'
import type { WidgetId } from '@shared/widgets'

/** The telemetry is producing data now (anything else makes every payload stale). */
export function isLiveStatus(status: OverlayStatus): boolean {
  return status.state === 'connected' || status.state === 'mock'
}

export class PayloadCache {
  private readonly last = new Map<WidgetId, WidgetDataMessage>()

  remember(msg: WidgetDataMessage): void {
    this.last.set(msg.widget, msg)
  }

  latest(id: WidgetId): WidgetDataMessage | undefined {
    return this.last.get(id)
  }

  /** The widget was disabled or a rule hid it: its provider stops, its payload is stale. */
  forget(id: WidgetId): void {
    this.last.delete(id)
  }

  /** A status that is not live: every payload belongs to the old connection. */
  onStatus(status: OverlayStatus): void {
    if (!isLiveStatus(status)) this.last.clear()
  }

  clear(): void {
    this.last.clear()
  }
}
