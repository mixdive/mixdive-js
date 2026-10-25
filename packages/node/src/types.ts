// Public types of @mixdive/node. Field names follow the Mixdive wire contract
// (docs/ingest-api.md in the server repository) in JavaScript spelling, and
// the vocabulary is @mixdive/browser's: `track(key, properties, options)`,
// `setUser(id, profile)`, the same measures. What a server adds is what a
// browser cannot know: who did it (`user`), who else is involved and in
// which role (`users`), which records it concerns (`records`), and records
// of its own (`setRecord`).

/** A property or data value: strings, numbers, booleans, or objects nested at most two levels. Arrays are accepted but dropped server-side. */
export type PropertyValue = string | number | boolean | null | undefined | Date | PropertyValue[] | { [key: string]: PropertyValue }

export type Properties = Record<string, PropertyValue>

/** An id from your own systems. Numbers are read by their decimal value, so `42` and `"42"` are one id. */
export type Id = string | number

export interface MixdiveOptions {
  /** The Mixdive server's origin, e.g. `https://mixdive.example.com`. Without it the client is off. */
  server: string
  /** An app's API key from Settings → Apps (`mx_…`). A **backend** app keeps server events apart from your web or mobile app's. Without it the client is off. */
  apiKey: string
  /** Your build's version, sent as `X-App-Version` and stamped on every event. At most 64 characters. Default: none. */
  appVersion?: string
  /** How many times a send is repeated after a 503 or a network error. Default `2`, with a doubling pause from 200 ms. */
  retries?: number
  /** Milliseconds one attempt may take before it counts as a network error. Default `10000`. */
  timeout?: number
  /** How many calls may wait to be sent. When it is full the oldest call is dropped and reported. Default `1024`. */
  queueSize?: number
  /** Receives every dropped call and every failed send. Default: `console.warn`. Calls never throw, so this is the one place failures show up. */
  onError?: (error: MixdiveError) => void
  /** The `fetch` to send with. Default: the runtime's global `fetch`. */
  fetch?: typeof fetch
}

/** Another user on an event or a record, with the role saying why. `role` is free text and defaults to `actor`. */
export interface RelatedUser {
  id: Id
  role?: string
}

/**
 * A record an event concerns. With only `model` and `id` it is a reference:
 * the event counts on that record's screen, and a record that does not exist
 * yet is created empty. With `data` or `increment` the record's new state
 * travels in the same request as the event.
 */
export interface RecordRef {
  model: string
  id: Id
  /** Fields merged into the record. Send only what changed. */
  data?: Properties
  /** Numbers added to the record's numeric fields on the server. */
  increment?: Record<string, number>
}

/** A link from one record to another: a card's account, a project's workspace. */
export interface RecordLink {
  model: string
  id: Id
}

export interface TrackOptions {
  /** The user who did it, your own id. Without one the event is anonymous and counts toward totals only. */
  user?: Id
  /** Further users the event concerns, each with a role: the author of a liked post is `{ id, role: 'owner' }`. */
  users?: RelatedUser[]
  /** Records the event concerns. See `RecordRef`. */
  records?: RecordRef[]
  /** A profile update for `user`, sent in the same request. */
  profile?: UserProfile
  /** How many times the event happened, folded into one occurrence: "bought 3 items". A whole number from 2 to 1 000 000; every counter moves by it. */
  count?: number
  /** A number added to the event's sum total (money, points). Negative values subtract. */
  sum?: number
  /** How long the event took, in **seconds** (fractions allowed), added to the event's duration total. */
  duration?: number
  /** The occurrence's own id. Sending the same id again updates that occurrence instead of counting it twice. Generated when absent. */
  id?: Id
  /** When it happened. Default: when the server received it. */
  timestamp?: Date | string | number
  /** A browser's device id, passed through when your server sends on a visitor's behalf. */
  device?: string
  /** That browser's session id. Ignored without `device`. */
  session?: string
}

export interface UserProfile {
  name?: string
  /** A label for people to read. It need not be unique; the user id tells users apart. */
  username?: string
  email?: string
  organization?: string
  phone?: string
  /**
   * The URL of the user's photo, shown beside their name in the console. The
   * server keeps only an absolute http(s) URL of at most 2048 characters and
   * ignores anything else, leaving the stored photo as it was.
   */
  picture?: string
  gender?: string
  /** Year of birth, a positive whole number. */
  birthYear?: number
  /** Anything else, merged key by key into the profile's custom data. */
  custom?: Properties
  /** Numbers added to custom data fields on the server: `{ logins: 1 }`. */
  increment?: Record<string, number>
}

export interface RecordUpdate {
  /** Fields merged into the record. Send only what changed. */
  data?: Properties
  /** Numbers added to numeric fields on the server, with no need to know the current value. */
  increment?: Record<string, number>
  /** The user the record belongs to, in the default role `actor`. */
  user?: Id
  /** Further users, each with a role. */
  users?: RelatedUser[]
  /** Other records this one links to. The link shows on both records' screens. */
  links?: RecordLink[]
}

export interface Mixdive {
  /** Send one event occurrence. Unknown keys register themselves on first receipt. */
  track(eventKey: string, properties?: Properties, options?: TrackOptions): void
  /** The built-in `page_view`, for pages your server renders. `title` and `referrer` are its other reserved properties. */
  pageView(url: string, properties?: Properties, options?: TrackOptions): void
  /** The built-in `login` event with its recommended `method` property ("google", "email", …). */
  login(userId: Id, method?: string, options?: TrackOptions): void
  /** The built-in `sign_up` event. Give it a fixed `id` derived from the user, and the new profile in `options.profile`. */
  signUp(userId: Id, method?: string, options?: TrackOptions): void
  /** Create or update a user profile. Fields merge: send only what changed. */
  setUser(userId: Id, profile: UserProfile): void
  /** Create or update one record of a data model. Fields merge: send only what changed. */
  setRecord(model: string, id: Id, record?: RecordUpdate): void
  /** Resolves once everything sent before it has been delivered or given up on. Never rejects. */
  flush(): Promise<void>
  /** Stops accepting calls and resolves once the queue is empty. Calls after it are dropped. */
  close(): Promise<void>
  /** The SDK version. */
  readonly version: string
}

/** What `onError` receives. `status` is set when the server answered. */
export class MixdiveError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'MixdiveError'
    if (status !== undefined) this.status = status
  }
}
