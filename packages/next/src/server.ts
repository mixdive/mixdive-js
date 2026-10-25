// @mixdive/next/server — Mixdive for Next.js, the server half: events,
// profiles and records from Server Actions, Route Handlers, Server
// Components and middleware.
//
//   import { mixdive } from '@mixdive/next/server'
//   mixdive.track('order_completed', { plan }, { user: session.userId, sum: total })
//
// `mixdive` is created on first use from MIXDIVE_SERVER (or
// NEXT_PUBLIC_MIXDIVE_SERVER) and MIXDIVE_API_KEY. Calls return at once,
// and each one asks Next.js to finish delivering after the response has been
// sent (`after`, Next.js 15.1 and later), so a serverless function is not
// frozen with the event still queued and the visitor never waits for it.
// Where `after` is unavailable (older versions, the Pages Router, scripts)
// the client sends on its own while the process runs; `await mixdive.flush()`
// before responding when the process may stop right after.

// With the extension: where Next.js does not bundle this file (Pages Router
// API routes load packages with Node's own ESM resolver) `next/server` alone
// does not resolve, because the next package declares no exports map.
import * as nextServer from 'next/server.js'
import { createMixdive as createNodeClient, type Mixdive, type MixdiveOptions } from '@mixdive/node'

type After = (task: () => unknown) => void

function afterFn(): After | undefined {
  const s = nextServer as { after?: After; unstable_after?: After }
  return typeof s.after === 'function' ? s.after : typeof s.unstable_after === 'function' ? s.unstable_after : undefined
}

function serverEnv(): Partial<MixdiveOptions> {
  try {
    return {
      server: process.env.MIXDIVE_SERVER || process.env.NEXT_PUBLIC_MIXDIVE_SERVER,
      apiKey: process.env.MIXDIVE_API_KEY,
      appVersion: process.env.MIXDIVE_APP_VERSION,
    }
  } catch {
    return {}
  }
}

/** Wraps a client so every call also schedules a flush for after the response. */
function withAfter(client: () => Mixdive): Mixdive {
  const later = () => {
    const after = afterFn()
    if (!after) return
    try {
      after(() => client().flush())
    } catch {
      // Outside a request (a script, the build): the client sends on its own.
    }
  }
  return {
    track: (...a) => (client().track(...a), later()),
    pageView: (...a) => (client().pageView(...a), later()),
    login: (...a) => (client().login(...a), later()),
    signUp: (...a) => (client().signUp(...a), later()),
    setUser: (...a) => (client().setUser(...a), later()),
    setRecord: (...a) => (client().setRecord(...a), later()),
    flush: () => client().flush(),
    close: () => client().close(),
    get version() {
      return client().version
    },
  }
}

/**
 * A client of your own, for a second server or settings the environment does
 * not carry. Options you leave out come from the environment variables. Keep
 * the result in a module-level constant: one client per process.
 */
export function createMixdive(options: Partial<MixdiveOptions> = {}): Mixdive {
  let client: Mixdive | undefined
  return withAfter(() => {
    if (!client) {
      const env = serverEnv()
      const inBrowser = typeof window !== 'undefined'
      client = createNodeClient({
        ...options,
        server: inBrowser ? '' : (options.server ?? env.server ?? ''),
        apiKey: inBrowser ? '' : (options.apiKey ?? env.apiKey ?? ''),
        appVersion: options.appVersion ?? env.appVersion,
        onError:
          options.onError ??
          ((e) =>
            console.warn(
              inBrowser ? 'mixdive: @mixdive/next/server is for server code; in the browser use useMixdive() from @mixdive/next' : e.message,
            )),
      })
    }
    return client
  })
}

/** The shared server client, configured from the environment on first use. */
export const mixdive: Mixdive = createMixdive()

export { MixdiveError } from '@mixdive/node'
export type { Id, MixdiveOptions, Properties, PropertyValue, RecordLink, RecordRef, RecordUpdate, RelatedUser, TrackOptions, UserProfile } from '@mixdive/node'
export type { Mixdive }
