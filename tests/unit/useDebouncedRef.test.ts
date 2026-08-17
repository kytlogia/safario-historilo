import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedRef } from '~/composables/useDebouncedRef'

describe('useDebouncedRef', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts out equal to the source value', () => {
    const source = ref('initial')
    const { debounced } = useDebouncedRef(source, 200)
    expect(debounced.value).toBe('initial')
  })

  it('does not update until the delay has elapsed', async () => {
    const source = ref('')
    const { debounced } = useDebouncedRef(source, 200)

    source.value = 'a'
    await nextTick()
    expect(debounced.value).toBe('')

    vi.advanceTimersByTime(199)
    expect(debounced.value).toBe('')

    vi.advanceTimersByTime(1)
    expect(debounced.value).toBe('a')
  })

  it('resets the timer on rapid successive changes, keeping only the last value', async () => {
    const source = ref('')
    const { debounced } = useDebouncedRef(source, 200)

    source.value = 'a'
    await nextTick()
    vi.advanceTimersByTime(100)

    source.value = 'ab'
    await nextTick()
    vi.advanceTimersByTime(100)
    expect(debounced.value).toBe('')

    vi.advanceTimersByTime(100)
    expect(debounced.value).toBe('ab')
  })

  it('is read-only: direct writes to .value are a no-op', () => {
    const source = ref('a')
    const { debounced } = useDebouncedRef(source, 200)

    expect(() => {
      // @ts-expect-error debounced is a ComputedRef and has no setter
      debounced.value = 'tampered'
    }).not.toThrow()
    expect(debounced.value).toBe('a')
  })

  it('reset() immediately syncs to the current source value and cancels a pending update', async () => {
    const source = ref('')
    const { debounced, reset } = useDebouncedRef(source, 200)

    source.value = 'stale'
    await nextTick()
    vi.advanceTimersByTime(100)

    source.value = 'fresh'
    reset()
    expect(debounced.value).toBe('fresh')

    // The timer scheduled for the 'stale' update (and any prior scheduling)
    // must not fire later and clobber the value reset() just set.
    vi.advanceTimersByTime(200)
    expect(debounced.value).toBe('fresh')
  })

  it('reset(value) forces an explicit value regardless of source', async () => {
    const source = ref('current')
    const { debounced, reset } = useDebouncedRef(source, 200)

    reset('explicit')
    expect(debounced.value).toBe('explicit')

    vi.advanceTimersByTime(200)
    expect(debounced.value).toBe('explicit')
  })

  it('stops updating once its owning effect scope is disposed', async () => {
    const source = ref('')
    const scope = effectScope()
    const { debounced } = scope.run(() => useDebouncedRef(source, 200))!

    scope.stop()
    source.value = 'a'
    await nextTick()
    vi.advanceTimersByTime(200)

    expect(debounced.value).toBe('')
  })
})
