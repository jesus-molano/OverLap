import { defaultSourceKind, parseSourceKind } from '@shared/source'
import type { SourceKind } from '@shared/types'
import type { TelemetrySource } from './TelemetrySource'

/**
 * Source from the OVERLAY_SOURCE env var ('mock' | 'iracing', any case).
 * Missing or unknown values default to iracing on Windows, mock elsewhere.
 */
export function resolveSourceKind(env: string | undefined, platform: string): SourceKind {
  return parseSourceKind(env) ?? defaultSourceKind(platform)
}

/** Dynamic imports: the mock path never loads the native addon. */
export async function createSource(kind: SourceKind): Promise<TelemetrySource> {
  if (kind === 'mock') {
    const { MockSource } = await import('./MockSource')
    return new MockSource()
  }
  const { IRacingSource } = await import('./IRacingSource')
  return new IRacingSource()
}
