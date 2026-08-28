import { describe, expect, it } from 'vitest'
import type { ChromiumHistoryVisit, FirefoxHistoryVisit, HistoryVisit } from '~/types/history'
import { toUnifiedVisit, UNIFIED_HISTORY_SOURCES, unifiedSourceMeta } from '~/utils/unifiedHistory'

function makeSafariVisit(overrides: Partial<HistoryVisit> = {}): HistoryVisit {
  return {
    visitId: 1,
    itemId: 1,
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: 123,
    visitCount: 5,
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
    url: 'https://example.org/',
    domain: 'example.org',
    title: 'Example Org',
    visitTime: new Date('2024-02-03T04:05:06.000Z'),
    visitTimeRaw: 456,
    visitCount: 3,
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
    url: 'https://example.net/',
    domain: 'example.net',
    title: 'Example Net',
    visitTime: new Date('2024-03-04T05:06:07.000Z'),
    visitTimeRaw: '789',
    visitCount: 7,
    typedCount: 0,
    transition: 0,
    fromVisit: null,
    visitDuration: 0,
    hidden: false,
    typed: false,
    ...overrides
  }
}

describe('UNIFIED_HISTORY_SOURCES', () => {
  it('lists all four sources', () => {
    expect(UNIFIED_HISTORY_SOURCES).toEqual(['safari', 'firefox', 'chrome', 'edge'])
  })
})

describe('unifiedSourceMeta', () => {
  it('returns a distinct label/icon/color for every source', () => {
    for (const source of UNIFIED_HISTORY_SOURCES) {
      const meta = unifiedSourceMeta(source)
      expect(meta.label).toBeTruthy()
      expect(meta.icon).toBeTruthy()
      expect(meta.color).toBeTruthy()
    }
  })
})

describe('toUnifiedVisit', () => {
  it('maps the common fields and tags the source as safari', () => {
    const visit = makeSafariVisit()
    expect(toUnifiedVisit(visit, 'safari')).toEqual({
      source: 'safari',
      sourceLabel: 'Safari',
      url: visit.url,
      domain: visit.domain,
      title: visit.title,
      visitTime: visit.visitTime,
      visitCount: visit.visitCount
    })
  })

  it('maps the common fields and tags the source as firefox', () => {
    const visit = makeFirefoxVisit()
    expect(toUnifiedVisit(visit, 'firefox')).toEqual({
      source: 'firefox',
      sourceLabel: 'Firefox',
      url: visit.url,
      domain: visit.domain,
      title: visit.title,
      visitTime: visit.visitTime,
      visitCount: visit.visitCount
    })
  })

  it('tags the source as chrome when given that brand', () => {
    const visit = makeChromiumVisit()
    expect(toUnifiedVisit(visit, 'chrome')).toEqual({
      source: 'chrome',
      sourceLabel: 'Chrome',
      url: visit.url,
      domain: visit.domain,
      title: visit.title,
      visitTime: visit.visitTime,
      visitCount: visit.visitCount
    })
  })

  it('tags the source as edge when given that brand', () => {
    const visit = makeChromiumVisit()
    expect(toUnifiedVisit(visit, 'edge')).toMatchObject({
      source: 'edge',
      sourceLabel: 'Edge'
    })
  })
})
