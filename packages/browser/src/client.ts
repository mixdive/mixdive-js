// The client. One instance owns the visitor identity (device id), the
// session, the signed-in user, the auto page views and the session_end
// beacon, and turns every public call into one POST to the Mixdive ingest
// API — exactly the fields docs/ingest-api.md (server repository) defines,
// nothing invented.
//
// Rules the whole file lives by:
// - Never throw into the host page. Every public call is wrapped.
// - Never block. Sends are beacons or keepalive fetches, fire-and-forget.
// - Never invent identities. Device and session ids are random, minted here;
//   user ids are the caller's. The server generates neither.
// - Off is safe: no key, no server, or an automated browser → every call is a
//   silent no-op (one console notice for a misconfiguration, none for bots).
import { generateId } from './ids'
import { IDLE_MS, contextOf, landingAcquisition, nextSession, parseSession, type Acquisition, type Session } from './session'
import { createStorage } from './storage'
import { createTransport, type Debug } from './transport'
import type { InitOptions, Mixdive, Properties, TrackOptions, UserProfile } from './types'

export const VERSION: string = typeof __MIXDIVE_VERSION__ === 'string' ? __MIXDIVE_VERSION__ : '0.0.0'

/** localStorage keys — name them in your storage declarations (docs: consent). */
export const STORAGE_KEYS = { device: 'mx_did', session: 'mx_ses', user: 'mx_uid' } as const

const MAX_BUFFER = 200
const MAX_COUNT = 1_000_000
const PROFILE_STRINGS = ['name', 'username', 'email', 'organization', 'phone', 'picture', 'gender'] as const

interface Settings {
  key: string
  server: string
  autoPageViews: boolean
  appVersion: string
  debug: boolean
}

