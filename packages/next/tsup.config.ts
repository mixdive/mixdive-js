import { defineConfig } from 'tsup'

const shared = {
  format: ['esm', 'cjs'] as ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  target: 'es2022',
  external: ['react', 'next', 'next/server.js', '@mixdive/browser', '@mixdive/react', '@mixdive/node'],
}

export default defineConfig([
  // The browser half: client components and hooks only. esbuild drops a
  // directive written in the source when it bundles, so the build writes it.
  { ...shared, entry: { index: 'src/index.tsx' }, clean: true, banner: { js: "'use client';" } },
  // The server half carries no directive: it runs in Server Actions, Route
  // Handlers, Server Components and middleware.
  { ...shared, entry: { server: 'src/server.ts' }, clean: false },
])
