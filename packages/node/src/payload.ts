// Rendering calls into wire items: exactly the fields docs/ingest-api.md
// (server repository) defines, nothing invented. Everything here runs at call
// time, so a bad call fails before anything is queued and a later change to
// the caller's objects never changes what was sent.
import { newId } from './ids'
import type { Id, Properties, RecordLink, RecordRef, RecordUpdate, RelatedUser, TrackOptions, UserProfile } from './types'

export type WireItem = Record<string, unknown>

/** A call that cannot be sent. The client reports it and drops the call. */
export class InvalidCall extends Error {}

const MAX_COUNT = 1_000_000
const PROFILE_STRINGS = ['name', 'username', 'email', 'organization', 'phone', 'picture', 'gender'] as const

export function isId(v: unknown): v is Id {
  return (typeof v === 'string' && v.trim() !== '') || (typeof v === 'number' && Number.isFinite(v))
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function key(v: unknown, what: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new InvalidCall(`${what} is required`)
  return v.trim()
}

function users(list: RelatedUser[] | undefined): Array<{ id: Id; role?: string }> | undefined {
  if (!Array.isArray(list)) return undefined
  const out: Array<{ id: Id; role?: string }> = []
  for (const u of list) {
    if (!u || !isId(u.id)) continue
    const entry: { id: Id; role?: string } = { id: u.id }
    if (typeof u.role === 'string' && u.role.trim()) entry.role = u.role.trim()
    out.push(entry)
  }
  return out.length ? out : undefined
}

function links(list: RecordLink[] | undefined): Array<{ model: string; id: Id }> | undefined {
  if (!Array.isArray(list)) return undefined
  const out: Array<{ model: string; id: Id }> = []
  for (const l of list) {
    if (l && typeof l.model === 'string' && l.model.trim() && isId(l.id)) out.push({ model: l.model.trim(), id: l.id })
  }
  return out.length ? out : undefined
}

function increments(inc: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!isObject(inc)) return undefined
  const out: Record<string, number> = {}
  let any = false
  for (const k of Object.keys(inc)) {
    const v = inc[k]
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v
      any = true
    }
  }
  return any ? out : undefined
}

/** Data and increments onto a record item; an increment gets the id the server applies it once on. */
function fillRecord(item: WireItem, data: Properties | undefined, inc: Record<string, number> | undefined): void {
  if (isObject(data)) item.data = data
  const add = increments(inc)
  if (add) {
    item.data_inc = add
    item.inc_id = newId()
  }
}

function timestamp(t: TrackOptions['timestamp'], warn: (message: string) => void): string | undefined {
  if (t === undefined || t === null || t === '') return undefined
  let d: Date | null = null
  if (t instanceof Date) d = t
  else if (typeof t === 'number') d = new Date(t)
  else if (typeof t === 'string') return t.trim()
  if (d && !Number.isNaN(d.getTime())) return d.toISOString()
  warn('ignored an invalid timestamp; the server will use its receive time')
  return undefined
}

function profileFields(profile: UserProfile | undefined): WireItem {
  const p: WireItem = {}
  if (!isObject(profile)) return p
  for (const k of PROFILE_STRINGS) {
    const v = profile[k]
    if (typeof v === 'string' && v) p[k] = v
  }
  const y = profile.birthYear
  if (typeof y === 'number' && Number.isInteger(y) && y > 0) p.birth_year = y
  return p
}

/** The flat `/ingest/user` shape. */
export function profileBody(userId: unknown, profile: UserProfile | undefined): WireItem {
  if (!isId(userId)) throw new InvalidCall('a user id is required')
  const p: WireItem = { user_id: userId, ...profileFields(profile) }
  if (profile && isObject(profile.custom)) p.custom = profile.custom
  return p
}

/** The same profile as a `model: "user"` record, the shape that can carry increments and travel with other items. */
export function profileRecord(userId: unknown, profile: UserProfile | undefined): WireItem {
  if (!isId(userId)) throw new InvalidCall('a user id is required')
  const item: WireItem = { model: 'user', id: userId }
  const data: WireItem = { ...(profile && isObject(profile.custom) ? profile.custom : {}), ...profileFields(profile) }
  fillRecord(item, Object.keys(data).length ? (data as Properties) : undefined, profile?.increment)
  return item
}

export function hasIncrements(profile: UserProfile | undefined): boolean {
  return !!profile && increments(profile.increment) !== undefined
}

export function recordItem(model: unknown, id: unknown, update: RecordUpdate | undefined): WireItem {
  const m = key(model, 'a model key')
  if (m === 'user') throw new InvalidCall('records of the built-in user model are profiles: use setUser')
  if (!isId(id)) throw new InvalidCall(`a record id is required for model "${m}"`)
  const item: WireItem = { model: m, id }
  const u = update ?? {}
  if (isId(u.user)) item.user_id = u.user
  const extra = users(u.users)
  if (extra) item.users = extra
  const l = links(u.links)
  if (l) item.models = l
  fillRecord(item, u.data, u.increment)
  return item
}

/**
 * One event and whatever travels with it: the event item first, then the
 * records that carry data and the user's profile. Items in one request are
 * related to each other server-side, so the records need no reference back.
 */
export function eventItems(
  eventKey: unknown,
  properties: Properties | undefined,
  options: TrackOptions | undefined,
  warn: (message: string) => void,
): WireItem[] {
  const event: WireItem = { event: key(eventKey, 'an event key') }
  const o = options ?? {}
  event.id = isId(o.id) ? o.id : newId()
  if (isId(o.user)) event.user_id = o.user
  const extra = users(o.users)
  if (extra) event.users = extra

  const refs: Array<{ model: string; id: Id }> = []
  const records: WireItem[] = []
  if (Array.isArray(o.records)) {
    for (const r of o.records as RecordRef[]) {
      if (!r || typeof r.model !== 'string' || !r.model.trim() || !isId(r.id)) continue
      if (r.model.trim() === 'user') continue // users relate through user/users, never as records
      if (isObject(r.data) || increments(r.increment)) {
        const item: WireItem = { model: r.model.trim(), id: r.id }
        fillRecord(item, r.data, r.increment)
        records.push(item)
      } else {
        refs.push({ model: r.model.trim(), id: r.id })
      }
    }
  }
  if (refs.length) event.models = refs

  const ts = timestamp(o.timestamp, warn)
  if (ts) event.timestamp = ts
  if (isObject(properties)) event.properties = properties

  const { count, sum, duration } = o
  if (typeof count === 'number' && Number.isInteger(count) && count > 1 && count <= MAX_COUNT) event.count = count
  if (typeof sum === 'number' && Number.isFinite(sum) && sum !== 0) event.sum = sum
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) event.duration = duration

  if (typeof o.device === 'string' && o.device) event.device_id = o.device
  if (typeof o.session === 'string' && o.session) event.session_id = o.session

  const items = [event, ...records]
  if (o.profile !== undefined) {
    if (!isId(o.user)) throw new InvalidCall('options.profile needs options.user, the user it describes')
    items.push(profileRecord(o.user, o.profile))
  }
  return items
}
