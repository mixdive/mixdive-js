// Next.js inlines `process.env.NEXT_PUBLIC_*` into browser bundles at build
// time and provides `process.env` on the server and the edge. Declared here
// so the package builds without @types/node.
declare const process: { env: Record<string, string | undefined> }
