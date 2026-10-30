/**
 * «Exportar todo / Importar todo» (R40): one file with every setting (Apariencia, the shortcuts,
 * every saved layout with its options, the visibility rules...) and the personal bests. Read back
 * through normalizeSettings, so a file from an older or newer version loads as any settings
 * file does; the bests go to the telemetry process, which merges them (a faster lap wins, none is
 * lost). Pure.
 */
import {
  SETTINGS_VERSION,
  defaultLayoutOffsetX,
  normalizeSettings,
  placeDefaultLayout
} from './settings'
import type { OverlaySettings, Rect } from './types'

export const BACKUP_FORMAT = 'overlap-backup'
export const BACKUP_VERSION = 1
export const BACKUP_EXTENSION = 'json'
/** Settings are small; the bests carry a timing profile each (500 at most). */
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  /** The app that wrote it ('2.2.0'), for the record. */
  app: string
  /** ISO date and time it was written. */
  createdAt: string
  settings: OverlaySettings
  /** The personal-bests file as it was on disk (its own format), null when there was none. */
  personalBests: unknown
}

/** The file's text: `bests` is the personal-bests file's text (null: none or unreadable). */
export function backupText(
  settings: OverlaySettings,
  bests: string | null,
  app: string,
  now: Date
): string {
  let personalBests: unknown = null
  if (bests !== null) {
    try {
      personalBests = JSON.parse(bests.charCodeAt(0) === 0xfeff ? bests.slice(1) : bests)
    } catch {
      personalBests = null
    }
  }
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app,
    createdAt: now.toISOString(),
    settings,
    personalBests
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

/** 'OverLap-2026-10-30.json': the date the copy was made, local time. */
export function backupFileName(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `OverLap-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.${BACKUP_EXTENSION}`
}

export type BackupError = 'json' | 'format' | 'version' | 'too-big' | 'read'

export type BackupRead =
  | {
      ok: true
      settings: OverlaySettings
      /** The bests as a personal-bests file's text for the telemetry process; null for none. */
      bests: string | null
      createdAt: string
    }
  | { ok: false; error: BackupError }

/**
 * A backup's text, validated: its settings normalised (nothing it holds is trusted as it is),
 * its bests passed on as text. A file of a newer version than this one is refused: its meaning
 * may have changed.
 */
export function parseBackup(text: string): BackupRead {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'too-big' }
  let root: unknown
  try {
    root = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return { ok: false, error: 'json' }
  }
  if (typeof root !== 'object' || root === null || Array.isArray(root)) {
    return { ok: false, error: 'format' }
  }
  const r = root as Record<string, unknown>
  if (r.format !== BACKUP_FORMAT || typeof r.settings !== 'object' || r.settings === null) {
    return { ok: false, error: 'format' }
  }
  if (typeof r.version !== 'number' || !Number.isInteger(r.version) || r.version < 1) {
    return { ok: false, error: 'format' }
  }
  if (r.version > BACKUP_VERSION) return { ok: false, error: 'version' }
  const settings = normalizeSettings(r.settings)
  const bests =
    typeof r.personalBests === 'object' && r.personalBests !== null
      ? JSON.stringify(r.personalBests)
      : null
  return {
    ok: true,
    settings,
    bests,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt.slice(0, 40) : ''
  }
}

/**
 * «Restablecer todo» (R40): every setting as on a new install (one layout, the default shortcuts,
 * the default look and rules), in the language in use; no welcome. The personal bests stay. The
 * widgets placed as a first run places them on `primaryArea`: centred on an ultrawide screen.
 */
export function factorySettings(
  current: Readonly<OverlaySettings>,
  primaryArea?: Rect
): OverlaySettings {
  // Through the normaliser: the one layout is named in that language, as on a first run.
  const fresh = normalizeSettings({
    version: SETTINGS_VERSION,
    appearance: { language: current.appearance.language }
  })
  if (primaryArea === undefined || defaultLayoutOffsetX(primaryArea) === 0) return fresh
  return placeDefaultLayout(fresh, primaryArea)
}

/** What an import puts in effect: the file's settings, never with the first-run welcome. */
export function importedSettings(read: Extract<BackupRead, { ok: true }>): OverlaySettings {
  const s = read.settings
  return { ...s, settingsWindow: { ...s.settingsWindow, welcome: false } }
}
