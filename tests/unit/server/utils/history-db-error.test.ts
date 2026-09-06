// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toHistoryDbHttpError } from '../../../../server/utils/history-db-error'
import {
  HistoryDbLockedError,
  HistoryDbNotFoundError,
  HistoryDbNotReadableError
} from '../../../../server/utils/history-store'

class FakeH3Error extends Error {
  statusCode?: number
  statusMessage?: string
  __h3_error__ = true
}

beforeEach(() => {
  vi.stubGlobal(
    'createError',
    (opts: { statusCode: number; statusMessage?: string; message?: string }) => {
      const err = new FakeH3Error(opts.message ?? opts.statusMessage ?? 'Error')
      err.statusCode = opts.statusCode
      err.statusMessage = opts.statusMessage
      return err
    }
  )
  vi.stubGlobal('isError', (err: unknown) => err instanceof FakeH3Error)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const FALLBACK = 'History.db を読み込めませんでした。'

describe('toHistoryDbHttpError', () => {
  it('maps HistoryDbNotFoundError to 404', () => {
    const err = toHistoryDbHttpError(new HistoryDbNotFoundError('missing'), FALLBACK)
    expect(err).toMatchObject({ statusCode: 404, message: 'missing' })
  })

  it('maps HistoryDbNotReadableError to 403', () => {
    const err = toHistoryDbHttpError(new HistoryDbNotReadableError('no perm'), FALLBACK)
    expect(err).toMatchObject({ statusCode: 403, message: 'no perm' })
  })

  it('maps HistoryDbLockedError to 503 with its own message', () => {
    const err = toHistoryDbHttpError(
      new HistoryDbLockedError('ブラウザを終了してください'),
      FALLBACK
    )
    expect(err).toMatchObject({ statusCode: 503, message: 'ブラウザを終了してください' })
  })

  it('passes an existing H3Error through unchanged', () => {
    const h3err = new FakeH3Error('bad request')
    h3err.statusCode = 400
    expect(toHistoryDbHttpError(h3err, FALLBACK)).toBe(h3err)
  })

  // Regression test for issue #180: node:sqlite can throw a generic Error
  // whose message is the meaningless "not an error" string. Rather than
  // surfacing that verbatim, this must fall back to the caller-supplied
  // fallbackMessage.
  it('falls back to fallbackMessage for a generic Error with the "not an error" message', () => {
    const err = toHistoryDbHttpError(new Error('not an error'), FALLBACK)
    expect(err).toMatchObject({ statusCode: 500, message: FALLBACK })
  })

  it('falls back to fallbackMessage for a generic Error with an empty message', () => {
    const err = toHistoryDbHttpError(new Error(''), FALLBACK)
    expect(err).toMatchObject({ statusCode: 500, message: FALLBACK })
  })

  it('keeps a generic Error message when it is actually meaningful', () => {
    const err = toHistoryDbHttpError(new Error('disk full'), FALLBACK)
    expect(err).toMatchObject({ statusCode: 500, message: 'disk full' })
  })

  it('falls back to fallbackMessage for a non-Error thrown value', () => {
    const err = toHistoryDbHttpError('oops', FALLBACK)
    expect(err).toMatchObject({ statusCode: 500, message: FALLBACK })
  })
})
