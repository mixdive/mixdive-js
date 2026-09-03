import { describe, expect, it } from 'vitest'
import { IDLE_MS, contextOf, landingAcquisition, nextSession, parseSession, type Session } from '../src/session'

const loc = (search = '', host = 'shop.example') => ({ host, search })
const ids = () => {
  let n = 0
  return () => `id${++n}`
}

describe('landingAcquisition', () => {
  it('keeps an external referrer, query-stripped, and drops a same-site one', () => {
    expect(landingAcquisition(loc(), 'https://news.example/story?x=1').ref).toBe('https://news.example/story')
    expect(landingAcquisition(loc(), 'https://shop.example/cart').ref).toBe('')
    expect(landingAcquisition(loc(), 'https://SHOP.example/cart').ref).toBe('')
    expect(landingAcquisition(loc(), '').ref).toBe('')
  })
  it('reads the three utm parameters, decoded and capped', () => {
    const a = landingAcquisition(loc('?utm_source=news%20letter&utm_medium=email&utm_campaign=sept+sale&other=1'), '')
    expect(a).toEqual({ ref: '', us: 'news letter', um: 'email', uc: 'sept sale' })
    expect(landingAcquisition(loc('?utm_source=' + 'x'.repeat(200)), '').us.length).toBe(128)
  })
  it('survives a malformed percent-encoding', () => {
    expect(landingAcquisition(loc('?utm_source=%E0%A4%A'), '').us).toBe('%E0%A4%A')
  })
})

describe('nextSession', () => {
  const landing = { ref: 'https://news.example/', us: 'news', um: '', uc: '' }
  it('starts a session when there is none, carrying the landing acquisition', () => {
    const s = nextSession(null, landing, 1000, ids())
    expect(s).toEqual({ id: 'id1', start: 1000, last: 1000, ref: 'https://news.example/', us: 'news', um: '', uc: '' })
  })
  it('touches a live session and renews an idle one', () => {
    const gen = ids()
    const s1 = nextSession(null, landing, 1000, gen)
    const s2 = nextSession(s1, landing, 1000 + IDLE_MS, gen)
    expect(s2.id).toBe('id1')
    expect(s2.last).toBe(1000 + IDLE_MS)
    const s3 = nextSession(s2, landing, 1000 + 2 * IDLE_MS + 1, gen)
    expect(s3.id).toBe('id2')
    expect(s3.start).toBe(1000 + 2 * IDLE_MS + 1)
  })
  it('starts a new session when the landing carries a different utm_source, and keeps it otherwise', () => {
    const gen = ids()
    const s1 = nextSession(null, landing, 1000, gen)
    expect(nextSession(s1, { ...landing, us: 'ads' }, 2000, gen).id).toBe('id2')
    const s2 = nextSession(null, landing, 1000, gen)
    expect(nextSession(s2, { ref: '', us: '', um: '', uc: '' }, 2000, gen).id).toBe(s2.id) // no utm on this landing: same session
  })
})

describe('parseSession / contextOf', () => {
  it('rejects corrupt storage and fills missing acquisition fields', () => {
    expect(parseSession('not json')).toBeNull()
    expect(parseSession('{"id":"a"}')).toBeNull()
    expect(parseSession('{"id":"a","start":1,"last":2}')).toEqual({ id: 'a', start: 1, last: 2, ref: '', us: '', um: '', uc: '' })
  })
  it('builds the context object with only what is known', () => {
    const s: Session = { id: 'a', start: 1, last: 2, ref: 'https://news.example/', us: 'news', um: '', uc: 'c' }
    expect(contextOf(s, { language: 'tr-TR', width: 1920, height: 1080, density: 2 })).toEqual({
      language: 'tr-TR',
      resolution: '1920x1080',
      density: 2,
      referrer: 'https://news.example/',
      utm_source: 'news',
      utm_campaign: 'c',
    })
    expect(contextOf({ ref: '', us: '', um: '', uc: '' }, {})).toEqual({})
  })
})
