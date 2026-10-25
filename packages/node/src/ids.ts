// A 32-hex random id for events and increments that carry none of their own.
// The same id rides every retry of a send, which is what lets the server
// count a retried event once and apply a retried increment once.
export function newId(): string {
  const buf = new Uint8Array(16)
  const c = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(buf)
  } else {
    for (let i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256)
  }
  let hex = ''
  for (let i = 0; i < 16; i++) hex += (buf[i]! + 256).toString(16).slice(1)
  return hex
}
