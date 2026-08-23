// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChromiumHistoryVisit, FirefoxHistoryVisit, HistoryVisit } from '~/types/history'
import {
  exportChromiumVisitsAsCsv,
  exportChromiumVisitsAsJson,
  exportFirefoxVisitsAsCsv,
  exportFirefoxVisitsAsJson,
  exportVisitsAsCsv,
  exportVisitsAsJson
} from '~/utils/export'

function makeVisit(overrides: Partial<HistoryVisit> = {}): HistoryVisit {
  return {
    visitId: 1,
    itemId: 1,
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: 123,
    visitCount: 1,
    domainExpansion: null,
    statusCode: 200,
    loadSuccessful: true,
    httpNonGet: false,
    synthesized: false,
    redirectSource: null,
    redirectDestination: null,
    origin: 0,
    generation: 0,
    attributes: 0,
    score: 0,
    ...overrides
  }
}

function makeFirefoxVisit(overrides: Partial<FirefoxHistoryVisit> = {}): FirefoxHistoryVisit {
  return {
    visitId: 1,
    placeId: 1,
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: 123,
    visitCount: 1,
    visitType: 1,
    fromVisit: null,
    session: 0,
    hidden: false,
    typed: false,
    frecency: 100,
    guid: 'guid-1',
    ...overrides
  }
}

function makeChromiumVisit(overrides: Partial<ChromiumHistoryVisit> = {}): ChromiumHistoryVisit {
  return {
    visitId: 1,
    urlId: 1,
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: 123,
    visitCount: 1,
    typedCount: 0,
    transition: 0,
    fromVisit: null,
    visitDuration: 0,
    hidden: false,
    typed: false,
    ...overrides
  }
}

// jsdom's Blob polyfill implements neither Blob.prototype.text() nor
// interop with undici's Response(blob) body reading, but it does support
// FileReader (same realm), so read the content back through that instead.
function blobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

