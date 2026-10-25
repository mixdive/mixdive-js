import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.tsx' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2019',
  external: ['react', '@mixdive/browser'],
  // Everything here is a hook or a component that needs the browser, so the
  // whole module is a client component. React Server Components frameworks
  // (the Next.js App Router) read the directive from the first line of the
  // file; esbuild drops a directive written in the source when it bundles,
  // so the build writes it instead.
  banner: { js: "'use client';" },
})
