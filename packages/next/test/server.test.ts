// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { afterControl, afterTasks } from './next-server-stub'

interface Sent {
  url: string
  headers: Record<string, string>
  body: any
}
const sent: Sent[] = []

beforeEach(() => {
  sent.length = 0
  afterTasks.length = 0
  afterControl.outsideRequest = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) })
      return new Response(null, { status: 202 })
    }),
  )
})

describe('@mixdive/next/server', () => {
  it('configures the shared client from the environment on first use and flushes after the response', async () => {
    process.env.MIXDIVE_SERVER = 'https://mixdive.example.com'
    process.env.MIXDIVE_API_KEY = 'mx_backend'
    process.env.MIXDIVE_APP_VERSION = 'abc123'
    const { mixdive } = await import('../src/server')

    mixdive.track('order_completed', { plan: 'team' }, { user: 'u1', sum: 49 })
    mixdive.setUser('u1', { name: 'Ada' })
    expect(sent).toHaveLength(0) // nothing on the request path
    expect(afterTasks).toHaveLength(2)

    await Promise.all(afterTasks.map((t) => t()))
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url).toBe('https://mixdive.example.com/ingest/batch')
    expect(sent[0]!.headers).toMatchObject({ 'X-Api-Key': 'mx_backend', 'X-App-Version': 'abc123' })
    expect(sent[0]!.body.items).toEqual([
      { event: 'order_completed', id: expect.any(String), user_id: 'u1', properties: { plan: 'team' }, sum: 49 },
      { model: 'user', id: 'u1', data: { name: 'Ada' } },
    ])
  })

  it('still sends when called outside a request, where after() throws', async () => {
    afterControl.outsideRequest = true
    const { createMixdive } = await import('../src/server')
    const errors: string[] = []
    const mixdive = createMixdive({ server: 'https://other.example.com', apiKey: 'mx_script', onError: (e) => errors.push(e.message) })
    expect(() => mixdive.login('u2', 'email')).not.toThrow()
    await mixdive.flush()
    expect(afterTasks).toHaveLength(0)
    expect(sent.map((s) => s.url)).toEqual(['https://other.example.com/ingest/event'])
    expect(sent[0]!.body).toMatchObject({ event_key: 'login', user_id: 'u2', properties: { method: 'email' } })
    expect(errors).toEqual([])
  })

  it('stays off without a key, and says so once', async () => {
    delete process.env.MIXDIVE_API_KEY
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { createMixdive } = await import('../src/server')
    const mixdive = createMixdive()
    mixdive.track('nothing')
    mixdive.setRecord('order', 'o1', { data: { total: 1 } })
    await Promise.all(afterTasks.map((t) => t()))
    await mixdive.close()
    expect(sent).toHaveLength(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('off: no server URL')
  })
})
