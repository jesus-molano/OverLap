/**
 * The help under each session's delta reference (Settings > Delta): what the reference is and,
 * with the fallback on, where that session's own chain goes (DELTA_FALLBACK). Pure.
 */
import { DELTA_FALLBACK } from '@shared/delta/choice'
import type { Messages } from '@shared/i18n'
import type { DeltaReference } from '@shared/types'

/** 'Tus mejores sectores … · Si no existe: Récord → Óptima de clase'. */
export function referenceRowHelp(ref: DeltaReference, fallback: boolean, m: Messages): string {
  const d = m.settings.delta
  const hint = d.references[ref].hint
  if (!fallback) return hint
  const rest = DELTA_FALLBACK[ref].slice(1)
  const tail =
    rest.length === 0
      ? d.fallbackNone
      : d.fallbackThen(rest.map((r) => d.referencesShort[r]).join(' → '))
  return `${hint} · ${tail}`
}
