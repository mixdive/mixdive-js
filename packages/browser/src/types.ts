// Public types of @mixdive/browser. Field names follow the Mixdive wire
// contract (docs/ingest-api.md in the server repository) in JavaScript
// spelling; the client maps them to wire names, so callers never spell
// `birth_year` or `event_key` themselves.

/** A property value: strings, numbers, booleans, or objects nested at most two levels. Arrays are accepted but dropped server-side. */
export type PropertyValue = string | number | boolean | null | undefined | PropertyValue[] | { [key: string]: PropertyValue }

export type Properties = Record<string, PropertyValue>

export interface InitOptions {
  /** The app's API key from Settings → Apps (`mx_…`). Required — without it the client is off. */
  key: string
  /**
   * The Mixdive server's origin, e.g. `https://analytics.example.com`. Required
   * when the SDK is imported from npm; the script tag fills it in with the
   * origin it was loaded from.
   */
  server: string
  /** Send `page_view` on load and on history changes (single-page apps). Default `true`. */
  autoPageViews?: boolean
  /**
   * The client build's version, sent as `X-App-Version`. Setting it switches
   * delivery from the preflight-free beacon to a JSON fetch with headers;
   * the `session_end` beacon always stays a beacon.
   */
  appVersion?: string
  /** Log what the client does and why it dropped something. Default `false`. */
  debug?: boolean
}

export interface TrackOptions {
  /** How many times the event happened, folded into one occurrence — "bought 3 items". A whole number up to 1 000 000; every counter moves by it. */
  count?: number
  /** A number accumulated into the event's sum total (money, points). Negative values subtract. */
  sum?: number
  /** How long the event took, in **seconds** (fractions allowed), accumulated into the event's duration total. */
  duration?: number
  /** The occurrence's own id. Re-sending the same id updates that occurrence instead of counting twice. Generated server-side when absent. */
  id?: string
}

export interface UserProfile {
  name?: string
  username?: string
  email?: string
  organization?: string
  phone?: string
  /** An avatar URL. */
  picture?: string
  gender?: string
  /** Year of birth — a positive whole number. */
  birthYear?: number
  /** Anything else, merged key by key into the profile's custom data. */
  custom?: Properties
}

export interface Mixdive {
  /** Configure and start the client. The first call wins; later calls are ignored. Calls made before `init` are buffered and delivered once it runs. */
  init(options: InitOptions): void
  /** Send one event occurrence. Unknown keys auto-register on first receipt. */
  track(eventKey: string, properties?: Properties, options?: TrackOptions): void
  /** Send a `page_view` for the current path (or `url`). The same path twice in a row is sent once. */
  pageView(url?: string): void
  /** Name the signed-in user. The device is linked to them and every later event carries their id until `reset()`. */
  identify(userId: string): void
  /** `identify` plus a profile update in one call. Send only what changed — fields merge. */
  setUser(userId: string, profile?: UserProfile): void
  /** The built-in `login` event with its recommended `method` property ("google", "email", …). */
  login(method?: string): void
  /** The built-in `sign_up` event with its recommended `method` property. */
  signUp(method?: string): void
  /** Forget the visitor: clears the device id, the session and the user. The next event mints a fresh visitor. Call it on sign-out or when consent is withdrawn. */
  reset(): void
  /** The SDK version. */
  readonly version: string
}
