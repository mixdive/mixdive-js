import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// One test run for the whole workspace. Every package is tested against its
// siblings' *source*, so a test failure never hides behind a stale dist
// build, and `next/server` is a stand-in that records `after()` tasks.
//
// Node 25 and later ship a global localStorage of their own, which shadows
// jsdom's and is undefined unless a storage file is given. The tests want
// jsdom's, so the workers start with Node's switched off wherever the flag
// exists (Node 22.4 and later).
const execArgv = process.allowedNodeEnvironmentFlags.has('--experimental-webstorage') ? ['--no-experimental-webstorage'] : []

export default defineConfig({
  define: { __MIXDIVE_VERSION__: JSON.stringify('test') },
  resolve: {
    alias: {
      '@mixdive/browser': fileURLToPath(new URL('./packages/browser/src/index.ts', import.meta.url)),
      '@mixdive/react': fileURLToPath(new URL('./packages/react/src/index.tsx', import.meta.url)),
      '@mixdive/node': fileURLToPath(new URL('./packages/node/src/index.ts', import.meta.url)),
      'next/server.js': fileURLToPath(new URL('./packages/next/test/next-server-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['packages/*/test/**/*.test.{ts,tsx}'],
    poolOptions: { forks: { execArgv } },
    restoreMocks: true,
    clearMocks: true,
  },
})
