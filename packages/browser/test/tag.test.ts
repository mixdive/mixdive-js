import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installTag, type TagGlobal } from '../src/tag-install'
import { eventsOf, last, recordSends, resetBrowser, type Sent } from './helpers'

let sent: Sent[]
const w = window as Window & { mixdive?: unknown }

function scriptTag(attrs: Record<string, string>): HTMLScriptElement {
  const s = document.createElement('script')
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v)
  return s
}

beforeEach(() => {
  resetBrowser()
  sent = recordSends()
  delete w.mixdive
})

describe('the tag', () => {
  it('starts from data-key with the server defaulting to the script origin, and sends the first page view', () => {
    installTag(w, scriptTag({ src: 'https://analytics.acme.test/js/mixdive.js', 'data-key': 'mx_k' }))
    expect(eventsOf(sent)).toHaveLength(1)
    expect(last(sent).url).toBe('https://analytics.acme.test/ingest/event?api_key=mx_k')
    expect(last(sent).body.event_key).toBe('page_view')
  })

  it('honors data-server, data-auto-page-views and data-app-version', () => {
    installTag(
      w,
      scriptTag({
        src: 'https://mixdive.com/js/mixdive-1.js',
        'data-key': 'mx_k',
        'data-server': 'https://analytics.acme.test/',
        'data-auto-page-views': 'false',
        'data-app-version': '3.1.0',
      }),
    )
    expect(sent).toHaveLength(0)
    const g = w.mixdive as TagGlobal
    g.track('a')
    expect(last(sent).url).toBe('https://analytics.acme.test/ingest/event')
    expect(last(sent).headers).toMatchObject({ 'X-App-Version': '3.1.0' })
  })

  it('is callable and an object; both styles send', () => {
    installTag(w, scriptTag({ src: 'https://analytics.acme.test/js/mixdive.js', 'data-key': 'mx_k', 'data-auto-page-views': 'false' }))
    const g = w.mixdive as TagGlobal
    g('track', 'via_call', { a: 1 })
    g.track('via_method')
    g('identify', 'user-1')
    expect(eventsOf(sent).map((s) => s.body.event_key)).toEqual(['via_call', 'via_method'])
    expect(last(sent).url).toContain('/ingest/user')
    expect(g.version).toBe('test')
    g('nope' as never)
    expect(sent).toHaveLength(3)
  })

  it('drains a stub queue installed before the script, in order, before the first page view', () => {
    // the snippet's one-liner
    const stub = function () {
      // eslint-disable-next-line prefer-rest-params
      ;(stub.q = stub.q || []).push(arguments)
    } as unknown as { (...a: unknown[]): void; q?: unknown[] }
    w.mixdive = stub
    stub('identify', 'user-7')
    stub('track', 'queued_event')
    installTag(w, scriptTag({ src: 'https://analytics.acme.test/js/mixdive.js', 'data-key': 'mx_k' }))
    expect(sent.map((s) => s.url.split('?')[0]!.split('/ingest/')[1])).toEqual(['user', 'event', 'event'])
    expect(sent[1]!.body.event_key).toBe('queued_event')
    expect(sent[2]!.body).toMatchObject({ event_key: 'page_view', user_id: 'user-7' })
    // late pushes still arrive
    ;(w.mixdive as TagGlobal).q.push(['track', 'late'])
    expect(last(sent).body.event_key).toBe('late')
  })

  it('a queued init works for tags loaded without data attributes (tag managers)', () => {
    const q: unknown[] = [['init', { key: 'mx_k', server: 'https://analytics.acme.test', autoPageViews: false }], ['track', 'from_gtm']]
    w.mixdive = { q }
    installTag(w, scriptTag({ src: 'https://mixdive.com/js/mixdive-1.js' }))
    expect(eventsOf(sent).map((s) => s.body.event_key)).toEqual(['from_gtm'])
  })

  it('loads once: a second tag leaves the first client in place', () => {
    const first = installTag(w, scriptTag({ src: 'https://analytics.acme.test/js/mixdive.js', 'data-key': 'mx_k', 'data-auto-page-views': 'false' }))
    const second = installTag(w, scriptTag({ src: 'https://analytics.acme.test/js/mixdive.js', 'data-key': 'mx_other' }))
    expect(first).not.toBeNull()
    expect(second).toBeNull()
    ;(w.mixdive as TagGlobal).track('a')
    expect(last(sent).url).toContain('api_key=mx_k')
  })

  it('never throws into the page on a malformed queue entry', () => {
    w.mixdive = { q: [null, 42, ['track']] }
    expect(() => installTag(w, scriptTag({ src: 'https://analytics.acme.test/js/mixdive.js', 'data-key': 'mx_k', 'data-auto-page-views': 'false' }))).not.toThrow()
    expect(sent).toHaveLength(0)
    expect(vi.isMockFunction(fetch)).toBe(true)
  })
})
