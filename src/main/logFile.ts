import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { format } from 'node:util'

/** Past this size at startup the log moves to `<name>.old.log` and a new one starts. */
const MAX_BYTES = 1024 * 1024

const LEVELS = ['log', 'info', 'warn', 'error'] as const

/**
 * Copies the main process's console (and the telemetry process's, which main echoes) to a file
 * next to settings.json, so a fault in a session started from the desktop, where there is no
 * console, can still be read afterwards. One file per run, the previous run's kept as .old.log
 * once it grows past MAX_BYTES. Writing it never throws: a log that cannot be written is
 * skipped.
 */
export function installLogFile(file: string): void {
  try {
    mkdirSync(dirname(file), { recursive: true })
    const size = statSync(file, { throwIfNoEntry: false })?.size ?? 0
    if (size > MAX_BYTES) rotate(file)
  } catch {
    // No folder or no rotation: the appends below simply fail quietly too.
  }
  append(file, `---- ${new Date().toISOString()} start (pid ${process.pid})`)
  for (const level of LEVELS) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]): void => {
      append(file, `${new Date().toISOString()} ${level} ${format(...args)}`)
      try {
        original(...args)
      } catch {
        // No console (started from the desktop) or a closed pipe: the file has it.
      }
    }
  }
}

function rotate(file: string): void {
  const old = file.replace(/\.log$/, '.old.log')
  rmSync(old, { force: true })
  renameSync(file, old)
}

function append(file: string, line: string): void {
  try {
    appendFileSync(file, line + '\n', 'utf8')
  } catch {
    // Locked or read-only: losing a log line must never take the app down.
  }
}
