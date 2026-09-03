# mixdive-js

Official JavaScript SDKs for [Mixdive](https://mixdive.com) — self-hosted
product analytics. Send an event, get its report screen automatically.

| Package | What it is |
|---|---|
| [`@mixdive/browser`](packages/browser) | The browser SDK: one script tag for any website, or an npm module for bundled apps. Visitors, sessions, page views and session durations come for free. |
| [`@mixdive/react`](packages/react) | React bindings on top of it: a provider, a hook, router-driven page views. |

Looking for a backend? The Go SDK is
[`github.com/mixdive/mixdive-go`](https://github.com/mixdive/mixdive-go).
The browser SDK is for what happens in the browser; profile enrichment and
server-side events belong to your backend.

## Quick start

Create a **Web** app under **Settings → Apps** in your Mixdive console and
copy its API key (`mx_…`). Keys for web apps are visible in page source by
design — they can only write events, never read anything.

### Any website — one script tag

```html
<script defer src="https://analytics.example.com/js/mixdive.js" data-key="mx_…"></script>
```

That is the whole integration. Page views (including single-page-app
navigation), visitors, sessions and session durations are sent
automatically. To send your own events from page code, add the one-line
stub so calls can be made before the script has loaded:

```html
<script>window.mixdive=window.mixdive||function(){(mixdive.q=mixdive.q||[]).push(arguments)};</script>
<script defer src="https://analytics.example.com/js/mixdive.js" data-key="mx_…"></script>
<script>
  mixdive('track', 'checkout_completed', { plan: 'team' });
  mixdive('identify', currentUser.id);   // your own user id — the same one your backend sends
</script>
```

After the script loads, `mixdive` is also an object: `mixdive.track(…)`,
`mixdive.identify(…)` work the same.

The server is the origin the script was loaded from — a copy served by your
Mixdive host needs nothing else. Serving it from elsewhere (your own CDN, a
tag manager) takes `data-server`:

| Attribute | Meaning |
|---|---|
| `data-key` | The app's API key. Required — without it the tag does nothing. |
| `data-server` | The Mixdive origin, e.g. `https://analytics.example.com`. Default: the script's own origin. |
| `data-auto-page-views="false"` | Turn off automatic page views (send them with `mixdive.pageView()`). |
| `data-app-version` | Your site's build version — see *App version* below. |
| `data-debug="true"` | Log every send and every dropped call to the console. |

**Where to get `mixdive.js`:** it ships in the npm package as
`@mixdive/browser/dist/mixdive.js` (7 KB), so copy it from `node_modules`
into your static assets, or load it from a CDN mirror of the package:
`https://cdn.jsdelivr.net/npm/@mixdive/browser@0.1/dist/mixdive.js`.
Serving it from your own domain keeps your visitors' browsers talking to your
servers only.

### Bundled apps — npm

```sh
npm i @mixdive/browser
```

```ts
import { mixdive } from '@mixdive/browser'

mixdive.init({ key: 'mx_…', server: 'https://analytics.example.com' })

mixdive.track('checkout_completed', { plan: 'team', seats: 4 })
mixdive.identify(user.id)
```

`server` is required here — a bundled app has no script origin to infer it
from.

### React

```sh
npm i @mixdive/react
```

```tsx
import { MixdiveProvider, useMixdive } from '@mixdive/react'

root.render(
  <MixdiveProvider apiKey="mx_…" server="https://analytics.example.com">
    <App />
  </MixdiveProvider>,
)

function BuyButton() {
  const mixdive = useMixdive()
  return <button onClick={() => mixdive.track('checkout_completed', { plan: 'team' })}>Buy</button>
}
```

Page views are automatic (the SDK follows `history.pushState`, which every
React router uses). If you would rather drive them from your router, turn the
automatic ones off and use the hook:

```tsx
<MixdiveProvider apiKey="mx_…" server="…" autoPageViews={false}>

function PageViews() {
  usePageViews(useLocation().pathname) // React Router; Next.js: usePathname()
  return null
}
```

The provider starts the client during its first render, so a child that
calls `identify` in a mount effect is already served. The client works
without a provider too — `useMixdive()` returns the singleton, and calls made
before `init` are buffered and delivered once it runs. Server-side rendering
is a no-op: nothing touches `window` until the browser renders.

## What is sent automatically

- **A device id** (`mx_did` in localStorage): a random 32-hex value minted on
  the first visit. Random, never derived from the browser — Mixdive does no
  fingerprinting, and the server never generates one either. It is what
  makes a visitor one visitor across sessions and across sign-in/sign-out.
- **A session id** (`mx_ses`): shared across tabs, renewed after 30 minutes
  of inactivity, and rotated when a landing URL carries a *different*
  `utm_source` — a new campaign click is never attributed to an old session.
- **`page_view`** on load and on every history change, with the page *path*
  (never the query string), the title, and the previous path as referrer.
  The same path twice in a row is sent once, so router replays do not double.
- **`session_end`** when the page is hidden or unloaded, carrying the
  session's duration in seconds. It is best-effort by nature (a killed tab
  can lose one), so repeated beacons are collapsed server-side and only ever
  widen the duration. Idle time is never billed.
- **Context** on every item: screen resolution and pixel density, the
  browser language, and the session's acquisition — the external landing
  referrer (query-stripped) and `utm_source` / `utm_medium` / `utm_campaign`.
  Resent every time so attribution survives a lost first item.

Not sent, ever: full URLs or query strings, the visitor's IP (the server
never stores it either), timestamps (the server's receive time is used —
browser clocks lie), and nothing at all in automated browsers
(`navigator.webdriver`), so test runners never pollute your data.

