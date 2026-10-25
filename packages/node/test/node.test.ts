// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createMixdive, MAX_BODY_BYTES, MixdiveError, type MixdiveOptions } from '../src/index'

interface Call {
  url: string
  headers: Record<string, string>
  raw: string
  body: any
}

type Answer = number | Error | (() => Promise<Response>)

/** A fetch that records every request and answers from a script (default 202). */
function fakeServer(answers: Answer[] = []) {
  const calls: Call[] = []
  const fakeFetch = (async (url: string, init: RequestInit) => {
    const raw = String(init.body)
    calls.push({ url, headers: init.headers as Record<string, string>, raw, body: JSON.parse(raw) })
    const a = answers.shift() ?? 202
    if (a instanceof Error) throw a
    if (typeof a === 'function') return a()
    const body = a >= 400 ? JSON.stringify({ error: `status ${a}` }) : JSON.stringify({ queued: 1 })
    return new Response(body, { status: a })
  }) as unknown as typeof fetch
  return { calls, fetch: fakeFetch }
}

function client(extra: Partial<MixdiveOptions> = {}, answers: Answer[] = []) {
  const server = fakeServer(answers)
  const errors: MixdiveError[] = []
  const mixdive = createMixdive({
    server: 'https://mixdive.example.com/',
    apiKey: 'mx_test',
    fetch: server.fetch,
    onError: (e) => errors.push(e),
    ...extra,
  })
  return { mixdive, calls: server.calls, errors }
}

