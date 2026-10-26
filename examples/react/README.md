# React sandbox

A small shop wired to Mixdive with [`@mixdive/react`](../../packages/react).
Browse it, add things to the cart, check out, sign in and out, and the panel
beside the shop lists every request the SDK makes, with its full body.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/mixdive/mixdive-js/tree/main/examples/react?file=src%2FApp.tsx)

Or run it locally:

```sh
npm install
npm run dev
```

Nothing is sent anywhere until you set `SERVER` and `API_KEY` in
`src/config.ts`. Use a key from a **Web** app under **Settings → Apps** in your
Mixdive, and the same events show up in its reports.

Where to look:

- `src/main.tsx` puts `MixdiveProvider` around the app.
- `src/App.tsx` calls `useMixdive()` for `track`, `setUser`, `login` and `reset`.
  Page views need no code: the SDK follows `pushState`.
- `src/recorder.ts` and `src/SentPanel.tsx` exist only for the panel. Leave
  them out of your own app.

Guide: [docs.mixdive.com/integrations/react](https://docs.mixdive.com/integrations/react/)
