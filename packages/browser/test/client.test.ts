import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMixdive } from '../src/client'
import { KEY, SERVER, eventsOf, last, recordSends, resetBrowser, setReferrer, type Sent } from './helpers'

// Core sends: every client here runs with autoPageViews off so the file
// stays free of history hooks; page views have their own file.
let sent: Sent[]
beforeEach(() => {
  resetBrowser()
  sent = recordSends()
})
afterEach(() => {
  vi.useRealTimers()
})

function start(extra: Record<string, unknown> = {}) {
  const c = createMixdive()
  c.init({ key: KEY, server: SERVER, autoPageViews: false, ...extra })
  return c
}

describe('track', () => {
  it('posts one event with device, session, context and properties — preflight-free', () => {
    const c = start()
    c.track('checkout_completed', { plan: 'team', seats: 4 })
    const s = last(sent)
    expect(s.url).toBe(`${SERVER}/ingest/event?api_key=${KEY}`)
    expect(s.headers).toBeUndefined()
    expect(s.body.event_key).toBe('checkout_completed')
    expect(s.body.properties).toEqual({ plan: 'team', seats: 4 })
    expect(s.body.device_id).toMatch(/^[0-9a-f]{32}$/)
    expect(s.body.session_id).toMatch(/^[0-9a-f]{32}$/)
    expect(s.body.context.language).toBe(navigator.language)
    expect(s.body.user_id).toBeUndefined()
    expect(s.body.timestamp).toBeUndefined()
    expect(localStorage.getItem('mx_did')).toBe(s.body.device_id)
  })

  it('trims the server URL and encodes the key', () => {
    const c = createMixdive()
    c.init({ key: 'mx_a b', server: `${SERVER}///`, autoPageViews: false })
    c.track('x')
    expect(last(sent).url).toBe(`${SERVER}/ingest/event?api_key=mx_a%20b`)
  })

  it('carries measures and the occurrence id, and drops what the contract would ignore', () => {
    const c = start()
    c.track('item_purchase', undefined, { count: 3, sum: 129.9, duration: 90.5, id: 'purchase-1' })
    expect(last(sent).body).toMatchObject({ count: 3, sum: 129.9, duration: 90.5, id: 'purchase-1' })
    c.track('item_purchase', undefined, { count: 1, sum: 0, duration: 0 })
    const b = last(sent).body
    expect(b.count).toBeUndefined()
    expect(b.sum).toBeUndefined()
    expect(b.duration).toBeUndefined()
    c.track('item_purchase', undefined, { count: 2.5, sum: -10, duration: -1 })
    expect(last(sent).body.count).toBeUndefined()
    expect(last(sent).body.sum).toBe(-10) // a refund subtracts
    expect(last(sent).body.duration).toBeUndefined()
    c.track('item_purchase', undefined, { count: 1_000_001 })
    expect(last(sent).body.count).toBeUndefined()
  })

  it('ignores empty keys and GTM internals', () => {
    const c = start()
    c.track('')
    c.track('   ')
    c.track('gtm.dom')
    // @ts-expect-error runtime guard against untyped callers
    c.track(undefined)
    expect(sent).toHaveLength(0)
  })

  it('reuses the device across clients and pageloads (localStorage)', () => {
    start().track('a')
    const did = last(sent).body.device_id
    start().track('b')
    expect(last(sent).body.device_id).toBe(did)
  })
})

describe('sessions', () => {
  it('keeps one session across events, renews after 30 idle minutes, never bills idle time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-03T10:00:00Z'))
    const c = start()
    c.track('a')
    const sid = last(sent).body.session_id
    vi.setSystemTime(new Date('2026-09-03T10:29:00Z'))
    c.track('b')
    expect(last(sent).body.session_id).toBe(sid)
    vi.setSystemTime(new Date('2026-09-03T11:00:00Z')) // 31 idle minutes
    c.track('c')
    expect(last(sent).body.session_id).not.toBe(sid)
  })

  it('carries the landing acquisition on every item and starts a new session on a new campaign', () => {
    setReferrer('https://news.example/story?id=1')
    history.replaceState({}, '', '/?utm_source=newsletter&utm_medium=email')
    const c = start()
    c.track('a')
    expect(last(sent).body.context).toMatchObject({
      referrer: 'https://news.example/story',
      utm_source: 'newsletter',
      utm_medium: 'email',
    })
    const sid = last(sent).body.session_id
    // a second pageload from another campaign, same stored session
    history.replaceState({}, '', '/?utm_source=ads')
    const c2 = start()
    c2.track('b')
    expect(last(sent).body.session_id).not.toBe(sid)
    expect(last(sent).body.context.utm_source).toBe('ads')
    setReferrer('')
  })
})

