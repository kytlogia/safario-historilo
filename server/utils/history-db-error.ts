import {
  HistoryDbLockedError,
  HistoryDbNotFoundError,
  HistoryDbNotReadableError
} from './history-store'

/**
 * `node:sqlite` has a known bug where certain internal failures surface as
 * an `Error` whose message is the string SQLite normally reserves for
 * *success* ("not an error") — see isLockedDbErrorSignature in
 * sqlite-backup.ts, which already turns the one known trigger (a locked DB)
 * into a proper HistoryDbLockedError before it gets here. This is a backstop
 * for any other Error that slips through with that same meaningless
 * message, so it never reaches the user verbatim.
 */
function isMeaninglessErrorMessage(message: string): boolean {
  return message.trim().length === 0 || message.trim().toLowerCase() === 'not an error'
}

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
  if (err instanceof HistoryDbLockedError) {
    return createError({
      statusCode: 503,
      statusMessage: 'Service Unavailable',
      message: err.message
    })
  }
  if (isError(err)) {
    return err
  }
  if (err instanceof Error && !isMeaninglessErrorMessage(err.message)) {
    return createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: err.message
    })
  }
  return createError({
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: fallbackMessage
  })
}
