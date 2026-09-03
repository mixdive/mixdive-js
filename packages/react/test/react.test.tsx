import { act, render } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MixdiveProvider, mixdive, useMixdive, usePageViews } from '../src/index'

// One module-level singleton, one init per environment: this file exercises
// the provider once and the hooks around it.
interface Sent {
  url: string
  body: Record<string, any>
}
const sent: Sent[] = []
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) })
      return Promise.resolve(new Response(null, { status: 202 }))
    }),
  )
})

function IdentifyOnMount() {
  useEffect(() => {
    mixdive.identify('user-42')
  }, [])
  return null
}

function Tracker() {
  const client = useMixdive()
  return (
    <button type="button" onClick={() => client.track('clicked', { where: 'button' })}>
      go
    </button>
  )
}

function Router() {
  const [path, setPath] = useState('/home')
  usePageViews(path)
  return (
    <button type="button" onClick={() => setPath('/pricing')}>
      nav
    </button>
  )
}

describe('@mixdive/react', () => {
  it('starts the singleton once, before children effects, and exposes it through the hook', () => {
    localStorage.clear()
    const view = render(
      <MixdiveProvider apiKey="mx_react" server="https://analytics.acme.test/" autoPageViews={false}>
        <IdentifyOnMount />
        <Tracker />
        <Router />
      </MixdiveProvider>,
    )
    // identify from the child's effect, then the first usePageViews view
    expect(sent.map((s) => s.url)).toEqual([
      'https://analytics.acme.test/ingest/user?api_key=mx_react',
      'https://analytics.acme.test/ingest/event?api_key=mx_react',
    ])
    expect(sent[1]!.body).toMatchObject({ event_key: 'page_view', user_id: 'user-42', properties: { url: '/home' } })

    act(() => view.getByText('go').click())
    expect(sent[2]!.body).toMatchObject({ event_key: 'clicked', properties: { where: 'button' }, user_id: 'user-42' })

    act(() => view.getByText('nav').click())
    expect(sent[3]!.body).toMatchObject({ event_key: 'page_view', properties: { url: '/pricing', referrer: '/home' } })

    // a re-render with other props does not restart the client
    view.rerender(
      <MixdiveProvider apiKey="mx_other" server="https://other.test" autoPageViews={false}>
        <Tracker />
      </MixdiveProvider>,
    )
    act(() => view.getByText('go').click())
    expect(sent[4]!.url).toContain('analytics.acme.test')
    expect(useMixdive).toBeTypeOf('function')
  })
})
