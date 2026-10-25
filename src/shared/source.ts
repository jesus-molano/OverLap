/** Telemetry source names, as given on the command line or in OVERLAY_SOURCE. Pure. */
import type { SourceKind } from './types'

/** 'mock' | 'iracing' in any case and with surrounding spaces; null for anything else. */
export function parseSourceKind(value: string | null | undefined): SourceKind | null {
  const v = value?.trim().toLowerCase()
  return v === 'mock' || v === 'iracing' ? v : null
}

/** iRacing and its SDK only exist on Windows: elsewhere the mock is the only useful source. */
export function defaultSourceKind(platform: string): SourceKind {
  return platform === 'win32' ? 'iracing' : 'mock'
}
