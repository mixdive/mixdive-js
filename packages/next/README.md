# @mixdive/next

**[Mixdive](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=next_readme&utm_content=intro)**
for Next.js: self-hosted product analytics in the browser and on the server.
One line in the root layout gives you page views, visitors and sessions, and
your Server Actions and Route Handlers send the events only a server knows
about, after the response has gone out.

[![The Mixdive console: the events list, with every event a product sends, its counts and its unique users](https://mixdive.com/assets/video/hero-console-poster.webp)](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=next_readme&utm_content=hero)

The console your events land in, running on your own server.
[Open a live demo](https://mixdive.com/demo/?utm_source=npm&utm_medium=referral&utm_campaign=next_readme&utm_content=demo): a full Mixdive filled with a
fictional company's data, a shop, a bank or a software company, no sign-up.

[Website](https://mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=next_readme&utm_content=links)
·
[Documentation](https://docs.mixdive.com/?utm_source=npm&utm_medium=referral&utm_campaign=next_readme&utm_content=links)
·
[Next.js guide](https://docs.mixdive.com/integrations/nextjs/?utm_source=npm&utm_medium=referral&utm_campaign=next_readme&utm_content=links)
·
[GitHub](https://github.com/mixdive/mixdive-js)

## Why send your events here

**Your users' behaviour stays with you.** Mixdive runs on a server you own and
writes to a database you hold the credentials for. Nobody else keeps a copy of
who your users are or what they did.

**Nothing to define first.** Send `checkout_completed` and its report screen
exists. Properties register themselves the first time they show up.

**Both halves of your app in one place.** A visitor's page views and the order
your server recorded end up on the same user's page.

## Install

```sh
npm i @mixdive/next
```

Create two apps under **Settings → Apps** in your Mixdive console: a **web**
app for the browser and a **backend** app for the server. Then:

```sh
# .env.local
NEXT_PUBLIC_MIXDIVE_SERVER=https://mixdive.example.com
NEXT_PUBLIC_MIXDIVE_KEY=mx_…   # the web app's key: it ends up in page source, which is fine
MIXDIVE_API_KEY=mx_…           # the backend app's key: server only
```

```tsx
// app/layout.tsx
import { MixdiveProvider } from '@mixdive/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MixdiveProvider />
        {children}
      </body>
    </html>
  )
}
```

The layout stays a Server Component. Every page view from then on is sent by
itself, App Router navigations and the back button included, with the path,
the title Next.js sets for the page and the previous path as referrer. Query
strings are never sent.

## Events from the browser

```tsx
'use client'
import { useMixdive } from '@mixdive/next'

export function BuyButton() {
  const mixdive = useMixdive()
  return <button onClick={() => mixdive.track('checkout_started', { plan: 'team' })}>Buy</button>
}
```

After sign-in, `mixdive.identify(user.id)` names the visitor, and
`mixdive.reset()` forgets them on sign-out. The id must be your own user id,
the same one the server sends.

## Events from the server

```ts
'use server'
import { mixdive } from '@mixdive/next/server'

export async function completeOrder(order: Order) {
  // …save the order…
  mixdive.track('order_completed', { plan: order.plan }, {
    user: order.userId,
    sum: order.total,
    records: [{ model: 'order', id: order.id, data: { status: 'paid', total: order.total } }],
  })
}
```

The same works in Route Handlers and in middleware (`proxy.ts` on Next.js
16), on the Node.js and the Edge runtime alike. Calls return at once, and each one asks Next.js to finish delivering after the
response has been sent (`after()`), so nobody waits for analytics and a
serverless function is not frozen with the event still queued.

`mixdive` reads `MIXDIVE_SERVER` (falling back to
`NEXT_PUBLIC_MIXDIVE_SERVER`), `MIXDIVE_API_KEY` and, if you set it,
`MIXDIVE_APP_VERSION` the first time it is used. For other settings,
`createMixdive({ … })` from `@mixdive/next/server` takes the options of
[`@mixdive/node`](https://www.npmjs.com/package/@mixdive/node), whose README
documents everything the server client accepts: other users with roles,
records, profiles, increments.

## Pages Router

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app'
import { MixdiveProvider } from '@mixdive/next'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MixdiveProvider>
      <Component {...pageProps} />
    </MixdiveProvider>
  )
}
```

`after()` belongs to the App Router, so in `pages/api` routes and
`getServerSideProps` wait for delivery before answering:

```ts
mixdive.track('report_exported', undefined, { user: userId })
await mixdive.flush()
```

## Versions

Next.js 14 and later, React 18 and later (tested on 14.2, 15.5 and 16.4).
Sending after the response needs Next.js 15.1 or later. On older versions the
client sends on its own while the process runs, so `await mixdive.flush()`
where the process might stop right after answering.

## Running Mixdive

```sh
curl -O https://docs.mixdive.com/compose.yaml
docker compose up -d
```

Then open `http://localhost:8080`, where a one-time wizard asks for a project
name, the address your apps will use, and an owner account.
[Quick start](https://docs.mixdive.com/start/quick-start/?utm_source=npm&utm_medium=referral&utm_campaign=next_readme&utm_content=quickstart)
·
[Install](https://docs.mixdive.com/operate/install/?utm_source=npm&utm_medium=referral&utm_campaign=next_readme&utm_content=install)

More SDKs are on the way. Missing one for your platform? Tell us at
[hello@mixdive.com](mailto:hello@mixdive.com). Requests set the order.

## License

This SDK is Apache-2.0. The Mixdive server itself is commercial software you run
on your own machines, and [that
distinction](https://docs.mixdive.com/start/open-source/?utm_source=npm&utm_medium=referral&utm_campaign=next_readme&utm_content=license)
is worth two minutes if it matters to you.
