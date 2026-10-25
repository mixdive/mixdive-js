import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Node 20 and every current edge runtime run ES2022.
  target: 'es2022',
  define: { __MIXDIVE_VERSION__: JSON.stringify(pkg.version) },
  treeshake: true,
})
