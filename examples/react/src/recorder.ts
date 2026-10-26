// Sandbox only. Your app needs none of this file.
//
// Records each request the SDK makes to SERVER so the panel can show it. The
// SDK sends with navigator.sendBeacon, and with fetch when an app version is
// set, so both are wrapped. With the placeholder server the request is
// swallowed and reported as accepted; with a real one it goes through.
import { useSyncExternalStore } from 'react'
import { DELIVER, SERVER } from './config'

export interface Sent {
  n: number
  at: Date
  path: string
  body: Record<string, unknown>
}

let sent: Sent[] = []
let n = 0
const listeners = new Set<() => void>()

function ours(url: string): boolean {
  return url.startsWith(SERVER + '/ingest/')
}

function add(url: string, text: string) {
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text }
  }
  sent = [{ n: ++n, at: new Date(), path: new URL(url).pathname, body }, ...sent]
  listeners.forEach((l) => l())
}

const realBeacon = navigator.sendBeacon.bind(navigator)
navigator.sendBeacon = (url, data) => {
  const u = String(url)
  if (!ours(u)) return realBeacon(url, data)
  if (data instanceof Blob) data.text().then((t) => add(u, t))
  else if (typeof data === 'string') add(u, data)
  return DELIVER ? realBeacon(url, data) : true
}

const realFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (ours(u) && typeof init?.body === 'string') {
    add(u, init.body)
    if (!DELIVER) return Promise.resolve(new Response(null, { status: 202 }))
  }
  return realFetch(input, init)
}

export function useSent(): Sent[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => sent,
  )
}
