// The client. Every public call renders its wire payload at once, queues it
// and returns; one loop delivers the queue in order, one request at a time.
//
// Rules the whole file lives by, the same as the Go SDK's:
// - Never throw into the host application. Failures go to `onError`.
// - Never block. Only `flush` and `close` return something to wait for.
// - Bounded memory. A full queue drops its oldest call and says so.
// - Off is safe: no server or no key → one notice, then silent no-ops.
// - Never invent identities. User and record ids are the caller's; only
//   occurrence and increment ids are generated, and they ride every retry.
//
// Calls that stand alone (one event, one profile, one record) and are queued
// back to back share one /ingest/batch request, up to the server's 32 KB
// cap. A batch creates no relations between its items, and neither do
// separate calls, so sharing a request changes nothing but the request
// count. An event sent with records or a profile keeps a request of its own,
// because the items of one /ingest/track request are related to each other.
import { eventItems, hasIncrements, InvalidCall, profileBody, profileRecord, recordItem, type WireItem } from './payload'
import { createTransport } from './transport'
import { MixdiveError, type Id, type Mixdive, type MixdiveOptions, type Properties, type RecordUpdate, type TrackOptions, type UserProfile } from './types'

export const VERSION: string = typeof __MIXDIVE_VERSION__ === 'string' ? __MIXDIVE_VERSION__ : '0.0.0'

/** The server's request cap (docs/ingest-api.md): the same on every installation. */
export const MAX_BODY_BYTES = 32_768

const BATCH_OVERHEAD = '{"items":[]}'.length

interface Unit {
  seq: number
  what: string
  /** Where and what to send when the unit goes on its own. */
  path: string
  body: string
  /** Its JSON as a member of a batch; absent for a unit that must keep its own request. */
  member?: string
  memberBytes: number
}

interface Waiter {
  seq: number
  resolve: () => void
}

let encoder: TextEncoder | undefined
function byteLength(s: string): number {
  encoder = encoder ?? new TextEncoder()
  return encoder.encode(s).length
}

function idText(id: Id): string {
  return JSON.stringify(id)
}

