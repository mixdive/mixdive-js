// @mixdive/react — React bindings for the Mixdive browser SDK.
//
//   <MixdiveProvider apiKey="mx_…" server="https://analytics.example.com">
//     <App />
//   </MixdiveProvider>
//
//   const mixdive = useMixdive()
//   mixdive.track('checkout_completed', { plan: 'team' })
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { mixdive, type InitOptions, type Mixdive } from '@mixdive/browser'

const MixdiveContext = createContext<Mixdive>(mixdive)

export interface MixdiveProviderProps extends Omit<InitOptions, 'key'> {
  /** The app's API key from Settings → Apps (`mx_…`). */
  apiKey: string
  children?: ReactNode
}

/**
 * Starts the client once and makes it available to `useMixdive()`.
 *
 * The client starts during the first render, not in an effect: children's
 * effects run before their parent's, and a child that identifies the user on
 * mount must be able to rely on the client. On the server there is no
 * `window` and starting is a no-op; the browser render starts it. Strict Mode
 * runs the initializer twice in development — the first `init` wins, so the
 * second is ignored.
 */
export function MixdiveProvider({ apiKey, server, autoPageViews, appVersion, debug, children }: MixdiveProviderProps) {
  useState(() => {
    mixdive.init({ key: apiKey, server, autoPageViews, appVersion, debug })
    return null
  })
  return <MixdiveContext.Provider value={mixdive}>{children}</MixdiveContext.Provider>
}

/** The client. Works without a provider too — calls made before `init` are buffered. */
export function useMixdive(): Mixdive {
  return useContext(MixdiveContext)
}

/**
 * Sends a page view whenever `path` changes — for apps that set
 * `autoPageViews={false}` and drive views from their router:
 * `usePageViews(useLocation().pathname)`.
 */
export function usePageViews(path: string | null | undefined): void {
  const client = useMixdive()
  useEffect(() => {
    if (typeof path === 'string' && path) client.pageView(path)
  }, [client, path])
}

export { mixdive }
export type { InitOptions, Mixdive, Properties, PropertyValue, TrackOptions, UserProfile } from '@mixdive/browser'
