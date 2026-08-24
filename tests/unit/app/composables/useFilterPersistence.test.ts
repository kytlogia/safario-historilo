import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  booleanCodec,
  filterField,
  nullableDateCodec,
  nullableStringCodec,
  stringArrayCodec,
  stringCodec,
  useFilterPersistence
} from '~/composables/useFilterPersistence'

describe('useFilterPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('leaves refs at their defaults when nothing is stored yet', () => {
    const search = ref('')
    const onlyFailed = ref(false)

    useFilterPersistence('test-filters', {
      search: filterField(search, stringCodec),
      onlyFailed: filterField(onlyFailed, booleanCodec)
    })

    expect(search.value).toBe('')
    expect(onlyFailed.value).toBe(false)
  })

  it('restores previously persisted values synchronously', () => {
    localStorage.setItem(
      'test-filters',
      JSON.stringify({ search: 'blog', onlyFailed: true, domainFilter: 'example.com' })
    )
    const search = ref('')
    const onlyFailed = ref(false)
    const domainFilter = ref<string | null>(null)

    useFilterPersistence('test-filters', {
      search: filterField(search, stringCodec),
      onlyFailed: filterField(onlyFailed, booleanCodec),
      domainFilter: filterField(domainFilter, nullableStringCodec)
    })

    expect(search.value).toBe('blog')
    expect(onlyFailed.value).toBe(true)
    expect(domainFilter.value).toBe('example.com')
  })

  it('persists changes to any tracked ref', async () => {
    const search = ref('')
    const onlyFailed = ref(false)

    useFilterPersistence('test-filters', {
      search: filterField(search, stringCodec),
      onlyFailed: filterField(onlyFailed, booleanCodec)
    })

    search.value = 'redirect'
    onlyFailed.value = true
    await nextTick()

    expect(JSON.parse(localStorage.getItem('test-filters')!)).toEqual({
      search: 'redirect',
      onlyFailed: true
    })
  })

  it('round-trips Date values through nullableDateCodec', async () => {
    const dateFrom = ref<Date | null>(null)

    useFilterPersistence('test-filters', {
      dateFrom: filterField(dateFrom, nullableDateCodec)
    })

    dateFrom.value = new Date('2024-01-02T03:04:05.000Z')
    await nextTick()

    const dateTo = ref<Date | null>(null)
    useFilterPersistence('test-filters', {
      dateFrom: filterField(dateTo, nullableDateCodec)
    })

    expect(dateTo.value).toEqual(new Date('2024-01-02T03:04:05.000Z'))
  })

  it('filters out array entries that fail the allowed-value check', () => {
    localStorage.setItem(
      'test-filters',
      JSON.stringify({ enabledSources: ['safari', 'not-a-real-source', 'chrome'] })
    )
    const enabledSources = ref<string[]>([])

    useFilterPersistence('test-filters', {
      enabledSources: filterField(
        enabledSources,
        stringArrayCodec(['safari', 'firefox', 'chrome', 'edge'] as const)
      )
    })

    expect(enabledSources.value).toEqual(['safari', 'chrome'])
  })

  it('restores an intentionally-persisted empty array as-is', () => {
    localStorage.setItem('test-filters', JSON.stringify({ enabledSources: [] }))
    const enabledSources = ref<string[]>(['safari', 'firefox', 'chrome', 'edge'])

    useFilterPersistence('test-filters', {
      enabledSources: filterField(
        enabledSources,
        stringArrayCodec(['safari', 'firefox', 'chrome', 'edge'] as const)
      )
    })

    expect(enabledSources.value).toEqual([])
  })

  it('keeps the default when a non-empty stored array has no valid entries', () => {
    localStorage.setItem(
      'test-filters',
      JSON.stringify({ enabledSources: ['not-a-real-source', 'also-fake'] })
    )
    const enabledSources = ref<string[]>(['safari', 'firefox', 'chrome', 'edge'])

    useFilterPersistence('test-filters', {
      enabledSources: filterField(
        enabledSources,
        stringArrayCodec(['safari', 'firefox', 'chrome', 'edge'] as const)
      )
    })

    expect(enabledSources.value).toEqual(['safari', 'firefox', 'chrome', 'edge'])
  })

  it('persists in-place mutations of an array ref (e.g. push/splice), not just reassignment', async () => {
    const enabledSources = ref<string[]>(['safari'])

    useFilterPersistence('test-filters', {
      enabledSources: filterField(
        enabledSources,
        stringArrayCodec(['safari', 'firefox', 'chrome', 'edge'] as const)
      )
    })

    enabledSources.value.push('firefox')
    await nextTick()

    expect(JSON.parse(localStorage.getItem('test-filters')!)).toEqual({
      enabledSources: ['safari', 'firefox']
    })
  })

  it('ignores a value that fails its codec check and keeps the default', () => {
    localStorage.setItem('test-filters', JSON.stringify({ onlyFailed: 'not-a-boolean' }))
    const onlyFailed = ref(false)

    useFilterPersistence('test-filters', {
      onlyFailed: filterField(onlyFailed, booleanCodec)
    })

    expect(onlyFailed.value).toBe(false)
  })

  it('ignores corrupted JSON instead of throwing', () => {
    localStorage.setItem('test-filters', '{not valid json')
    const search = ref('default')

    expect(() =>
      useFilterPersistence('test-filters', {
        search: filterField(search, stringCodec)
      })
    ).not.toThrow()
    expect(search.value).toBe('default')
  })

  it('does not throw when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked')
    })
    const search = ref('default')

    expect(() =>
      useFilterPersistence('test-filters', {
        search: filterField(search, stringCodec)
      })
    ).not.toThrow()
    expect(search.value).toBe('default')

    vi.restoreAllMocks()
  })

  it('does not throw when localStorage.setItem throws', async () => {
    const search = ref('')
    useFilterPersistence('test-filters', {
      search: filterField(search, stringCodec)
    })

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked')
    })

    search.value = 'a'
    await expect(nextTick()).resolves.not.toThrow()

    vi.restoreAllMocks()
  })
})
