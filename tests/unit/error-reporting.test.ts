import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVueErrorHandler, normalizeError } from '~/utils/error-reporting'

describe('normalizeError', () => {
  it('passes Error instances through unchanged', () => {
    const error = new Error('already an error')
    expect(normalizeError(error)).toBe(error)
  })

  it('wraps non-Error values in an Error', () => {
    const error = normalizeError('boom')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('boom')
  })
})

describe('createVueErrorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs and forwards a normalized error to notify', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const notify = vi.fn()
    const handler = createVueErrorHandler(notify)

    handler('boom', null, 'mounted hook')

    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledTimes(1)
    const forwarded = notify.mock.calls[0]?.[0]
    expect(forwarded).toBeInstanceOf(Error)
    expect(forwarded.message).toBe('boom')
  })

  it('forwards Error instances unchanged', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const notify = vi.fn()
    const error = new Error('render failure')
    const handler = createVueErrorHandler(notify)

    handler(error, null, 'render function')

    expect(notify).toHaveBeenCalledWith(error)
  })
})
