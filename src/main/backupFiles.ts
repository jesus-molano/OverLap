/**
 * «Exportar todo» / «Importar todo» (R40) through the system's file dialogs: the dialogs and the
 * file system are injected (tests pass doubles), as for a layout file (layoutFiles.ts). What is
 * read is validated by parseBackup; applying it is main's (index.ts).
 */
import {
  MAX_BACKUP_BYTES,
  backupFileName,
  backupText,
  parseBackup,
  type BackupRead
} from '@shared/backup'
import type { OverlaySettings } from '@shared/types'
import type { LayoutFileDeps } from './layoutFiles'

export interface BackupDeps extends LayoutFileDeps {
  /**
   * The personal bests' text (from the telemetry process's memory, else their file), null when
   * there are none or they cannot be read.
   */
  readBests(): string | null | Promise<string | null>
  /** The file name only, for the notice. */
  baseName(path: string): string
}

/** What became of an export: the file written, or why not; null when the dialog was cancelled. */
export type BackupExport = { ok: true; file: string } | { ok: false }

export async function exportBackup(
  settings: OverlaySettings,
  app: string,
  now: Date,
  deps: BackupDeps
): Promise<BackupExport | null> {
  const path = await deps.pickSavePath(backupFileName(now))
  if (path === null) return null
  try {
    deps.writeText(path, backupText(settings, await deps.readBests(), app, now))
    return { ok: true, file: deps.baseName(path) }
  } catch (err) {
    console.warn(`[backup] could not write ${path}:`, err)
    return { ok: false }
  }
}

/** The file the user chooses, read and validated; null when the dialog was cancelled. */
export async function readBackup(deps: LayoutFileDeps): Promise<BackupRead | null> {
  const path = await deps.pickOpenPath()
  if (path === null) return null
  let text: string
  try {
    if (deps.sizeOf(path) > MAX_BACKUP_BYTES) return { ok: false, error: 'too-big' }
    text = deps.readText(path)
  } catch (err) {
    console.warn(`[backup] could not read ${path}:`, err)
    return { ok: false, error: 'read' }
  }
  return parseBackup(text)
}
