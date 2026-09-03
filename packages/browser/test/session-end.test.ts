import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMixdive } from '../src/client'
import { KEY, SERVER, eventsOf, recordSends, resetBrowser, setVisibility, type Sent } from './helpers'

let sent: Sent[]
beforeEach(() => {
  resetBrowser()
  sent = recordSends()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  setVisibility('visible')
})

const endsOf = () => eventsOf(sent).filter((s) => s.body.event_key === 'session_end' && s.body.device_id === localStorage.getItem('mx_did'))

describe('session_end', () => {
  it('beacons the session duration when the page is hidden, under the deterministic id', () => {
    vi.setSystemTime(new Date('2026-09-03T10:00:00Z'))
    const c = createMixdive()
    c.init({ key: KEY, server: SERVER, autoPageViews: false })
    c.track('a')
    const sid = sent[0]!.body.session_id
    vi.setSystemTime(new Date('2026-09-03T10:02:30Z'))
    setVisibility('hidden')
    const ends = endsOf()
    expect(ends).toHaveLength(1)
    expect(ends[0]!.body).toMatchObject({
      event_key: 'session_end',
      id: `${sid}:end`,
      session_id: sid,
      properties: { duration: 150 },
    })
    // coming back keeps the session warm; a later hide widens the duration
    setVisibility('visible')
    vi.setSystemTime(new Date('2026-09-03T10:04:00Z'))
    setVisibility('hidden')
    expect(endsOf()[1]!.body.properties.duration).toBe(240)
  })

  it('never bills idle time and never uses headers, even with an app version', () => {
    vi.setSystemTime(new Date('2026-09-03T10:00:00Z'))
    const c = createMixdive()
    c.init({ key: KEY, server: SERVER, autoPageViews: false, appVersion: '2.0.0' })
    c.track('a')
    expect(sent[0]!.headers).toBeDefined()
    vi.setSystemTime(new Date('2026-09-03T11:00:00Z')) // an hour later, tab finally hidden
    window.dispatchEvent(new Event('pagehide'))
    const end = endsOf()[0]!
    expect(end.body.properties.duration).toBe(0) // idle since the last event
    expect(end.headers).toBeUndefined()
    expect(end.url).toBe(`${SERVER}/ingest/event?api_key=${KEY}`)
  })

  it('sends nothing when there was never a session', () => {
    const c = createMixdive()
    c.init({ key: KEY, server: SERVER, autoPageViews: false })
    setVisibility('hidden')
    expect(endsOf()).toHaveLength(0)
  })
})