describe('@mixdive/node', () => {
  it('sends one event to /ingest/event with every field in its wire spelling', async () => {
    const { mixdive, calls, errors } = client({ appVersion: '1.4.2' })
    mixdive.track(
      'checkout_completed',
      { plan: 'team', seats: 4 },
      {
        user: 'u1',
        users: [{ id: 'u2', role: 'recipient' }, { id: '' }],
        records: [{ model: 'order', id: 5002 }],
        count: 3,
        sum: 129.9,
        duration: 90.5,
        timestamp: new Date('2026-10-25T10:00:00Z'),
        device: 'd1',
        session: 's1',
      },
    )
    await mixdive.flush()
    expect(errors).toEqual([])
    expect(calls).toHaveLength(1)
    const [c] = calls
    expect(c!.url).toBe('https://mixdive.example.com/ingest/event')
    expect(c!.headers).toEqual({ 'Content-Type': 'application/json', 'X-Api-Key': 'mx_test', 'X-App-Version': '1.4.2' })
    expect(c!.body).toEqual({
      event_key: 'checkout_completed',
      id: expect.stringMatching(/^[0-9a-f]{32}$/),
      user_id: 'u1',
      users: [{ id: 'u2', role: 'recipient' }],
      models: [{ model: 'order', id: 5002 }],
      timestamp: '2026-10-25T10:00:00.000Z',
      properties: { plan: 'team', seats: 4 },
      count: 3,
      sum: 129.9,
      duration: 90.5,
      device_id: 'd1',
      session_id: 's1',
    })
  })

  it('leaves out measures that are defaults or out of range, and keeps a caller-supplied id', async () => {
    const { mixdive, calls } = client()
    mixdive.track('a', undefined, { count: 1, sum: 0, duration: -2, id: 'fixed-1' })
    mixdive.track('b', undefined, { count: 2.5 })
    mixdive.track('c', undefined, { count: 2_000_000, id: 77 })
    await mixdive.flush()
    const items = calls[0]!.body.items
    expect(items[0]).toEqual({ event: 'a', id: 'fixed-1' })
    expect(items[1]).toEqual({ event: 'b', id: expect.any(String) })
    expect(items[2]).toEqual({ event: 'c', id: 77 })
  })

  it('keeps an event with its records and profile in one /ingest/track request', async () => {
    const { mixdive, calls } = client()
    mixdive.signUp('u9', 'email', {
      id: 'sign-up-u9',
      records: [
        { model: 'workspace', id: 'w1', data: { plan: 'free' }, increment: { members: 1 } },
        { model: 'campaign', id: 'launch' },
        { model: 'user', id: 'u9' },
      ],
      profile: { name: 'Ada', birthYear: 1815, custom: { plan: 'free' }, increment: { logins: 1 } },
    })
    await mixdive.flush()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://mixdive.example.com/ingest/track')
    const [event, workspace, profile] = calls[0]!.body.items
    expect(calls[0]!.body.items).toHaveLength(3)
    expect(event).toEqual({ event: 'sign_up', id: 'sign-up-u9', user_id: 'u9', models: [{ model: 'campaign', id: 'launch' }], properties: { method: 'email' } })
    expect(workspace).toEqual({ model: 'workspace', id: 'w1', data: { plan: 'free' }, data_inc: { members: 1 }, inc_id: expect.stringMatching(/^[0-9a-f]{32}$/) })
    expect(profile).toEqual({
      model: 'user',
      id: 'u9',
      data: { plan: 'free', name: 'Ada', birth_year: 1815 },
      data_inc: { logins: 1 },
      inc_id: expect.stringMatching(/^[0-9a-f]{32}$/),
    })
  })

  it('sends profiles flat to /ingest/user, and as a user record when they increment', async () => {
    const { mixdive, calls } = client()
    mixdive.setUser('u1', { name: 'Ada Lovelace', email: 'ada@example.com', picture: 'https://example.com/a.jpg', birthYear: 0, custom: { plan: 'team' } })
    await mixdive.flush()
    mixdive.setUser(42, { increment: { followers: 1, bad: Number.NaN } })
    await mixdive.flush()
    expect(calls[0]!.url).toBe('https://mixdive.example.com/ingest/user')
    expect(calls[0]!.body).toEqual({ user_id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', picture: 'https://example.com/a.jpg', custom: { plan: 'team' } })
    expect(calls[1]!.url).toBe('https://mixdive.example.com/ingest/entity')
    expect(calls[1]!.body).toEqual({ model: 'user', id: 42, data_inc: { followers: 1 }, inc_id: expect.any(String) })
  })

  it('sends records to /ingest/entity with their users and links', async () => {
    const { mixdive, calls, errors } = client()
    mixdive.setRecord('card', 'c1', {
      data: { status: 'active' },
      increment: { payments: 2 },
      user: 'u1',
      users: [{ id: 'u2', role: 'joint' }],
      links: [{ model: 'account', id: 'a1' }, { model: '', id: 'x' }],
    })
    mixdive.setRecord('user', 'u1', { data: { name: 'x' } })
    mixdive.setRecord('card', '  ')
    await mixdive.flush()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://mixdive.example.com/ingest/entity')
    expect(calls[0]!.body).toEqual({
      model: 'card',
      id: 'c1',
      user_id: 'u1',
      users: [{ id: 'u2', role: 'joint' }],
      models: [{ model: 'account', id: 'a1' }],
      data: { status: 'active' },
      data_inc: { payments: 2 },
      inc_id: expect.any(String),
    })
    expect(errors.map((e) => e.message)).toEqual([
      'mixdive: dropped a setRecord call: records of the built-in user model are profiles: use setUser',
      'mixdive: dropped a setRecord call: a record id is required for model "card"',
    ])
  })

  it('shares one /ingest/batch request among standalone calls queued together, never with a related call', async () => {
    const { mixdive, calls } = client()
    mixdive.track('one', undefined, { user: 'u1' })
    mixdive.setUser('u1', { name: 'Ada' })
    mixdive.setRecord('post', 'p1', { data: { kind: 'photo' } })
    mixdive.track('related', undefined, { records: [{ model: 'post', id: 'p1', data: { likes: 3 } }] })
    mixdive.pageView('/pricing', { title: 'Pricing' }, { user: 'u1' })
    mixdive.login('u1', 'google')
    await mixdive.flush()
    expect(calls.map((c) => c.url.replace('https://mixdive.example.com', ''))).toEqual(['/ingest/batch', '/ingest/track', '/ingest/batch'])
    expect(calls[0]!.body.items).toEqual([
      { event: 'one', id: expect.any(String), user_id: 'u1' },
      { model: 'user', id: 'u1', data: { name: 'Ada' } },
      { model: 'post', id: 'p1', data: { kind: 'photo' } },
    ])
    expect(calls[2]!.body.items).toEqual([
      { event: 'page_view', id: expect.any(String), user_id: 'u1', properties: { title: 'Pricing', url: '/pricing' } },
      { event: 'login', id: expect.any(String), user_id: 'u1', properties: { method: 'google' } },
    ])
  })

  it('splits batches to stay under the 32 KB cap and drops a single call that could never fit', async () => {
    const { mixdive, calls, errors } = client()
    const padding = 'x'.repeat(1000)
    for (let i = 0; i < 100; i++) mixdive.track('padded', { padding, i })
    mixdive.track('huge', { padding: 'y'.repeat(MAX_BODY_BYTES) })
    await mixdive.flush()
    expect(errors).toHaveLength(1)
    expect(errors[0]!.message).toMatch(/^mixdive: dropped event "huge": \d+ bytes, and the server takes at most 32768 per request$/)
    expect(calls.length).toBeGreaterThan(3)
    for (const c of calls) expect(new TextEncoder().encode(c.raw).length).toBeLessThanOrEqual(MAX_BODY_BYTES)
    const sent = calls.flatMap((c) => (c.body.items ? c.body.items : [c.body])).map((item: any) => item.properties.i)
    expect(sent).toEqual([...Array(100).keys()])
  })

  it('retries 503 and network errors with the same body, and gives up on other statuses at once', async () => {
    const { mixdive, calls, errors } = client({}, [503, new TypeError('fetch failed'), 202, 401])
    mixdive.track('retried')
    await mixdive.flush()
    expect(calls).toHaveLength(3)
    expect(new Set(calls.map((c) => c.raw)).size).toBe(1)
    expect(errors).toEqual([])

    mixdive.track('refused')
    await mixdive.flush()
    expect(calls).toHaveLength(4)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.status).toBe(401)
    expect(errors[0]!.message).toBe('mixdive: send of event "refused" failed: /ingest/event answered 401: status 401')
  })

  it('reports a send once its retries run out, and times out a hung attempt', async () => {
    const hang = () => new Promise<Response>(() => {})
    const { mixdive, calls, errors } = client({ retries: 1, timeout: 20 }, [503, 503, hang, hang])
    mixdive.track('busy')
    await mixdive.flush()
    expect(calls).toHaveLength(2)
    expect(errors[0]!.message).toBe('mixdive: send of event "busy" failed: /ingest/event answered 503: status 503')

    // This fake answers only once aborted, so the client's own timer is what ends it.
    const slow = client({ retries: 0, timeout: 20, fetch: (async (_u: string, init: RequestInit) =>
      new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch })
    slow.mixdive.track('hung')
    await slow.mixdive.flush()
    expect(slow.errors[0]!.message).toBe('mixdive: send of event "hung" failed: /ingest/event failed: no answer within 20 ms')
  })

  it('drops the oldest call when the queue is full, and flush still resolves', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { mixdive, calls, errors } = client({ queueSize: 2 }, [
      async () => {
        await gate
        return new Response(null, { status: 202 })
      },
    ])
    mixdive.setRecord('related', 'r1', { data: { a: 1 } }) // goes out on its own and waits at the gate
    await new Promise((r) => setTimeout(r, 5))
    mixdive.track('a')
    mixdive.track('b')
    mixdive.track('c')
    const done = mixdive.flush()
    release()
    await done
    expect(errors.map((e) => e.message)).toEqual(['mixdive: queue full, dropped the oldest call (event "a")'])
    expect(calls[1]!.body.items.map((i: any) => i.event)).toEqual(['b', 'c'])
  })

  it('is off without a server or a key: one notice, then nothing, and no throw anywhere', async () => {
    const errors: MixdiveError[] = []
    const server = fakeServer()
    const off = createMixdive({ server: '', apiKey: 'mx', fetch: server.fetch, onError: (e) => errors.push(e) })
    off.track('x')
    off.setUser('u1', { name: 'n' })
    await off.flush()
    await off.close()
    expect(server.calls).toHaveLength(0)
    expect(errors.map((e) => e.message)).toEqual(['mixdive: off: no server URL (https://…) or API key configured; every call is a no-op'])
    expect(() => createMixdive(undefined as unknown as MixdiveOptions)).not.toThrow()
  })

  it('reports bad calls instead of throwing, and survives an onError that throws', async () => {
    const { mixdive, calls, errors } = client()
    const circular: Record<string, unknown> = {}
    circular.self = circular
    mixdive.track('', {})
    mixdive.track('circular', circular as never)
    mixdive.track('who', undefined, { profile: { name: 'nobody' } })
    mixdive.setUser('', { name: 'x' })
    mixdive.track('late', undefined, { timestamp: 'not checked, sent as given' })
    mixdive.track('bad-date', undefined, { timestamp: new Date('nope') })
    await mixdive.flush()
    expect(errors.map((e) => e.message)).toEqual([
      'mixdive: dropped a track call: an event key is required',
      expect.stringMatching(/^mixdive: track failed: .*circular/i),
      'mixdive: dropped a track call: options.profile needs options.user, the user it describes',
      'mixdive: dropped a setUser call: a user id is required',
      'mixdive: ignored an invalid timestamp; the server will use its receive time',
    ])
    expect(calls[0]!.body.items.map((i: any) => [i.event, i.timestamp])).toEqual([
      ['late', 'not checked, sent as given'],
      ['bad-date', undefined],
    ])

    const loud = createMixdive({ server: '', apiKey: '', onError: () => { throw new Error('handler bug') } })
    expect(() => loud.track('x')).not.toThrow()
  })

  it('close waits for what is queued and drops what comes after', async () => {
    const { mixdive, calls, errors } = client()
    mixdive.track('before')
    await mixdive.close()
    expect(calls).toHaveLength(1)
    mixdive.track('after')
    await mixdive.flush()
    expect(calls).toHaveLength(1)
    expect(errors.map((e) => e.message)).toEqual(['mixdive: client closed, dropped event "after"'])
    const { close, flush } = mixdive
    await expect(close()).resolves.toBeUndefined()
    await expect(flush()).resolves.toBeUndefined()
  })

  it('delivers in order, one request at a time', async () => {
    let active = 0
    let peak = 0
    const order: string[] = []
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      active++
      peak = Math.max(peak, active)
      const body = JSON.parse(String(init.body))
      order.push(body.items ? body.items.map((i: any) => i.event ?? i.model).join('+') : body.event_key)
      await new Promise((r) => setTimeout(r, 2))
      active--
      return new Response(null, { status: 202 })
    }) as unknown as typeof fetch
    const mixdive = createMixdive({ server: 'http://localhost:8080', apiKey: 'k', fetch: fakeFetch, onError: () => {} })
    mixdive.track('a')
    await new Promise((r) => setTimeout(r, 0))
    mixdive.track('b')
    mixdive.track('c', undefined, { records: [{ model: 'm', id: 1, data: { x: 1 } }] })
    mixdive.track('d')
    await mixdive.flush()
    expect(order).toEqual(['a', 'b', 'c+m', 'd'])
    expect(peak).toBe(1)
  })
})
