// Storage that never throws. localStorage when the browser allows it; an
// in-memory fallback when it is blocked (private mode, storage permissions),
// so one pageload still coheres — events from it share one device and one
// session — while nothing survives the pageload. Industry-standard degradation.
export interface Storage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export function createStorage(): Storage {
  const memory = new Map<string, string>()
  return {
    get(key) {
      try {
        const v = window.localStorage.getItem(key)
        if (v !== null) return v
      } catch {
        // blocked — fall through to memory
      }
      return memory.get(key) ?? null
    },
    set(key, value) {
      memory.set(key, value)
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // blocked — memory only
      }
    },
    remove(key) {
      memory.delete(key)
      try {
        window.localStorage.removeItem(key)
      } catch {
        // blocked
      }
    },
  }
}
