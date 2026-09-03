// Delivery. Two shapes, both fire-and-forget:
//
// - beacon: `navigator.sendBeacon` with a text/plain body and the API key in
//   the query string — preflight-free, and queued by the browser so it
//   survives navigation and unload. `fetch(keepalive)` is the fallback.
// - headers: a JSON fetch with `X-Api-Key` (and `X-App-Version`), used only
//   when the caller configured an app version — headers cost a CORS
//   preflight, which the server answers.
//
// Failures never reach the caller: analytics must not break the host page.
export type Debug = (message: string, ...rest: unknown[]) => void

export interface Transport {
  send(url: string, body: string, headers?: Record<string, string>): void
}

export function createTransport(debug: Debug): Transport {
  return {
    send(url, body, headers) {
      if (!headers) {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined
        if (nav && typeof nav.sendBeacon === 'function') {
          try {
            if (nav.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return
          } catch {
            // beacon refused (size, scheme) — fall through to fetch
          }
        }
      }
      if (typeof fetch !== 'function') {
        debug('no fetch available; dropped', url)
        return
      }
      try {
        const init: RequestInit = { method: 'POST', body, keepalive: true }
        if (headers) init.headers = { 'Content-Type': 'application/json', ...headers }
        const p = fetch(url, init)
        if (p && typeof p.then === 'function') {
          p.then(
            (r) => {
              if (!r.ok) debug(`${r.status} from ${url}`)
            },
            (e: unknown) => debug('send failed', e),
          )
        }
      } catch (e) {
        debug('send failed', e)
      }
    },
  }
}
