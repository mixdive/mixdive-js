# @mixdive/react

React bindings for **[Mixdive](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=intro)**,
self-hosted product analytics. A provider, a hook, and page views that follow
your router. Everything else about your app's behaviour arrives on its own.

[![The Mixdive console: the events list, with every event a product sends, its counts and its unique users](https://mixdive.com/assets/video/hero-console-poster.webp)](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=hero)

The console your events land in, running on your own server.
[Open the live demo](https://demo1.mixdive.com/): a full Mixdive filled with a
fictional shop's data, no sign-up.

[Website](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=links)
·
[Documentation](https://docs.mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=links)
·
[Live demo](https://demo1.mixdive.com/)
·
[React guide](https://docs.mixdive.com/integrations/react/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=links)
·
[GitHub](https://github.com/mixdive/mixdive-js)

## Why send your events here

**Your users' behaviour stays with you.** Mixdive runs on a server you own and
writes to a database you hold the credentials for. Nobody else keeps a copy of
who your users are or what they did. Teams in regulated industries, EU public
sector work, and anyone whose data simply cannot go to a third party tend to
arrive for exactly this reason.

**Nothing to define first.** Send `checkout_completed` and its report screen
exists. Properties register themselves the first time they show up, so a new
field becomes a breakdown you can look at instead of a ticket for somebody else.

**You don't need a data team.** The screens answer what a product person
actually asks: which features get used, by whom, how often, and what people did
before they stopped.

## Install

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

The key comes from a **Web** app under **Settings → Apps** in your Mixdive
console. It is visible in page source, which is fine: it can write events and
read nothing.

## Page views

They are automatic. The SDK follows `history.pushState`, which every React
router uses, and sends the path, the title and the previous path as referrer.
The same path twice in a row is sent once, so router replays do not double.

To drive them from your own router instead:

```tsx
<MixdiveProvider apiKey="mx_…" server="…" autoPageViews={false}>

function PageViews() {
  usePageViews(useLocation().pathname) // React Router; Next.js: usePathname()
  return null
}
```

The provider starts the client during its first render, so a child that calls
`identify` in a mount effect is already served. `useMixdive()` returns the same
singleton with or without a provider, calls made before it are buffered, and
server-side rendering is a no-op: nothing touches `window` until the browser
renders.

## Signed-in users

```tsx
mixdive.identify(user.id)
mixdive.setUser(user.id, { name: user.name, email: user.email, custom: { plan: 'team' } })
mixdive.reset()   // on sign-out, and when consent is withdrawn
```

`identify` must take **your** user id, the same one your backend sends. The
device's earlier anonymous history is then attributed to that user, so
pre-signup browsing becomes part of their story. Profiles merge, so send only
what changed.

## What else arrives without you writing anything

Visitors, sessions, session durations, and the acquisition of each session
(landing referrer, `utm_source`, `utm_medium`, `utm_campaign`). Query strings,
full URLs and visitor IPs are never sent, and an automated browser sends
nothing at all, so test runners stay out of your numbers.

The full client API, measures (`count`, `sum`, `duration`) and the consent
notes live in
[`@mixdive/browser`](https://www.npmjs.com/package/@mixdive/browser), which this
package wraps and re-exports.

## Running Mixdive

```sh
curl -O https://docs.mixdive.com/compose.yaml
docker compose up -d
```

Then open `http://localhost:8080`, where a one-time wizard asks for a project
name, the address your apps will use, and an owner account.
[Quick start](https://docs.mixdive.com/start/quick-start/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=quickstart)
·
[Install](https://docs.mixdive.com/operate/install/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=install)

Mixdive is in beta with a small group of teams whose requirements shape what
gets built. Running a real product whose data cannot go to a third party? A few
lines to beta@mixdive.com is enough, and a person answers.

## More SDKs

Server-side events and profile enrichment belong to your backend, through
[`mixdive-go`](https://github.com/mixdive/mixdive-go). There is also a [Google
Tag
Manager](https://docs.mixdive.com/integrations/google-tag-manager/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=integrations)
template and an [HTTP
API](https://docs.mixdive.com/integrations/http-api/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=integrations)
for anything that can POST JSON.

More SDKs are on the way. Missing one for your platform? Tell us at
[hello@mixdive.com](mailto:hello@mixdive.com). Requests set the order.

## License

This SDK is Apache-2.0. The Mixdive server itself is commercial software you run
on your own machines, and [that
distinction](https://docs.mixdive.com/start/open-source/?utm_source=npm&utm_medium=referral&utm_campaign=react_readme&utm_content=license)
is worth two minutes if it matters to you.
