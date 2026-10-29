/**
 * Input utility process entry (forked by main/inputHost.ts with utilityProcess.fork, only
 * while some shortcut is a controller's button or the shortcuts page records one). Reads the
 * controllers' buttons passively (rawInput.ts) and tells main which controllers are connected
 * and when a button goes down. Its own process: a direct drive base sends up to 1000 reports
 * a second while driving, and Chromium's gamepad code in main uses the same Raw Input
 * registration.
 */
import type { ParentPort } from 'electron'
import type { InputOutMessage } from '@shared/ipc'
import { ButtonReader, type ControllerSource } from './buttons'

// stdout/stderr are pipes to main: if main goes away, writes fail with EPIPE.
process.stdout.on('error', () => {})
process.stderr.on('error', () => {})

function message(err: unknown): string {
  try {
    return err instanceof Error ? err.message : String(err)
  } catch {
    return 'unknown error'
  }
}

async function openSource(): Promise<ControllerSource> {
  if (process.platform !== 'win32') throw new Error('controllers are only read on Windows')
  const { openRawInput } = await import('./rawInput')
  return openRawInput()
}

function run(port: ParentPort): void {
  const emit = (msg: InputOutMessage): void => {
    try {
      port.postMessage(msg)
    } catch {
      // Main is gone: it kills this process anyway.
    }
  }
  let reader: ButtonReader | null = null
  let exiting = false
  const exit = (code: number): void => {
    if (exiting) return
    exiting = true
    try {
      reader?.stop()
    } catch {
      // Exiting anyway.
    }
    process.exit(code)
  }

  process.on('uncaughtException', (err) => {
    emit({ type: 'log', level: 'error', message: `Input process crashed: ${message(err)}` })
    setTimeout(() => exit(1), 50)
  })

  port.on('message', (event) => {
    const data: unknown = event.data
    if (
      typeof data === 'object' &&
      data !== null &&
      (data as { type?: unknown }).type === 'shutdown'
    ) {
      exit(0)
    }
  })

  void openSource().then(
    (source) => {
      if (exiting) {
        source.close()
        return
      }
      reader = new ButtonReader({
        source,
        onPress: (device, button, first) => emit({ type: 'press', device, button, first }),
        onDevices: (list) => emit({ type: 'devices', list }),
        onError: (err) => {
          emit({
            type: 'log',
            level: 'error',
            message: `Reading controllers failed: ${message(err)}`
          })
          exit(1)
        }
      })
      reader.start()
    },
    (err: unknown) => {
      // Not an error to restart from: main shows the button shortcuts as not working.
      emit({ type: 'unavailable', detail: message(err) })
    }
  )
}

// Null in other Electron processes, undefined under plain Node.
const parentPort = process.parentPort as ParentPort | null | undefined
if (parentPort) {
  run(parentPort)
} else {
  console.error('[input] Must be started with Electron utilityProcess.fork().')
  process.exit(1)
}
