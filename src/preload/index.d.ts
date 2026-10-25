import type { OverlayApi } from '../shared/ipc'

declare global {
  interface Window {
    overlay: OverlayApi
  }
}

export {}
