export function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

// Kept free of Nuxt auto-imports (notify is injected) so it's plain-testable.
export function createVueErrorHandler(notify: (error: Error) => void) {
  return (error: unknown, _instance: unknown, info: string) => {
    const normalized = normalizeError(error)
    console.error('[Safari History Detail] Unhandled error', info, normalized)
    notify(normalized)
  }
}
