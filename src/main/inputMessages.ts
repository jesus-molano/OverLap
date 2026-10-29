/** Shape checks of what the input process sends (its port is a process boundary). Pure. */
import {
  MAX_BUTTON,
  cleanControllerName,
  fallbackControllerName,
  isControllerId,
  type ControllerInfo
} from '@shared/controllers'
import type { InputOutMessage } from '@shared/ipc'

/** More connected controllers than anyone has: the rest of a list is dropped. */
export const MAX_CONTROLLERS = 64
const MAX_TEXT = 500
const LOG_LEVELS = ['info', 'warn', 'error'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isButton(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_BUTTON
}

function parseController(raw: unknown): ControllerInfo | null {
  if (!isRecord(raw) || !isControllerId(raw.id)) return null
  const buttons =
    typeof raw.buttons === 'number' && Number.isInteger(raw.buttons) && raw.buttons >= 0
      ? Math.min(raw.buttons, MAX_BUTTON)
      : 0
  return {
    id: raw.id,
    name: cleanControllerName(raw.name) ?? fallbackControllerName(raw.id),
    buttons
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : null
}

/** Null for anything that is not a valid message. */
export function parseInputMessage(raw: unknown): InputOutMessage | null {
  if (!isRecord(raw)) return null
  switch (raw.type) {
    case 'press':
      return isControllerId(raw.device) && isButton(raw.button)
        ? { type: 'press', device: raw.device, button: raw.button }
        : null
    case 'devices': {
      if (!Array.isArray(raw.list)) return null
      const list: ControllerInfo[] = []
      for (const entry of raw.list.slice(0, MAX_CONTROLLERS)) {
        const c = parseController(entry)
        if (c) list.push(c)
      }
      return { type: 'devices', list }
    }
    case 'unavailable': {
      const detail = text(raw.detail)
      return detail === null ? null : { type: 'unavailable', detail }
    }
    case 'log': {
      const message = text(raw.message)
      const level = LOG_LEVELS.find((l) => l === raw.level)
      return message === null || level === undefined ? null : { type: 'log', level, message }
    }
    default:
      return null
  }
}
