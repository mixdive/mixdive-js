# @mixdive/browser

The [Mixdive](https://mixdive.com) browser SDK — one script tag for any
website, or an npm module for bundled apps. Visitors, sessions, page views
and session durations are sent automatically; your own events take one call.

```html
<script defer src="https://analytics.example.com/js/mixdive.js" data-key="mx_…"></script>
```

```ts
import { mixdive } from '@mixdive/browser'
mixdive.init({ key: 'mx_…', server: 'https://analytics.example.com' })
mixdive.track('checkout_completed', { plan: 'team' })
```

Full guide, API and privacy notes: [github.com/mixdive/mixdive-js](https://github.com/mixdive/mixdive-js#readme).
The tag file ships in this package as `dist/mixdive.js`. Apache-2.0.

More SDKs are on the way — missing one for your platform? Tell us at
[hello@mixdive.com](mailto:hello@mixdive.com).