export function createMixdive(options: MixdiveOptions): Mixdive {
  const o = options ?? ({} as MixdiveOptions)
  const onError = typeof o.onError === 'function' ? o.onError : (e: MixdiveError) => console.warn(e.message)

  function report(error: MixdiveError): void {
    try {
      onError(error)
    } catch (e) {
      try {
        console.warn('mixdive: the onError handler threw', e)
      } catch {
        // no console
      }
    }
  }

  const server = typeof o.server === 'string' ? o.server.trim().replace(/\/+$/, '') : ''
  const apiKey = typeof o.apiKey === 'string' ? o.apiKey.trim() : ''
  const fetchFn = typeof o.fetch === 'function' ? o.fetch : typeof fetch === 'function' ? fetch : undefined
  const off = !apiKey || !/^https?:\/\/[^/]+/i.test(server) || !fetchFn
  if (off) {
    report(
      new MixdiveError(
        fetchFn
          ? 'mixdive: off: no server URL (https://…) or API key configured; every call is a no-op'
          : 'mixdive: off: this runtime has no fetch; every call is a no-op',
      ),
    )
  }

  const transport = createTransport({
    server,
    apiKey,
    appVersion: typeof o.appVersion === 'string' ? o.appVersion.trim().slice(0, 64) : '',
    retries: typeof o.retries === 'number' && o.retries >= 0 ? Math.floor(o.retries) : 2,
    timeout: typeof o.timeout === 'number' && o.timeout > 0 ? o.timeout : 10_000,
    // Bound so a runtime that insists on `this === globalThis` is satisfied.
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => fetchFn!(input, init)) as typeof fetch,
  })
  const queueSize = typeof o.queueSize === 'number' && o.queueSize >= 1 ? Math.floor(o.queueSize) : 1024

  const queue: Unit[] = []
  let inflight: Unit[] = []
  let waiters: Waiter[] = []
  let lastSeq = 0
  let running = false
  let scheduled = false
  let closed = false

  // Everything up to this sequence number has been delivered or given up on.
  function watermark(): number {
    if (inflight.length) return inflight[0]!.seq - 1
    if (queue.length) return queue[0]!.seq - 1
    return lastSeq
  }

  function settle(): void {
    const w = watermark()
    if (!waiters.some((x) => x.seq <= w)) return
    const ready = waiters.filter((x) => x.seq <= w)
    waiters = waiters.filter((x) => x.seq > w)
    for (const x of ready) x.resolve()
  }

  async function drain(): Promise<void> {
    if (running) return
    running = true
    try {
      while (queue.length) {
        const head = queue[0]!
        let take = 1
        if (head.member !== undefined) {
          let bytes = BATCH_OVERHEAD + head.memberBytes
          while (take < queue.length) {
            const next = queue[take]!
            if (next.member === undefined || bytes + 1 + next.memberBytes > MAX_BODY_BYTES) break
            bytes += 1 + next.memberBytes
            take++
          }
        }
        inflight = queue.splice(0, take)
        const what = take === 1 ? head.what : `${take} calls (${head.what}, …)`
        const path = take === 1 ? head.path : '/ingest/batch'
        const body = take === 1 ? head.body : `{"items":[${inflight.map((u) => u.member).join(',')}]}`
        try {
          await transport.post(path, body)
        } catch (e) {
          const err = e instanceof MixdiveError ? e : new MixdiveError(String(e))
          report(new MixdiveError(`mixdive: send of ${what} failed: ${err.message.replace(/^mixdive: /, '')}`, err.status))
        }
        inflight = []
        settle()
      }
    } finally {
      running = false
      settle()
    }
  }

  function schedule(): void {
    if (scheduled || running) return
    scheduled = true
    // A tick's worth of calls is in the queue by the time this runs, so
    // calls made together leave together.
    setTimeout(() => {
      scheduled = false
      void drain()
    }, 0)
  }

  function enqueue(what: string, path: string, body: string, member?: string): void {
    if (closed) {
      report(new MixdiveError(`mixdive: client closed, dropped ${what}`))
      return
    }
    const bytes = byteLength(body)
    if (bytes > MAX_BODY_BYTES) {
      report(new MixdiveError(`mixdive: dropped ${what}: ${bytes} bytes, and the server takes at most ${MAX_BODY_BYTES} per request`))
      return
    }
    if (queue.length >= queueSize) {
      const old = queue.shift()!
      report(new MixdiveError(`mixdive: queue full, dropped the oldest call (${old.what})`))
    }
    lastSeq++
    queue.push({ seq: lastSeq, what, path, body, member, memberBytes: member === undefined ? 0 : byteLength(member) })
    settle()
    schedule()
  }

  /** Runs one public call: off → nothing; a bad call → reported and dropped; never a throw. */
  function call(name: string, fn: () => void): void {
    if (off) return
    try {
      fn()
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      report(new MixdiveError(e instanceof InvalidCall ? `mixdive: dropped a ${name} call: ${why}` : `mixdive: ${name} failed: ${why}`))
    }
  }

  function flush(): Promise<void> {
    if (off) return Promise.resolve()
    const target = lastSeq
    if (watermark() >= target) return Promise.resolve()
    return new Promise<void>((resolve) => {
      waiters.push({ seq: target, resolve })
      void drain()
    })
  }

  const warn = (message: string) => report(new MixdiveError(`mixdive: ${message}`))

  function trackNow(eventKey: string, properties: Properties | undefined, options: TrackOptions | undefined): void {
    const items = eventItems(eventKey, properties, options, warn)
    const event = items[0]!
    let what = `event "${String(event.event)}"`
    if (items.length === 1) {
      const { event: k, ...rest } = event
      enqueue(what, '/ingest/event', JSON.stringify({ event_key: k, ...rest }), JSON.stringify(event))
      return
    }
    what += ` (+${items.length - 1} more)`
    enqueue(what, '/ingest/track', JSON.stringify({ items }))
  }

  function record(what: string, item: WireItem): void {
    const json = JSON.stringify(item)
    enqueue(what, '/ingest/entity', json, json)
  }

  return {
    track: (eventKey, properties, options) => call('track', () => trackNow(eventKey, properties, options)),
    pageView: (url, properties, options) =>
      call('pageView', () => {
        const props: Properties = { ...(properties ?? {}) }
        if (typeof url === 'string' && url) props.url = url
        trackNow('page_view', props, options)
      }),
    login: (userId, method, options) =>
      call('login', () => trackNow('login', method ? { method } : undefined, { ...options, user: userId })),
    signUp: (userId, method, options) =>
      call('signUp', () => trackNow('sign_up', method ? { method } : undefined, { ...options, user: userId })),
    setUser: (userId: Id, profile: UserProfile) =>
      call('setUser', () => {
        const what = `user ${idText(userId)}`
        if (hasIncrements(profile)) {
          // Increments only exist on the record shape, which /ingest/entity
          // routes to the same profile write path.
          record(what, profileRecord(userId, profile))
          return
        }
        enqueue(what, '/ingest/user', JSON.stringify(profileBody(userId, profile)), JSON.stringify(profileRecord(userId, profile)))
      }),
    setRecord: (model: string, id: Id, update?: RecordUpdate) =>
      call('setRecord', () => {
        const item = recordItem(model, id, update)
        record(`record "${String(item.model)}"/${idText(id)}`, item)
      }),
    flush,
    close() {
      closed = true
      return flush()
    },
    get version() {
      return VERSION
    },
  }
}
