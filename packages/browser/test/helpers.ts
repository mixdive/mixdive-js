import { vi } from 'vitest'

export interface Sent {
  url: string
  body: Record<string, any>
  headers?: Record<string, string>
}

/** Replace fetch with a recorder that answers 202. jsdom has no sendBeacon, so every send lands here unless a test installs one. */
export function recordSends(): Sent[] {
  const sent: Sent[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> | undefined })
      return Promise.resolve(new Response(null, { status: 202 }))
    }),
  )
  return sent
}

export const SERVER = 'https://analytics.acme.test'
export const KEY = 'mx_test_key'

export function eventsOf(sent: Sent[]): Sent[] {
  return sent.filter((s) => s.url.indexOf('/ingest/event') >= 0)
}

export function last(sent: Sent[]): Sent {
  const s = sent[sent.length - 1]
  if (!s) throw new Error('nothing was sent')
  return s
}

export function setReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', { value, configurable: true })
}

export function setVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

export function setWebdriver(on: boolean): void {
  Object.defineProperty(navigator, 'webdriver', { value: on, configurable: true })
}

export function resetBrowser(): void {
  localStorage.clear()
  history.replaceState({}, '', '/')
  document.title = ''
}

/** jsdom's Blob has no text(); read it the old way. */
export function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(blob)
  })
}