// readAsText() decodes as UTF-8 and, per spec, consumes a leading BOM as an
// encoding signature rather than content — read raw bytes to actually see it.
function blobBytes(blob: Blob) {
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

describe('export.ts', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>
  let capturedAnchor: { href: string; download: string } | null
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url')
    revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL

    clickSpy = vi.fn()
    capturedAnchor = null
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') {
        el.click = clickSpy
        capturedAnchor = el as unknown as { href: string; download: string }
      }
      return el
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  describe('exportVisitsAsJson', () => {
    it('serializes visits as pretty-printed JSON and triggers a download', () => {
      vi.useFakeTimers()
      const visits = [makeVisit()]

      exportVisitsAsJson(visits, 'out.json')

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const blob = createObjectURL.mock.calls[0][0] as Blob
      expect(blob.type).toBe('application/json')
      expect(capturedAnchor?.download).toBe('out.json')
      expect(clickSpy).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1000)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      vi.useRealTimers()
    })
  })

  describe('exportVisitsAsCsv', () => {
    function getCsvText(visits: HistoryVisit[]) {
      exportVisitsAsCsv(visits, 'out.csv')
      const blobParts = createObjectURL.mock.calls[0][0] as Blob
      return blobParts
    }

    it('writes the expected header row in order', async () => {
      const blob = getCsvText([])
      expect(blob.type).toBe('text/csv;charset=utf-8')
      const text = await blobText(blob)
      const [header] = text.split('\n')
      expect(header).toBe(
        [
          'visitId',
          'title',
          'url',
          'domain',
          'visitTime',
          'visitCount',
          'loadSuccessful',
          'httpNonGet',
          'synthesized',
          'redirectSource',
          'redirectDestination',
          'origin',
          'statusCode'
        ].join(',')
      )
    })

    it('prefixes the file with a UTF-8 BOM', async () => {
      const blob = getCsvText([])
      const bytes = await blobBytes(blob)
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    })

    it('escapes commas, double quotes, and newlines in cell values', async () => {
      const visit = makeVisit({
        title: 'Hello, "World"\nSecond line',
        url: 'https://example.com/?q=a,b'
      })
      const blob = getCsvText([visit])
      const text = await blobText(blob)
      const dataLine = text.slice(1).split('\n').slice(1).join('\n')

      expect(dataLine).toContain('"Hello, ""World""\nSecond line"')
      expect(dataLine).toContain('"https://example.com/?q=a,b"')
    })

    it('leaves plain values unquoted', async () => {
      const blob = getCsvText([makeVisit({ title: 'Plain title' })])
      const text = await blobText(blob)
      const dataLine = text.slice(1).split('\n')[1]
      expect(dataLine.startsWith('1,Plain title,')).toBe(true)
    })

    it('renders null redirect fields as empty cells', async () => {
      const blob = getCsvText([makeVisit({ redirectSource: null, redirectDestination: null })])
      const text = await blobText(blob)
      const cells = text.slice(1).split('\n')[1].split(',')
      // header: visitId,title,url,domain,visitTime,visitCount,loadSuccessful,httpNonGet,synthesized,redirectSource,redirectDestination,origin,statusCode
      expect(cells[9]).toBe('')
      expect(cells[10]).toBe('')
    })
  })

  describe('exportFirefoxVisitsAsJson', () => {
    it('serializes visits as pretty-printed JSON and triggers a download', () => {
      vi.useFakeTimers()
      const visits = [makeFirefoxVisit()]

      exportFirefoxVisitsAsJson(visits, 'out.json')

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const blob = createObjectURL.mock.calls[0][0] as Blob
      expect(blob.type).toBe('application/json')
      expect(capturedAnchor?.download).toBe('out.json')
      expect(clickSpy).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1000)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      vi.useRealTimers()
    })
  })

  describe('exportFirefoxVisitsAsCsv', () => {
    function getCsvText(visits: FirefoxHistoryVisit[]) {
      exportFirefoxVisitsAsCsv(visits, 'out.csv')
      return createObjectURL.mock.calls[0][0] as Blob
    }

    it('writes the expected header row in order', async () => {
      const blob = getCsvText([])
      expect(blob.type).toBe('text/csv;charset=utf-8')
      const text = await blobText(blob)
      const [header] = text.split('\n')
      expect(header).toBe(
        [
          'visitId',
          'title',
          'url',
          'domain',
          'visitTime',
          'visitCount',
          'visitType',
          'fromVisit',
          'session',
          'hidden',
          'typed',
          'frecency'
        ].join(',')
      )
    })

    it('prefixes the file with a UTF-8 BOM', async () => {
      const blob = getCsvText([])
      const bytes = await blobBytes(blob)
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    })

    it('renders a null fromVisit as an empty cell', async () => {
      const blob = getCsvText([makeFirefoxVisit({ fromVisit: null })])
      const text = await blobText(blob)
      const cells = text.slice(1).split('\n')[1].split(',')
      // header: visitId,title,url,domain,visitTime,visitCount,visitType,fromVisit,session,hidden,typed,frecency
      expect(cells[7]).toBe('')
    })
  })

  describe('exportChromiumVisitsAsJson', () => {
    it('serializes visits as pretty-printed JSON and triggers a download', () => {
      vi.useFakeTimers()
      const visits = [makeChromiumVisit()]

      exportChromiumVisitsAsJson(visits, 'out.json')

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const blob = createObjectURL.mock.calls[0][0] as Blob
      expect(blob.type).toBe('application/json')
      expect(capturedAnchor?.download).toBe('out.json')
      expect(clickSpy).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1000)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
      vi.useRealTimers()
    })
  })

  describe('exportChromiumVisitsAsCsv', () => {
    function getCsvText(visits: ChromiumHistoryVisit[]) {
      exportChromiumVisitsAsCsv(visits, 'out.csv')
      return createObjectURL.mock.calls[0][0] as Blob
    }

    it('writes the expected header row in order', async () => {
      const blob = getCsvText([])
      expect(blob.type).toBe('text/csv;charset=utf-8')
      const text = await blobText(blob)
      const [header] = text.split('\n')
      expect(header).toBe(
        [
          'visitId',
          'title',
          'url',
          'domain',
          'visitTime',
          'visitCount',
          'typedCount',
          'transition',
          'fromVisit',
          'visitDuration',
          'hidden',
          'typed'
        ].join(',')
      )
    })

    it('prefixes the file with a UTF-8 BOM', async () => {
      const blob = getCsvText([])
      const bytes = await blobBytes(blob)
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    })

    it('renders a null fromVisit as an empty cell', async () => {
      const blob = getCsvText([makeChromiumVisit({ fromVisit: null })])
      const text = await blobText(blob)
      const cells = text.slice(1).split('\n')[1].split(',')
      // header: visitId,title,url,domain,visitTime,visitCount,typedCount,transition,fromVisit,visitDuration,hidden,typed
      expect(cells[8]).toBe('')
    })
  })
})
