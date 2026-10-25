// Stands in for Next.js's `next/server` in tests (vitest.config.ts aliases
// it): `after` records its task, or throws the way Next.js does outside a
// request when a test asks it to.
export const afterTasks: Array<() => unknown> = []
export const afterControl = { outsideRequest: false }

export function after(task: () => unknown): void {
  if (afterControl.outsideRequest) throw new Error('`after` was called outside a request scope.')
  afterTasks.push(task)
}
