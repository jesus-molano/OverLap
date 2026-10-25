import http from 'node:http'

/** Local HTTP endpoint the iRacing service exposes while the sim is running. */
export const SIM_STATUS_URL = 'http://127.0.0.1:32034/get_sim_status?object=simStatus'

const MAX_BODY_BYTES = 64 * 1024

/**
 * Quiet replacement for `IRacingSDK.IsSimRunning()`, which logs every failure.
 * Resolves true when the sim reports `running:1`, false on any error or timeout.
 */
export function isSimRunning(opts: { url?: string; timeoutMs?: number } = {}): Promise<boolean> {
  const { url = SIM_STATUS_URL, timeoutMs = 1000 } = opts
  return new Promise((resolve) => {
    let settled = false
    let req: http.ClientRequest | null = null
    const finish = (running: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      req?.destroy()
      resolve(running)
    }
    // Whole-request deadline (the `timeout` option only covers socket idleness).
    const timer = setTimeout(() => finish(false), timeoutMs)
    try {
      req = http.get(url, { agent: false }, (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
          if (body.length > MAX_BODY_BYTES) finish(false)
        })
        res.on('end', () => finish(body.includes('running:1')))
        res.on('error', () => finish(false))
      })
      req.on('error', () => finish(false))
    } catch {
      finish(false)
    }
  })
}
