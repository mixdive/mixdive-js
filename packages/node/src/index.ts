// @mixdive/node — the Mixdive SDK for servers: Node.js 20 and later and the
// edge runtimes. It needs nothing but a global `fetch`.
//
//   import { createMixdive } from '@mixdive/node'
//   const mixdive = createMixdive({ server: 'https://mixdive.example.com', apiKey: process.env.MIXDIVE_API_KEY! })
//   mixdive.track('order_completed', { plan: 'team' }, { user: order.userId, sum: order.total })
//
// Create one client per process and share it. Calls return at once; `flush`
// waits for delivery (serverless handlers, scripts) and `close` drains on
// shutdown.
export { createMixdive, MAX_BODY_BYTES, VERSION } from './client'
export { MixdiveError } from './types'
export type {
  Id,
  Mixdive,
  MixdiveOptions,
  Properties,
  PropertyValue,
  RecordLink,
  RecordRef,
  RecordUpdate,
  RelatedUser,
  TrackOptions,
  UserProfile,
} from './types'