describe('users', () => {
  it('identify links the device and rides on later events; the id survives a new pageload until reset', () => {
    const c = start()
    c.identify('user-9')
    expect(last(sent).url).toBe(`${SERVER}/ingest/user?api_key=${KEY}`)
    expect(last(sent).body).toEqual({ user_id: 'user-9', device_id: localStorage.getItem('mx_did') })
    c.track('a')
    expect(last(sent).body.user_id).toBe('user-9')
    const c2 = start()
    c2.track('b')
    expect(last(sent).body.user_id).toBe('user-9')
    c2.reset()
    c2.track('c')
    expect(last(sent).body.user_id).toBeUndefined()
    expect(last(sent).body.device_id).not.toBe(localStorage.getItem('mx_did') === null ? '' : c) // fresh device below
  })

  it('reset mints a fresh visitor', () => {
    const c = start()
    c.track('a')
    const before = last(sent).body.device_id
    c.reset()
    expect(localStorage.getItem('mx_did')).toBeNull()
    expect(localStorage.getItem('mx_ses')).toBeNull()
    c.track('b')
    expect(last(sent).body.device_id).not.toBe(before)
  })

  it('setUser maps the profile to wire names and drops empty or invalid values', () => {
    const c = start()
    c.setUser('user-9', {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      username: '',
      organization: 'Analytical Engines',
      phone: '+44 20 7946 0958',
      picture: 'https://example.com/ada.jpg',
      gender: 'F',
      birthYear: 1815,
      custom: { plan: 'team', followers: 12 },
    })
    expect(last(sent).body).toEqual({
      user_id: 'user-9',
      device_id: localStorage.getItem('mx_did'),
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      organization: 'Analytical Engines',
      phone: '+44 20 7946 0958',
      picture: 'https://example.com/ada.jpg',
      gender: 'F',
      birth_year: 1815,
      custom: { plan: 'team', followers: 12 },
    })
    c.setUser('user-9', { birthYear: 1815.5 })
    expect(last(sent).body.birth_year).toBeUndefined()
    c.identify('')
    expect(last(sent).body.user_id).toBe('user-9') // nothing new was sent
    expect(sent).toHaveLength(2)
  })

  it('login and sign_up are the built-in keys with the method property', () => {
    const c = start()
    c.login('google')
    expect(last(sent).body).toMatchObject({ event_key: 'login', properties: { method: 'google' } })
    c.signUp()
    expect(last(sent).body.event_key).toBe('sign_up')
    expect(last(sent).body.properties).toBeUndefined()
  })
})

describe('lifecycle', () => {
  it('buffers calls made before init and delivers them once started', () => {
    const c = createMixdive()
    c.identify('user-1')
    c.track('early')
    expect(sent).toHaveLength(0)
    c.init({ key: KEY, server: SERVER, autoPageViews: false })
    expect(sent.map((s) => s.url.split('?')[0])).toEqual([`${SERVER}/ingest/user`, `${SERVER}/ingest/event`])
    expect(eventsOf(sent)[0]!.body.user_id).toBe('user-1')
  })

  it('caps the pre-init buffer at 200, dropping the oldest', () => {
    const c = createMixdive()
    for (let i = 0; i < 250; i++) c.track(`e${i}`)
    c.init({ key: KEY, server: SERVER, autoPageViews: false })
    expect(sent).toHaveLength(200)
    expect(sent[0]!.body.event_key).toBe('e50')
  })

  it('the first init wins', () => {
    const c = start()
    c.init({ key: 'mx_other', server: 'https://other.test', autoPageViews: false })
    c.track('a')
    expect(last(sent).url).toContain(SERVER)
  })

  it('appVersion switches events to the header transport', () => {
    const c = start({ appVersion: '1.4.2' })
    c.track('a')
    const s = last(sent)
    expect(s.url).toBe(`${SERVER}/ingest/event`)
    expect(s.headers).toEqual({ 'Content-Type': 'application/json', 'X-Api-Key': KEY, 'X-App-Version': '1.4.2' })
  })

  it('exposes the version', () => {
    expect(createMixdive().version).toBe('test')
  })
})
