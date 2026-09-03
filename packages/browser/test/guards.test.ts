import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMixdive } from '../src/client'
import type { Properties } from '../src/types'
import { KEY, SERVER, last, readBlob, recordSends, resetBrowser, setWebdriver, type Sent } from './helpers'

let sent: Sent[]
beforeEach(() => {
  resetBrowser()
  sent = recordSends()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  setWebdriver(false)
})

describe('off states', () => {
  it('no key: off with one notice, nothing ever sent', () => {
    const c = createMixdive()
    c.track('early')
    c.init({ key: '', server: SERVER })
    c.track('a')
    c.identify('u')
    expect(sent).toHaveLength(0)
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('no server, or a server without a scheme: off', () => {
    const c = createMixdive()
    c.init({ key: KEY, server: '' })
    c.track('a')
    const c2 = createMixdive()
    c2.init({ key: KEY, server: 'analytics.acme.test' })
    c2.track('a')
    expect(sent).toHaveLength(0)
    expect(console.warn).toHaveBeenCalledTimes(2)
  })

  it('automated browsers send nothing, silently', () => {
    setWebdriver(true)
    const c = createMixdive()
    c.track('early')
    c.init({ key: KEY, server: SERVER })
    c.track('a')
    expect(sent).toHaveLength(0)
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe('degradation', () => {
  it('blocked storage: events still send and cohere within the pageload', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const c = createMixdive()
    c.init({ key: KEY, server: SERVER, autoPageViews: false })
    c.track('a')
    c.track('b')
    expect(sent).toHaveLength(2)
    expect(sent[0]!.body.device_id).toBe(sent[1]!.body.device_id)
    expect(sent[0]!.body.session_id).toBe(sent[1]!.body.session_id)
    setItem.mockRestore()
    getItem.mockRestore()
  })

  it('a throwing property getter never reaches the page', () => {
    const c = createMixdive()
    c.init({ key: KEY, server: SERVER, autoPageViews: false })
    const evil = {} as Properties
    Object.defineProperty(evil, 'boom', {
      enumerable: true,
      get() {
        throw new Error('boom')
      },
    })
    expect(() => c.track('a', evil)).not.toThrow()
  })

  it('prefers sendBeacon when the browser has it, with a text/plain body', async () => {
    const beacon = vi.fn(() => true)
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    const c = createMixdive()
    c.init({ key: KEY, server: SERVER, autoPageViews: false })
    c.track('a')
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe(`${SERVER}/ingest/event?api_key=${KEY}`)
    expect(blob.type).toBe('text/plain')
    expect(JSON.parse(await readBlob(blob)).event_key).toBe('a')
    // a refused beacon falls back to fetch
    beacon.mockReturnValue(false)
    c.track('b')
    expect(last(sent).body.event_key).toBe('b')
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true })
  })
})
