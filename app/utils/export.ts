import type { HistoryVisit } from '~/types/history'

function downloadBlob(content: BlobPart, mimeType: string, fileName: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
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
        escapeCell(visit.title),
        escapeCell(visit.url),
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