export function createMixdive(): Mixdive {
  const storage = createStorage()
  let settings: Settings | null = null
  let off = false
  let buffer: Array<() => void> = []
  let landing: Acquisition = { ref: '', us: '', um: '', uc: '' }
  let memSession: Session | null = null
  let deviceId: string | null = null
  let userId: string | null = null
  let prevPath: string | null = null

  const debug: Debug = (message, ...rest) => {
    if (settings && settings.debug) {
      try {
        console.log('[mixdive]', message, ...rest)
      } catch {
        // no console
      }
    }
  }
  const transport = createTransport(debug)

  const hasDom = () => typeof window !== 'undefined' && typeof document !== 'undefined'

  // ---- identity -----------------------------------------------------------

  function device(): string {
    if (deviceId) return deviceId
    let id = storage.get(STORAGE_KEYS.device)
    if (!id) {
      id = generateId()
      storage.set(STORAGE_KEYS.device, id)
    }
    deviceId = id
    return id
  }

  function readSession(): Session | null {
    return memSession ?? parseSession(storage.get(STORAGE_KEYS.session))
  }

  function writeSession(s: Session): void {
    memSession = s
    storage.set(STORAGE_KEYS.session, JSON.stringify(s))
  }

  /** The session this moment belongs to — renewed when idle or on a new campaign. */
  function session(now: number): Session {
    const s = nextSession(readSession(), landing, now, generateId)
    writeSession(s)
    return s
  }

  function context(s: Acquisition) {
    const env: { language?: string; width?: number; height?: number; density?: number } = {}
    try {
      if (navigator.language) env.language = navigator.language
    } catch {
      // no navigator
    }
    try {
      env.width = screen.width
      env.height = screen.height
    } catch {
      // no screen
    }
    try {
      if (window.devicePixelRatio) env.density = window.devicePixelRatio
    } catch {
      // no window
    }
    return contextOf(s, env)
  }

  // ---- delivery -----------------------------------------------------------

  /**
   * One POST. `beacon` forces the header-free transport even when an app
   * version is configured — session_end must be able to leave during unload,
   * and a header variant has no reliable beacon equivalent.
   */
  function post(path: string, payload: Record<string, unknown>, beacon = false): void {
    const st = settings!
    const body = JSON.stringify(payload)
    if (st.appVersion && !beacon) {
      transport.send(st.server + path, body, { 'X-Api-Key': st.key, 'X-App-Version': st.appVersion })
    } else {
      transport.send(st.server + path + '?api_key=' + encodeURIComponent(st.key), body)
    }
    debug('sent', path, payload)
  }

  /** The gate every public call passes: off → drop; not started → buffer; else run, contained. */
  function run(fn: () => void): void {
    if (off) return
    if (!settings) {
      if (buffer.length >= MAX_BUFFER) buffer.shift()
      buffer.push(fn)
      return
    }
    try {
      fn()
    } catch (e) {
      debug('call failed', e)
    }
  }

  // ---- items --------------------------------------------------------------

  function trackNow(eventKey: string, properties?: Properties, options?: TrackOptions): void {
    if (typeof eventKey !== 'string' || !eventKey.trim() || eventKey.indexOf('gtm.') === 0) {
      debug('ignored event key', eventKey)
      return
    }
    const s = session(Date.now())
    const payload: Record<string, unknown> = {
      event_key: eventKey,
      device_id: device(),
      session_id: s.id,
      context: context(s),
    }
    if (userId) payload.user_id = userId
    if (properties && typeof properties === 'object') payload.properties = properties
    if (options && typeof options === 'object') {
      if (typeof options.id === 'string' && options.id) payload.id = options.id
      const { count, sum, duration } = options
      if (typeof count === 'number' && Number.isInteger(count) && count > 1 && count <= MAX_COUNT) {
        payload.count = count
      } else if (count !== undefined && count !== 1) {
        debug('ignored count (whole number 2…1000000)', count)
      }
      if (typeof sum === 'number' && Number.isFinite(sum) && sum !== 0) payload.sum = sum
      if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) payload.duration = duration
    }
    post('/ingest/event', payload)
  }

  function pageViewNow(url?: string): void {
    let path = typeof url === 'string' && url ? url : ''
    if (!path) {
      try {
        path = location.pathname || '/'
      } catch {
        path = '/'
      }
    }
    if (path === prevPath) return // router replay — one view, not two
    const props: Properties = { url: path }
    try {
      if (document.title) props.title = String(document.title).slice(0, 256)
    } catch {
      // no document
    }
    let ref = prevPath
    if (!ref) {
      try {
        if (document.referrer) ref = document.referrer.split('?')[0]!.slice(0, 256)
      } catch {
        // no document
      }
    }
    if (ref) props.referrer = ref
    prevPath = path
    trackNow('page_view', props)
  }

  function profilePayload(id: string, profile?: UserProfile): Record<string, unknown> {
    const p: Record<string, unknown> = { user_id: id, device_id: device() }
    if (profile && typeof profile === 'object') {
      for (const k of PROFILE_STRINGS) {
        const v = profile[k]
        if (typeof v === 'string' && v) p[k] = v
      }
      const y = profile.birthYear
      if (typeof y === 'number' && Number.isInteger(y) && y > 0) p.birth_year = y
      if (profile.custom && typeof profile.custom === 'object') p.custom = profile.custom
    }
    return p
  }

  function identifyNow(id: string, profile?: UserProfile): void {
    if (typeof id !== 'string' || !id.trim()) {
      debug('ignored user id', id)
      return
    }
    userId = id
    storage.set(STORAGE_KEYS.user, id)
    post('/ingest/user', profilePayload(id, profile))
  }

  // ---- session lifecycle --------------------------------------------------

  function endSession(): void {
    try {
      const s = readSession()
      if (!s) return
      const now = Date.now()
      const end = now - s.last > IDLE_MS ? s.last : now // never bill idle time
      const duration = Math.max(0, Math.round((end - s.start) / 1000))
      post(
        '/ingest/event',
        {
          event_key: 'session_end',
          id: s.id + ':end', // deterministic: repeated beacons collapse server-side, $max widens
          device_id: device(),
          session_id: s.id,
          context: context(s),
          properties: { duration },
        },
        true,
      )
    } catch (e) {
      debug('session_end failed', e)
    }
  }

  function warmSession(): void {
    const s = readSession()
    if (s) {
      s.last = Date.now()
      writeSession(s)
    }
  }

  function installListeners(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') endSession()
      else warmSession() // returning to a background tab keeps its session warm
    })
    window.addEventListener('pagehide', endSession)
  }

  function installHistoryHooks(): void {
    const h = window.history
    // After the URL changed, on the next tick — so a router that sets
    // document.title synchronously after navigating is already done.
    const schedule = () => {
      setTimeout(() => run(() => pageViewNow()), 0)
    }
    for (const m of ['pushState', 'replaceState'] as const) {
      const orig = h[m]
      if (typeof orig !== 'function') continue
      h[m] = function (this: History, ...args: Parameters<History['pushState']>) {
        const r = orig.apply(this, args)
        schedule()
        return r
      }
    }
    window.addEventListener('popstate', schedule)
  }

  // ---- public -------------------------------------------------------------

  function init(options: InitOptions): void {
    if (!hasDom()) return // server-side rendering: nothing to start
    if (settings) {
      debug('init called again; the first call wins')
      return
    }
    const key = options && typeof options.key === 'string' ? options.key.trim() : ''
    const server = options && typeof options.server === 'string' ? options.server.trim().replace(/\/+$/, '') : ''
    if (!key || !/^https?:\/\/[^/]+/i.test(server)) {
      off = true
      buffer = []
      try {
        console.warn('[mixdive] off: init needs an API key and the server origin (https://analytics.example.com)')
      } catch {
        // no console
      }
      return
    }
    if (typeof navigator !== 'undefined' && navigator.webdriver) {
      off = true // automated browsers and test runners send nothing, by design
      buffer = []
      return
    }
    settings = {
      key,
      server,
      autoPageViews: options.autoPageViews !== false,
      appVersion: typeof options.appVersion === 'string' ? options.appVersion.slice(0, 64) : '',
      debug: !!options.debug,
    }
    landing = landingAcquisition(location, document.referrer)
    userId = storage.get(STORAGE_KEYS.user)
    installListeners()
    // Calls made before init go first — an identify buffered from app code
    // should be on the first page view.
    const pending = buffer
    buffer = []
    for (const fn of pending) run(fn)
    if (settings.autoPageViews) {
      installHistoryHooks()
      run(() => pageViewNow())
    }
    debug('started', { server, autoPageViews: settings.autoPageViews, version: VERSION })
  }

  function reset(): void {
    storage.remove(STORAGE_KEYS.device)
    storage.remove(STORAGE_KEYS.session)
    storage.remove(STORAGE_KEYS.user)
    memSession = null
    deviceId = null
    userId = null
  }

  return {
    init,
    track: (eventKey, properties, options) => run(() => trackNow(eventKey, properties, options)),
    pageView: (url) => run(() => pageViewNow(url)),
    identify: (id) => run(() => identifyNow(id)),
    setUser: (id, profile) => run(() => identifyNow(id, profile)),
    login: (method) => run(() => trackNow('login', method ? { method } : undefined)),
    signUp: (method) => run(() => trackNow('sign_up', method ? { method } : undefined)),
    reset,
    get version() {
      return VERSION
    },
  }
}
