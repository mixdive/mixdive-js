import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMixdive } from '../src/client'
import { KEY, SERVER, eventsOf, last, recordSends, resetBrowser, setReferrer, type Sent } from './helpers'

// Page views and the history hooks. Each client patches history and listens
// for popstate, so this file keeps to few clients and filters by device id.
let sent: Sent[]
beforeEach(() => {
  resetBrowser()
  sent = recordSends()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  setReferrer('')
})

const mine = () => eventsOf(sent).filter((s) => s.body.device_id === localStorage.getItem('mx_did'))

describe('auto page views', () => {
  it('sends the first page view on init with path, title and the external referrer', () => {
    setReferrer('https://news.example/story?x=1')
    history.replaceState({}, '', '/pricing?plan=team')
    document.title = 'Pricing'
    const c = createMixdive()
    c.init({ key: KEY, server: SERVER })
    expect(mine()).toHaveLength(1)
    expect(last(sent).body).toMatchObject({
      event_key: 'page_view',
      properties: { url: '/pricing', title: 'Pricing', referrer: 'https://news.example/story' },
    })
    expect(JSON.stringify(last(sent).body)).not.toContain('plan=team') // never the query string
  })

  it('follows pushState, replaceState and popstate, deduping the same path and chaining referrers', async () => {
    const c = createMixdive()
    c.init({ key: KEY, server: SERVER })
    history.pushState({}, '', '/docs')
    await vi.runAllTimersAsync()
    expect(last(sent).body.properties).toMatchObject({ url: '/docs', referrer: '/' })
    history.replaceState({}, '', '/docs') // same path: nothing
    await vi.runAllTimersAsync()
    history.pushState({}, '', '/docs')
    await vi.runAllTimersAsync()
    expect(mine()).toHaveLength(2)
    history.pushState({}, '', '/docs/install')
    await vi.runAllTimersAsync()
    expect(last(sent).body.properties).toMatchObject({ url: '/docs/install', referrer: '/docs' })
    // back
    history.replaceState({}, '', '/docs')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await vi.runAllTimersAsync()
    expect(last(sent).body.properties).toMatchObject({ url: '/docs', referrer: '/docs/install' })
    expect(mine()).toHaveLength(4)
  })

  it('manual pageView takes a path and dedupes too', () => {
    const c = createMixdive()
    c.init({ key: KEY, server: SERVER, autoPageViews: false })
    expect(mine()).toHaveLength(0)
    c.pageView()
    c.pageView()
    c.pageView('/checkout')
    c.pageView('/checkout')
    expect(mine().map((s) => s.body.properties.url)).toEqual(['/', '/checkout'])
  })

  it('an identify buffered before init lands on the first page view', () => {
    const c = createMixdive()
    c.identify('user-1')
    c.init({ key: KEY, server: SERVER })
    const pv = mine()
    expect(pv).toHaveLength(1)
    expect(pv[0]!.body.user_id).toBe('user-1')
    expect(sent[0]!.url).toContain('/ingest/user') // identify went first
  })
})
