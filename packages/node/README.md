# @mixdive/node

The server SDK for **[Mixdive](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=intro)**,
self-hosted product analytics. Events, user profiles and records from Node.js
20 and later or an edge runtime, sent to the Mixdive server you run. Zero
dependencies: all it needs is a global `fetch`.

[![The Mixdive console: the events list, with every event a product sends, its counts and its unique users](https://mixdive.com/assets/video/hero-console-poster.webp)](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=hero)

The console your events land in, running on your own server.
[Open a live demo](https://mixdive.com/demo/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=demo): a full Mixdive filled with a
fictional company's data, a shop, a bank or a software company, no sign-up.

[Website](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=links)
·
[Documentation](https://docs.mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=links)
·
[Node.js guide](https://docs.mixdive.com/integrations/node/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=links)
·
[GitHub](https://github.com/mixdive/mixdive-js)

## Why send your events here

**Your users' behaviour stays with you.** Mixdive runs on a server you own and
writes to a database you hold the credentials for. Nobody else keeps a copy of
who your users are or what they did.

**Nothing to define first.** Send `order_completed` and its report screen
exists. Properties register themselves the first time they show up.

**Server events are the ones you can trust.** An order your backend records
cannot be blocked by an ad blocker or lost to a closed tab, and it can name
everyone involved: the buyer, the seller, the order and the products in it.

## Install

```sh
npm i @mixdive/node
```

```ts
import { createMixdive } from '@mixdive/node'

export const mixdive = createMixdive({
  server: 'https://mixdive.example.com',
  apiKey: process.env.MIXDIVE_API_KEY!,
})

mixdive.track('order_completed', { plan: 'team' }, { user: order.userId, sum: order.total })
mixdive.setUser(user.id, { name: user.name, email: user.email })
```

The key comes from a **backend** app under **Settings → Apps** in your Mixdive
console. Keep it on the server. Create one client when the process starts and
share it.

## It never gets in the way

- Every call returns at once. Payloads are built on the spot and queued, and
  one loop delivers the queue in order.
- Calls never throw. A bad call or a failed send goes to `onError`
  (`console.warn` by default), and that is the only place failures show up.
- 503s and network errors are retried twice, with the same body, so a retried
  event is still counted once. Every event carries an id for that, generated
  when you give none.
- The queue holds 1024 calls. When it is full the oldest one is dropped and
  reported.
- Calls that stand alone and are queued together share one request, up to
  the server's 32 KB cap, so fifty small events sent in a loop travel as one
  request.
- Without a server or a key the client is off: one notice, then every call
  does nothing.

## Events

```ts
mixdive.track('post_liked', { source: 'feed' }, {
  user: 'u9',                                  // who did it
  users: [{ id: 'u_author', role: 'owner' }],  // who else, and why
  records: [{ model: 'post', id: 'p1' }],      // what it concerns
  id: 'like-u9-p1',                            // counted once, however often it is sent
})
```

That one call answers how many likes `u9` gave, how many `u_author` received
and how many post `p1` received.

| Option | Means |
|---|---|
| `user` | The user who did it, your own id. Without one the event is anonymous and counts toward totals only. |
| `users` | Further users, each with a role. `role` is free text and defaults to `actor`. |
| `records` | Records the event concerns. `{ model, id }` is a reference; add `data` or `increment` and the record's new state travels in the same request. |
| `profile` | A profile update for `user`, in the same request. |
| `count` | How many times it happened, folded into one occurrence: "bought 3 items". |
| `sum` | A number added to the event's sum total, money or points. Negative values subtract. |
| `duration` | How long it took, in seconds. |
| `id` | The occurrence's own id. Sending it again updates that occurrence instead of counting twice. |
| `timestamp` | When it happened (`Date`, ISO string or milliseconds). Default: when the server received it. |
| `device`, `session` | A browser's ids, passed through when your server sends on a visitor's behalf. |

Ids may be strings or numbers: `42` and `"42"` are one user.

## Profiles and records

```ts
mixdive.setUser('u1', {
  name: 'Ada Lovelace', username: 'ada', email: 'ada@example.com',
  organization: 'Analytical Engines', picture: 'https://example.com/ada.jpg', birthYear: 1815,
  custom: { plan: 'team' },
  increment: { logins: 1 },
})

mixdive.setRecord('order', 'o-1001', {
  data: { status: 'paid', total: 129.9 },
  increment: { views: 1 },
  user: 'u1',
  links: [{ model: 'coupon', id: 'SPRING' }],
})
```

Fields merge, so send only what changed. An increment is added on the server
with no need to know the current value, and it carries an id the server
applies once, so the SDK's own retries never add twice. A job that may run
the same action twice should set the absolute value instead.

## Built-in events

```ts
mixdive.signUp(user.id, 'email', { id: `sign-up-${user.id}`, profile: { name: user.name } })
mixdive.login(user.id, 'google')
mixdive.pageView('/pricing', { title: 'Pricing' }, { user: user.id })
```

## Serverless functions and scripts

A function that may be frozen as soon as it answers should wait for delivery
first:

```ts
mixdive.track('report_exported', undefined, { user: userId })
await mixdive.flush()
```

`close()` does the same and stops accepting calls: use it on shutdown. On
Next.js, [`@mixdive/next`](https://www.npmjs.com/package/@mixdive/next) does
this for you after the response has been sent.

## Options

```ts
createMixdive({
  server: 'https://mixdive.example.com',
  apiKey: process.env.MIXDIVE_API_KEY!,
  appVersion: process.env.GIT_COMMIT,   // sent as X-App-Version, stamped on every event
  retries: 2,                           // after a 503 or a network error
  timeout: 10_000,                      // ms per attempt
  queueSize: 1024,
  onError: (e) => logger.warn(e.message),
  fetch: customFetch,                   // default: the global fetch
})
```

## Running Mixdive

```sh
curl -O https://docs.mixdive.com/compose.yaml
docker compose up -d
```

Then open `http://localhost:8080`, where a one-time wizard asks for a project
name, the address your apps will use, and an owner account.
[Quick start](https://docs.mixdive.com/start/quick-start/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=quickstart)
·
[Install](https://docs.mixdive.com/operate/install/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=install)

## More SDKs

In the browser,
[`@mixdive/browser`](https://www.npmjs.com/package/@mixdive/browser) sends page
views, visitors and sessions by itself, with
[`@mixdive/react`](https://www.npmjs.com/package/@mixdive/react) and
[`@mixdive/next`](https://www.npmjs.com/package/@mixdive/next) on top. Go
services have [`mixdive-go`](https://github.com/mixdive/mixdive-go), and the
[HTTP
API](https://docs.mixdive.com/integrations/http-api/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=integrations)
takes anything that can POST JSON.

More SDKs are on the way. Missing one for your platform? Tell us at
[hello@mixdive.com](mailto:hello@mixdive.com). Requests set the order.

## License

This SDK is Apache-2.0. The Mixdive server itself is commercial software you run
on your own machines, and [that
distinction](https://docs.mixdive.com/start/open-source/?utm_source=npm&utm_medium=referral&utm_campaign=node_readme&utm_content=license)
is worth two minutes if it matters to you.
