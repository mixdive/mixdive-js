// Session and acquisition logic, pure and injected so it is testable without
// a browser. The rules are the collection addendum's (docs/collection-addendum.md
// in the server repository), the same ones the reference GTM tag implements:
// 30 idle minutes end a session, a landing with a *different* utm_source
// starts a new one, and the session's acquisition rides on every item.

/** 30 minutes of inactivity end a session. */
export const IDLE_MS = 30 * 60 * 1000

export interface Acquisition {
  /** External landing referrer, query-stripped; empty when same-site or absent. */
  ref: string
  us: string
  um: string
  uc: string
}

export interface Session extends Acquisition {
  id: string
  start: number
  last: number
}

export interface Context {
  language?: string
  resolution?: string
  density?: number
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

/** What the landing page says about how the visitor arrived. */
export function landingAcquisition(loc: { host: string; search: string }, referrer: string): Acquisition {
  const a: Acquisition = { ref: '', us: '', um: '', uc: '' }
  try {
    if (referrer) {
      const m = /^[a-z]+:\/\/([^/]+)/i.exec(referrer)
      if (m && m[1]!.toLowerCase() !== loc.host.toLowerCase()) {
        a.ref = referrer.split('?')[0]!.slice(0, 256)
      }
    }
    const q = loc.search.replace(/^\?/, '').split('&')
    for (const part of q) {
      const eq = part.indexOf('=')
      const k = eq < 0 ? part : part.slice(0, eq)
      const raw = eq < 0 ? '' : part.slice(eq + 1)
      let v = ''
      try {
        v = decodeURIComponent(raw.replace(/\+/g, ' ')).slice(0, 128)
      } catch {
        v = raw.slice(0, 128)
      }
      if (k === 'utm_source') a.us = v
      if (k === 'utm_medium') a.um = v
      if (k === 'utm_campaign') a.uc = v
    }
  } catch {
    // never let acquisition parsing break a send
  }
  return a
}

/**
 * The session an item at `now` belongs to: the current one touched, or a new
 * one when there is none, when it went idle, or when this landing carries a
 * different campaign (a new campaign click never rides an old session).
 */
export function nextSession(current: Session | null, landing: Acquisition, now: number, genId: () => string): Session {
  const newUtm = !!landing.us && !!current && current.us !== landing.us
  let s = current
  if (!s || now - s.last > IDLE_MS || newUtm) {
    s = { id: genId(), start: now, last: now, ref: landing.ref, us: landing.us, um: landing.um, uc: landing.uc }
  }
  s.last = now
  return s
}

export function parseSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Partial<Session>
    if (s && typeof s.id === 'string' && typeof s.start === 'number' && typeof s.last === 'number') {
      return { id: s.id, start: s.start, last: s.last, ref: s.ref || '', us: s.us || '', um: s.um || '', uc: s.uc || '' }
    }
  } catch {
    // corrupt storage — start over
  }
  return null
}

/** The context object sent on every item: client tech plus the session's acquisition. */
export function contextOf(
  s: Acquisition,
  env: { language?: string; width?: number; height?: number; density?: number },
): Context {
  const c: Context = {}
  if (env.language) c.language = String(env.language).slice(0, 16)
  if (env.width && env.height) c.resolution = `${env.width}x${env.height}`
  if (env.density) c.density = env.density
  if (s.ref) c.referrer = s.ref
  if (s.us) c.utm_source = s.us
  if (s.um) c.utm_medium = s.um
  if (s.uc) c.utm_campaign = s.uc
  return c
}
