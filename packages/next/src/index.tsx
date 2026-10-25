// @mixdive/next — Mixdive for Next.js, the browser half. Every export is a
// client component or a hook (the build writes 'use client' on the first
// line), so a Server Component such as the root layout can render the
// provider directly:
//
//   // app/layout.tsx
//   import { MixdiveProvider } from '@mixdive/next'
//   <body><MixdiveProvider />{children}</body>
//
// The key and the server come from NEXT_PUBLIC_MIXDIVE_KEY and
// NEXT_PUBLIC_MIXDIVE_SERVER unless passed as props. Page views follow the
// App Router and the Pages Router on their own. The server half is
// '@mixdive/next/server'.
import type { ReactNode } from 'react'
import { MixdiveProvider as ReactProvider, type MixdiveProviderProps as ReactProviderProps } from '@mixdive/react'

export interface MixdiveProviderProps extends Omit<ReactProviderProps, 'apiKey' | 'server' | 'children'> {
  /** The web app's API key from Settings → Apps. Default: `NEXT_PUBLIC_MIXDIVE_KEY`. */
  apiKey?: string
  /** The Mixdive server's origin. Default: `NEXT_PUBLIC_MIXDIVE_SERVER`. */
  server?: string
  children?: ReactNode
}

/**
 * The public build-time variables. Each is written out in full, the one form
 * Next.js replaces in a browser bundle; the try covers a bundler that left
 * `process` undefined.
 */
function publicEnv(): { key?: string; server?: string } {
  try {
    return { key: process.env.NEXT_PUBLIC_MIXDIVE_KEY, server: process.env.NEXT_PUBLIC_MIXDIVE_SERVER }
  } catch {
    return {}
  }
}

/**
 * Starts the browser client once, on the first render in the browser. It
 * may wrap the app or stand on its own: `useMixdive()` reaches the same
 * client either way.
 */
export function MixdiveProvider({ apiKey, server, children, ...options }: MixdiveProviderProps) {
  const env = publicEnv()
  return (
    <ReactProvider apiKey={apiKey ?? env.key ?? ''} server={server ?? env.server ?? ''} {...options}>
      {children}
    </ReactProvider>
  )
}

export { mixdive, useMixdive, usePageViews } from '@mixdive/react'
export type { InitOptions, Mixdive, Properties, PropertyValue, TrackOptions, UserProfile } from '@mixdive/react'
