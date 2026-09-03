# @mixdive/react

React bindings for the [Mixdive](https://mixdive.com) browser SDK.

```tsx
import { MixdiveProvider, useMixdive } from '@mixdive/react'

<MixdiveProvider apiKey="mx_…" server="https://analytics.example.com">
  <App />
</MixdiveProvider>

const mixdive = useMixdive()
mixdive.track('checkout_completed', { plan: 'team' })
```

Page views follow your router automatically; `usePageViews(pathname)` is
there for apps that prefer to drive them. Full guide:
[github.com/mixdive/mixdive-js](https://github.com/mixdive/mixdive-js#readme). Apache-2.0.
