// The HTTP layer: one JSON POST to the ingest API, repeated on the failures
// the contract calls retryable (503 and network errors, timeouts included)
// with a doubling pause. Every other answer is final. Only `fetch`,
// `AbortController` and timers are used, so the same code runs on Node and
// on the edge runtimes.
import { MixdiveError } from './types'

export interface TransportConfig {
  server: string
  apiKey: string
  appVersion: string
  retries: number
  timeout: number
  fetch: typeof fetch
}

const FIRST_PAUSE_MS = 200

class Failure {
  constructor(
    readonly error: MixdiveError,
    readonly retry: boolean,
  ) {}
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function createTransport(cfg: TransportConfig) {
  async function once(path: string, body: string): Promise<void> {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : undefined
    const timer = ctrl ? setTimeout(() => ctrl.abort(), cfg.timeout) : undefined
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Api-Key': cfg.apiKey }
      if (cfg.appVersion) headers['X-App-Version'] = cfg.appVersion
      let res: Response
      try {
        res = await cfg.fetch(cfg.server + path, { method: 'POST', headers, body, signal: ctrl?.signal })
      } catch (e) {
        const timedOut = !!ctrl && ctrl.signal.aborted
        const why = timedOut ? `no answer within ${cfg.timeout} ms` : e instanceof Error ? e.message : String(e)
        throw new Failure(new MixdiveError(`mixdive: ${path} failed: ${why}`), true)
      }
      let text = ''
      try {
        text = await res.text()
      } catch {
        // the status is what matters
      }
      if (res.ok) return
      let message = ''
      try {
        const parsed = JSON.parse(text) as { error?: unknown }
        if (typeof parsed.error === 'string') message = parsed.error
      } catch {
        message = text.slice(0, 200)
      }
      const error = new MixdiveError(`mixdive: ${path} answered ${res.status}${message ? `: ${message}` : ''}`, res.status)
      throw new Failure(error, res.status === 503)
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }

  /** Resolves when the server accepted the body; rejects with a MixdiveError once retrying is over. */
  async function post(path: string, body: string): Promise<void> {
    let pause = FIRST_PAUSE_MS
    for (let attempt = 0; ; attempt++) {
      try {
        await once(path, body)
        return
      } catch (e) {
        if (!(e instanceof Failure)) throw e
        if (!e.retry || attempt >= cfg.retries) throw e.error
      }
      await sleep(pause)
      pause *= 2
    }
  }

  return { post }
}
