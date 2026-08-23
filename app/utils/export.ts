import type { ChromiumHistoryVisit, FirefoxHistoryVisit, HistoryVisit } from '~/types/history'

function downloadBlob(content: BlobPart, mimeType: string, fileName: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportVisitsAsJson(visits: HistoryVisit[], fileName = 'safari-history.json') {
  downloadBlob(JSON.stringify(visits, null, 2), 'application/json', fileName)
}

export function exportVisitsAsCsv(visits: HistoryVisit[], fileName = 'safari-history.csv') {
  const headers = [
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
  ] as const

  const escapeCell = (value: unknown) => {
    const str = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const lines = [headers.join(',')]
  for (const visit of visits) {
    lines.push(
      [
        visit.visitId,
        visit.title,
        visit.url,
        visit.domain,
        visit.visitTime.toISOString(),
        visit.visitCount,
        visit.loadSuccessful,
        visit.httpNonGet,
        visit.synthesized,
        visit.redirectSource ?? '',
        visit.redirectDestination ?? '',
        visit.origin,
        visit.statusCode
      ]
        .map(escapeCell)
        .join(',')
    )
  }

  downloadBlob('﻿' + lines.join('\n'), 'text/csv;charset=utf-8', fileName)
}

export function exportFirefoxVisitsAsJson(
  visits: FirefoxHistoryVisit[],
  fileName = 'firefox-history.json'
) {
  downloadBlob(JSON.stringify(visits, null, 2), 'application/json', fileName)
}

export function exportFirefoxVisitsAsCsv(
  visits: FirefoxHistoryVisit[],
  fileName = 'firefox-history.csv'
) {
  const headers = [
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
  ] as const

  const escapeCell = (value: unknown) => {
    const str = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const lines = [headers.join(',')]
  for (const visit of visits) {
    lines.push(
      [
        visit.visitId,
        visit.title,
        visit.url,
        visit.domain,
        visit.visitTime.toISOString(),
        visit.visitCount,
        visit.visitType,
        visit.fromVisit ?? '',
        visit.session,
        visit.hidden,
        visit.typed,
        visit.frecency
      ]
        .map(escapeCell)
        .join(',')
    )
  }

  downloadBlob('﻿' + lines.join('\n'), 'text/csv;charset=utf-8', fileName)
}

export function exportChromiumVisitsAsJson(
  visits: ChromiumHistoryVisit[],
  fileName = 'chromium-history.json'
) {
  downloadBlob(JSON.stringify(visits, null, 2), 'application/json', fileName)
}

export function exportChromiumVisitsAsCsv(
  visits: ChromiumHistoryVisit[],
  fileName = 'chromium-history.csv'
) {
  const headers = [
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
  ] as const

  const escapeCell = (value: unknown) => {
    const str = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const lines = [headers.join(',')]
  for (const visit of visits) {
    lines.push(
      [
        visit.visitId,
        visit.title,
        visit.url,
        visit.domain,
        visit.visitTime.toISOString(),
        visit.visitCount,
        visit.typedCount,
        visit.transition,
        visit.fromVisit ?? '',
        visit.visitDuration,
        visit.hidden,
        visit.typed
      ]
        .map(escapeCell)
        .join(',')
    )
  }

  downloadBlob('﻿' + lines.join('\n'), 'text/csv;charset=utf-8', fileName)
}
