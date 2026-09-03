import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const define = { __MIXDIVE_VERSION__: JSON.stringify(pkg.version) }

export default defineConfig([
  // The library: what `import { mixdive } from '@mixdive/browser'` loads.
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2019',
    define,
    treeshake: true,
  },
  // The tag: one self-contained file for `<script defer src=".../js/mixdive.js" data-key="…">`.
  // Also what a Mixdive server serves at /js/mixdive.js and what the GTM template injects.
  {
    entry: { mixdive: 'src/tag.ts' },
    format: ['iife'],
    minify: true,
    target: 'es2017',
    define,
    outExtension: () => ({ js: '.js' }),
    banner: { js: `/*! Mixdive web tag v${pkg.version} · https://github.com/mixdive/mixdive-js · Apache-2.0 */` },
  },
])
