/**
 * The options as the search's second pass sees them (R33): every list item shown and every
 * switch on, so the controls that only appear with another setting are rendered and indexed
 * («Primeros puestos» needs Posiciones in «Compacto»; the trace's options need the trace shown).
 * A widget's own section; a few choices are set where "on" is not what shows more, in it or in
 * a global section (Visibilidad's session-screen switch). Pure.
 */
import type { OptionSection } from '@shared/settingsSchema'
import { isWidgetId } from '@shared/widgets'

/** Fields where showing more is one value, not `true`. */
const MORE: Partial<Record<string, Record<string, unknown>>> = {
  // Its compact-mode options are only there in compact.
  standings: { mode: 'compact' },
  // The wheel's size and mark are a wheel's, not the bar's.
  inputs: { steeringStyle: 'realistic' },
  // The side of the texts is chosen only without captions.
  lights: { showCaptions: false },
  // «Ocultar en la pantalla de sesión» is offered only while replays follow the camera.
  visibility: { replays: 'follow' }
}

function isElementEntry(v: unknown): v is { visible: boolean } {
  return (
    typeof v === 'object' && v !== null && typeof (v as { visible?: unknown }).visible === 'boolean'
  )
}

function opened(v: unknown): unknown {
  if (typeof v === 'boolean') return true
  if (Array.isArray(v))
    return v.map((e) => (isElementEntry(e) ? { ...e, visible: true } : opened(e)))
  if (typeof v === 'object' && v !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) out[k] = opened(x)
    return out
  }
  return v
}

export function unlockedOptions(section: OptionSection, own: unknown): unknown {
  const more = MORE[section]
  if (typeof own !== 'object' || own === null || (!isWidgetId(section) && !more)) return own
  const out = (isWidgetId(section) ? opened(own) : { ...own }) as Record<string, unknown>
  if (more) for (const [k, v] of Object.entries(more)) if (k in out) out[k] = v
  return out
}
