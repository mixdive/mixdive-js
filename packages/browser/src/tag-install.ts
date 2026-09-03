// The script-tag shape of the SDK. `mixdive.js` runs this once on load:
//
//   <script defer src="https://analytics.example.com/js/mixdive.js" data-key="mx_…"></script>
//
// - `data-key` starts the client; the server defaults to the origin the
//   script was loaded from (a Mixdive server serves its own tag), and
//   `data-server`, `data-auto-page-views="false"`, `data-app-version`,
//   `data-debug="true"` override the rest.
// - `window.mixdive` becomes a callable *and* an object, so both
//   `mixdive('track', 'x', {...})` and `mixdive.track('x', {...})` work.
// - A stub queue installed before the script arrives is drained in order —
//   the gtag pattern — so page code and tag managers never wait for the load:
//
//   <script>window.mixdive=window.mixdive||function(){(mixdive.q=mixdive.q||[]).push(arguments)};</script>
import { createMixdive } from './client'
import type { Mixdive } from './types'

const METHODS = ['init', 'track', 'pageView', 'identify', 'setUser', 'login', 'signUp', 'reset'] as const
type Method = (typeof METHODS)[number]

type Stub = { q?: ArrayLike<unknown>; loaded?: boolean }
export type TagGlobal = ((method: Method, ...args: unknown[]) => void) & Mixdive & { q: { push(entry: ArrayLike<unknown>): void }; loaded: true }

export function installTag(w: Window & { mixdive?: unknown }, script: HTMLScriptElement | null): Mixdive | null {
  const existing = w.mixdive as Stub | undefined
  if (existing && existing.loaded) return null // loaded twice — the first one keeps running

  const client = createMixdive()
  const call = (method: unknown, args: unknown[]): void => {
    if (typeof method === 'string' && (METHODS as readonly string[]).indexOf(method) >= 0) {
      ;(client as unknown as Record<Method, (...a: unknown[]) => void>)[method as Method](...args)
    }
  }
  const drain = (entry: unknown): void => {
    try {
      const a = Array.prototype.slice.call(entry as ArrayLike<unknown>) as unknown[]
      call(a[0], a.slice(1))
    } catch {
      // a malformed queue entry must not stop the rest
    }
  }

  const g = function (method: Method, ...args: unknown[]) {
    call(method, args)
  } as TagGlobal
  for (const m of METHODS) {
    ;(g as unknown as Record<Method, (...a: unknown[]) => void>)[m] = (...args: unknown[]) => call(m, args)
  }
  Object.defineProperty(g, 'version', { get: () => client.version })
  g.loaded = true
  g.q = { push: drain } // late pushes still arrive
  w.mixdive = g

  // Queued calls first: an `identify` the page pushed before the tag loaded
  // belongs on the first page view.
  const queued = existing && existing.q && typeof existing.q.length === 'number' ? (Array.prototype.slice.call(existing.q) as unknown[]) : []
  for (const entry of queued) drain(entry)

  if (script) {
    const ds = script.dataset
    const key = ds.key || ''
    let server = ds.server || ''
    if (!server) {
      try {
        server = new URL(script.src, w.location.href).origin
      } catch {
        // no src (inline) — init will report the missing server
      }
    }
    if (key) {
      client.init({
        key,
        server,
        autoPageViews: ds.autoPageViews !== 'false',
        appVersion: ds.appVersion || undefined,
        debug: ds.debug === 'true',
      })
    }
  }
  return client
}
