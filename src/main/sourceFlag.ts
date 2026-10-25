import { defaultSourceKind, parseSourceKind } from '@shared/source'
import type { SourceKind } from '@shared/types'

/**
 * Telemetry source to start with. The CLI flag (`--mock`, `--source=mock|iracing`,
 * so the portable .exe can run in mock mode) wins over `OVERLAY_SOURCE` from the
 * environment (`npm run dev:mock`). Last flag wins. Default: the real sim on
 * Windows, mock elsewhere (iRacing and its SDK only exist on Windows). Main passes
 * the result to the telemetry process, so this is the only place that decides.
 */
export function resolveSource(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform
): SourceKind {
  let fromArgs: SourceKind | null = null
  for (const arg of argv) {
    if (arg === '--mock') fromArgs = 'mock'
    else if (arg.startsWith('--source=')) fromArgs = parseSourceKind(arg.slice(9)) ?? fromArgs
  }
  return fromArgs ?? parseSourceKind(env.OVERLAY_SOURCE) ?? defaultSourceKind(platform)
}