## API

```ts
mixdive.init({ key, server, autoPageViews?, appVersion?, debug? })
mixdive.track(eventKey, properties?, { count?, sum?, duration?, id? }?)
mixdive.pageView(url?)
mixdive.identify(userId)
mixdive.setUser(userId, { name?, username?, email?, organization?, phone?, picture?, gender?, birthYear?, custom? }?)
mixdive.login(method?)
mixdive.signUp(method?)
mixdive.reset()
mixdive.version
```

Every call returns immediately and never throws into your page. Analytics
that is off — no key, no server, an automated browser — turns every call into
a silent no-op (one console notice for a misconfiguration, none for bots).
The first `init` wins; calls made before it are buffered (up to 200) and
delivered when it runs.

### Users

`identify(userId)` names the signed-in user. It must be **your** id — the same
one your backend sends through the Go SDK — never a random or device-derived
value: Mixdive never generates user ids, and a junk id becomes a permanent
junk profile. After `identify`, every event carries the user id (it is kept
in `mx_uid` across pageloads until `reset()`), and the server links the
device to the user and retroactively attributes the device's anonymous
history to them — pre-signup browsing becomes part of the user's story.

`setUser(userId, profile)` is `identify` plus a profile update in one call.
Profiles merge: send only what changed.

```ts
mixdive.setUser(user.id, { name: user.name, email: user.email, custom: { plan: 'team' } })
```

`reset()` forgets the visitor entirely — device, session and user — so the
next event mints a fresh one. Call it on sign-out when the next person at
the keyboard is someone else, and when consent is withdrawn.

### Measures

Three measures ride on an occurrence itself:

```ts
mixdive.track('item_purchase', { category: 'books' }, {
  count: 3,       // one occurrence, three happenings — every counter moves by 3
  sum: 129.9,     // accumulated into the event's sum total (money, points); negative subtracts
  duration: 90.5, // seconds, accumulated into the event's duration total
})
```

The report shows range totals and per-event averages; events that never send
measures see no change.

### Occurrence ids

Give an event an `id` when the same action could be sent twice (a retried
form, a flaky connection): the server deduplicates on it, so re-sends never
double-count.

### Built-in events

`login` and `sign_up` are defined at the Mixdive level, like GA4's
recommended events, and named in the console before their first occurrence.
Send them through the constructors so everyone uses the same keys:

```ts
mixdive.login('google')
mixdive.signUp('email')
```

`page_view` and `session_end` are built-ins too — the SDK sends them for you.

### App version

`appVersion` (or `data-app-version`) stamps every event with your site's
build version, so reports can be broken down by release. It costs a change of
transport: the version travels in a header, and headers require a CORS
preflight instead of the preflight-free beacon. Leave it unset unless you
want the breakdown.

## Delivery

The SDK posts to the Mixdive ingest API exactly as the wire contract defines:
`navigator.sendBeacon` with a `text/plain` body and the key in the query
string — preflight-free, and queued by the browser so it survives navigation
and unload — with `fetch(keepalive)` as the fallback. The server fast-acks
with `202` (queued, not processed); reports typically reflect an event within
a minute. Blocked storage (private mode) degrades to per-pageload ids: events
still count, the pageload still coheres, and visitor totals inflate slightly
for those users.

## Consent and privacy

The device id is a persistent online identifier — under GDPR/ePrivacy it is
consent-relevant, like an analytics cookie. The SDK sets no cookies; it uses
three localStorage keys, `mx_did`, `mx_ses` and `mx_uid`, which you can name
in your storage declarations.

- **Load after consent.** The simplest model: add the script tag (or call
  `init`) only once analytics consent is granted. Nothing is stored or sent
  before.
- **On withdrawal,** call `mixdive.reset()` (or clear the three keys). A
  re-granted consent then mints a fresh visitor.
- **Tag managers:** put the Mixdive tag in your analytics consent group
  (Google Tag Manager: require `analytics_storage` in the tag's consent
  settings).

## Google Tag Manager

Load the tag from a Custom HTML tag on the *Initialization – All Pages*
trigger, then send dataLayer events through the queue from further tags:

```html
<script>
  window.mixdive = window.mixdive || function () { (mixdive.q = mixdive.q || []).push(arguments) };
  mixdive('init', { key: '{{Const - Mixdive API Key}}', server: '{{Const - Mixdive Host}}' });
  var s = document.createElement('script'); s.async = true;
  s.src = '{{Const - Mixdive Host}}/js/mixdive.js'; document.head.appendChild(s);
</script>
```

```html
<script>mixdive('track', '{{Event}}', { method: '{{DL - method}}' });</script>
```

Never attach *All Events* or any `gtm.*` trigger to a Mixdive tag: every key
that reaches the server auto-registers as a permanent event (the SDK drops
`gtm.*` keys as a seatbelt, not a strategy).

## Development

```sh
npm install
npm run build       # tsup: packages/*/dist (incl. the tag, packages/browser/dist/mixdive.js)
npm test            # vitest + jsdom, both packages
npm run typecheck
```

Layout: `packages/browser` (`src/client.ts` is the client; `src/tag-install.ts`
the script-tag shape; `src/session.ts` the pure session rules) and
`packages/react`. The SDK has **zero runtime dependencies**; keep it that way.
Field names on the wire follow the Mixdive ingest contract and nothing is
invented here — a new field starts in the contract, then lands in the SDKs.

## License

Apache-2.0.
