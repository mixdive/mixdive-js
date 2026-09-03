// @mixdive/browser — the Mixdive browser SDK.
//
//   import { mixdive } from '@mixdive/browser'
//   mixdive.init({ key: 'mx_…', server: 'https://analytics.example.com' })
//   mixdive.track('checkout_completed', { plan: 'team' })
//
// `mixdive` is the one client an app needs. `createMixdive` builds another
// for the rare case of two servers on one page (and for tests).
import { createMixdive } from './client'

export { createMixdive, STORAGE_KEYS, VERSION } from './client'
export type { InitOptions, Mixdive, Properties, PropertyValue, TrackOptions, UserProfile } from './types'

export const mixdive = createMixdive()
export default mixdive
