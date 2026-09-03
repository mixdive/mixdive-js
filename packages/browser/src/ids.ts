// A 32-hex random id — the device id and the session id both use it. Random,
// never derived from anything about the browser: Mixdive does no
// fingerprinting, and the server never generates either id.
export function generateId(): string {
  let hex = ''
  try {
    const buf = new Uint8Array(16)
    crypto.getRandomValues(buf)
    for (let i = 0; i < 16; i++) hex += (buf[i]! + 256).toString(16).slice(1)
    return hex
  } catch {
    // no WebCrypto — fall back to Math.random
  }
  for (let i = 0; i < 32; i++) hex += Math.floor(Math.random() * 16).toString(16)
  return hex
}
