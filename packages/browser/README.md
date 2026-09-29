# @mixdive/browser

The browser SDK for **[Mixdive](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=intro)**,
self-hosted product analytics. One script tag on any website, or an npm import
in a bundled app. Page views, visitors, sessions and session durations count
themselves. Your own events take one call.

[![The Mixdive console: the events list, with every event a product sends, its counts and its unique users](https://mixdive.com/assets/video/hero-console-poster.webp)](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=hero)

The console your events land in, running on your own server.
[Open the live demo](https://demo1.mixdive.com/): a full Mixdive filled with a
fictional shop's data, no sign-up.

[Website](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=links)
·
[Documentation](https://docs.mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=links)
·
[Live demo](https://demo1.mixdive.com/)
·
[Web tag guide](https://docs.mixdive.com/integrations/web-tag/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=links)
·
[GitHub](https://github.com/mixdive/mixdive-js)

## Why send your events here

**Your visitors' behaviour stays with you.** Mixdive runs on a server you own
and writes to a database you hold the credentials for. Nobody else keeps a copy
of who your users are or what they did. Teams in regulated industries, EU public
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
npm i @mixdive/browser
```

```ts
import { mixdive } from '@mixdive/browser'

mixdive.init({ key: 'mx_…', server: 'https://analytics.example.com' })

mixdive.track('checkout_completed', { plan: 'team', seats: 4 })
mixdive.identify(user.id)
```

The key comes from a **Web** app under **Settings → Apps** in your Mixdive
console. It is visible in page source, which is fine: it can write events and
read nothing.

React app? [`@mixdive/react`](https://www.npmjs.com/package/@mixdive/react) adds
a provider, a hook and router-driven page views on top of this package.

## Or one script tag, no build step

```html
<script defer src="https://analytics.example.com/js/mixdive.js" data-key="mx_…"></script>
```

That is the whole integration, and your Mixdive server serves the file. To call
`mixdive(…)` from page code before the script has loaded, add the one-line stub:

```html
<script>window.mixdive=window.mixdive||function(){(mixdive.q=mixdive.q||[]).push(arguments)};</script>
<script defer src="https://analytics.example.com/js/mixdive.js" data-key="mx_…"></script>
<script>
  mixdive('track', 'checkout_completed', { plan: 'team' });
  mixdive('identify', currentUser.id);
</script>
```

The same file ships in this package as `dist/mixdive.js` (7 KB), so you can copy
it from `node_modules` into your own static assets or load it from a CDN mirror:
`https://cdn.jsdelivr.net/npm/@mixdive/browser@0.1/dist/mixdive.js`. Attributes:
`data-key`, `data-server`, `data-auto-page-views`, `data-app-version`,
`data-debug`. Full reference:
[Web tag](https://docs.mixdive.com/integrations/web-tag/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=tag).

## What arrives without you writing anything

- **Page views** on load and on every history change, single-page apps
  included, with the path, the title and the previous path as referrer. Query
  strings are never sent.
- **Visitors and sessions**: a device id minted on the first visit, never
  derived from the browser, and a session that renews after 30 minutes idle and
  rotates when a landing URL carries a different `utm_source`.
- **Session duration**, sent when the page is hidden or unloaded.
- **Acquisition and context** on every item: landing referrer, `utm_source`,
  `utm_medium`, `utm_campaign`, screen size, browser language.

Never sent: full URLs, query strings, the visitor's IP, or browser timestamps.
In an automated browser nothing is sent at all, so test runners stay out of your
numbers. [Visitors and
sessions](https://docs.mixdive.com/concepts/visitors-sessions/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=concepts)
has the rules.

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

Every call returns immediately and never throws into your page. With no key, no
server, or an automated browser, every call is a silent no-op. The first `init`
wins, and calls made before it are buffered and delivered once it runs.

`track` takes three measures beside the properties: `count` for one occurrence
that stands for several, `sum` for money or points, `duration` in seconds. The
report totals and averages them for you.

`identify(userId)` must be **your** user id, the same one your backend sends.
The device's earlier anonymous history is then attributed to that user, so
pre-signup browsing becomes part of their story. `reset()` forgets device,
session and user, which is what you want on sign-out and when consent is
withdrawn.

## Consent

The device id is a persistent identifier, so treat the tag like any other
analytics tag: load it once consent is granted, and call `reset()` when it is
withdrawn. No cookies are set. Three localStorage keys are used, `mx_did`,
`mx_ses` and `mx_uid`, which you can name in your storage declarations.

## Running Mixdive

```sh
curl -O https://docs.mixdive.com/compose.yaml
docker compose up -d
```

Then open `http://localhost:8080`, where a one-time wizard asks for a project
name, the address your apps will use, and an owner account.
[Quick start](https://docs.mixdive.com/start/quick-start/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=quickstart)
·
[Install](https://docs.mixdive.com/operate/install/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=install)

Mixdive is in beta with a small group of teams whose requirements shape what
gets built. Running a real product whose data cannot go to a third party? A few
lines to beta@mixdive.com is enough, and a person answers.

## More SDKs

A backend belongs in the picture too: profile enrichment and server-side events
go through [`mixdive-go`](https://github.com/mixdive/mixdive-go). There is also
a [Google Tag
Manager](https://docs.mixdive.com/integrations/google-tag-manager/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=integrations)
template and an [HTTP
API](https://docs.mixdive.com/integrations/http-api/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=integrations)
for anything that can POST JSON.

More SDKs are on the way. Missing one for your platform? Tell us at
[hello@mixdive.com](mailto:hello@mixdive.com). Requests set the order.

## License

This SDK is Apache-2.0. The Mixdive server itself is commercial software you run
on your own machines, and [that
distinction](https://docs.mixdive.com/start/open-source/?utm_source=npm&utm_medium=referral&utm_campaign=browser_readme&utm_content=license)
is worth two minutes if it matters to you.
