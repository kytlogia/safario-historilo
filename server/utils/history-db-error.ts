import { HistoryDbNotFoundError, HistoryDbNotReadableError } from './history-store'

/**
 * Maps the read-local-history-db error hierarchy — shared by Safari's
 * history-store.ts and Firefox's firefox-history-store.ts — to the H3 error
 * their respective `local-history` API routes should respond with.
 *
 * `resolveHistoryDbPath()` (Safari) can also throw its own H3Error directly
 * (e.g. 400 for a malformed profileId) — `isError()` passes that through
 * as-is instead of masking it with a generic 500 below. It checks the error
 * is genuinely an H3Error rather than duck-typing on a `statusCode`
 * property, which some unrelated error type could coincidentally have.
 */
export function toHistoryDbHttpError(err: unknown, fallbackMessage: string) {
  if (err instanceof HistoryDbNotFoundError) {
    return createError({ statusCode: 404, statusMessage: 'Not Found', message: err.message })
  }
  if (err instanceof HistoryDbNotReadableError) {
    return createError({ statusCode: 403, statusMessage: 'Forbidden', message: err.message })
  }
  if (isError(err)) {
    return err
  }
  return createError({
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: err instanceof Error ? err.message : fallbackMessage
  })
}
