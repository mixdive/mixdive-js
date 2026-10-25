import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent: Array<{ url: string; body: any }> = []
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) })
      return Promise.resolve(new Response(null, { status: 202 }))
    }),
  )
})

describe('@mixdive/next', () => {
  it('starts the browser client from the public environment variables and sends the first page view', async () => {
    process.env.NEXT_PUBLIC_MIXDIVE_KEY = 'mx_web'
    process.env.NEXT_PUBLIC_MIXDIVE_SERVER = 'https://mixdive.example.com'
    localStorage.clear()
    window.history.replaceState(null, '', '/pricing')
    const { MixdiveProvider, useMixdive } = await import('../src/index')

    function Buy() {
      const mixdive = useMixdive()
      return (
        <button type="button" onClick={() => mixdive.track('checkout_started', { plan: 'team' })}>
          buy
        </button>
      )
    }
    // Standing alone, beside the page rather than around it.
    const view = render(
      <>
        <MixdiveProvider />
        <Buy />
      </>,
    )
    expect(sent[0]!.url).toBe('https://mixdive.example.com/ingest/event?api_key=mx_web')
    expect(sent[0]!.body).toMatchObject({ event_key: 'page_view', properties: { url: '/pricing' } })

    view.getByText('buy').click()
    expect(sent[1]!.body).toMatchObject({ event_key: 'checkout_started', properties: { plan: 'team' } })

    // A client-side navigation: the router moves the URL, then sets the title.
    window.history.pushState(null, '', '/docs')
    document.title = 'Docs'
    await new Promise((r) => setTimeout(r, 5))
    expect(sent[2]!.body).toMatchObject({ event_key: 'page_view', properties: { url: '/docs', title: 'Docs', referrer: '/pricing' } })
  })
})
