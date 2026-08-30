import type {
  ChromiumHistoryVisit,
  FirefoxHistoryVisit,
  HistoryVisit,
  NetscapeHistoryVisit,
  UnifiedHistoryVisit
} from '~/types/history'
import { useAppSnackbar } from '~/composables/useAppSnackbar'

// Every export* function below funnels through here, so guarding it once is
// enough for all of them (mirrors useAppTheme.ts/useAppLocale.ts, which
// guard localStorage access inside the function that actually touches it
// rather than at each call site) — a future caller of exportVisitsAsJson()
// etc. gets this for free instead of having to remember to wrap its own
// call (#113: new Blob/createObjectURL/DOM manipulation had no error
// handling at all, so a thrown error — memory exhaustion on a large export,
// or a browser/extension blocking Blob URLs — made the export button look
// like it silently did nothing).
function downloadBlob(content: BlobPart, mimeType: string, fileName: string) {
  try {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    // Clears any still-visible error from a previous failed export so a
    // successful retry doesn't leave a stale "エクスポートに失敗しました"
    // toast on screen for the rest of its auto-hide timeout.
    useAppSnackbar().hide()
  } catch (error) {
    console.error(error)
    useAppSnackbar().showError('error.exportFailed')
  }
}

// Shared by every *AsCsv exporter below (Safari/Firefox/Chromium): quotes a
// cell when it contains a comma, double quote, or newline, doubling any
// embedded double quotes, per RFC 4180.
function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

// The leading BOM makes Excel (and other tools that sniff for one) treat the
// file as UTF-8 instead of the system codepage — without it, non-ASCII
// titles/URLs render as mojibake when opened directly.
function toCsv(headers: readonly string[], rows: unknown[][]): string {
  const lines = [headers.join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))]
  return '﻿' + lines.join('\n')
}

function exportAsJson<T>(visits: T[], fileName: string) {
  downloadBlob(JSON.stringify(visits, null, 2), 'application/json', fileName)
}

export function exportVisitsAsJson(visits: HistoryVisit[], fileName = 'safari-history.json') {
  exportAsJson(visits, fileName)
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

  const rows = visits.map((visit) => [
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
  ])

  downloadBlob(toCsv(headers, rows), 'text/csv;charset=utf-8', fileName)
}

export function exportFirefoxVisitsAsJson(
  visits: FirefoxHistoryVisit[],
  fileName = 'firefox-history.json'
) {
  exportAsJson(visits, fileName)
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

  const rows = visits.map((visit) => [
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
  ])

  downloadBlob(toCsv(headers, rows), 'text/csv;charset=utf-8', fileName)
}

export function exportChromiumVisitsAsJson(
  visits: ChromiumHistoryVisit[],
  fileName = 'chromium-history.json'
) {
  exportAsJson(visits, fileName)
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

  const rows = visits.map((visit) => [
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
  ])

  downloadBlob(toCsv(headers, rows), 'text/csv;charset=utf-8', fileName)
}

export function exportNetscapeVisitsAsJson(
  visits: NetscapeHistoryVisit[],
  fileName = 'netscape-history.json'
) {
  exportAsJson(visits, fileName)
}

export function exportNetscapeVisitsAsCsv(
  visits: NetscapeHistoryVisit[],
  fileName = 'netscape-history.csv'
) {
  const headers = [
    'rowId',
    'title',
    'url',
    'domain',
    'visitTime',
    'firstVisitTime',
    'visitCount',
    'referrer',
    'hostname',
    'hidden',
    'typed'
  ] as const

  const rows = visits.map((visit) => [
    visit.rowId,
    visit.title,
    visit.url,
    visit.domain,
    visit.visitTime.toISOString(),
    visit.firstVisitTime?.toISOString() ?? '',
    visit.visitCount,
    visit.referrer,
    visit.hostname,
    visit.hidden,
    visit.typed
  ])

  downloadBlob(toCsv(headers, rows), 'text/csv;charset=utf-8', fileName)
}

export function exportUnifiedVisitsAsJson(
  visits: UnifiedHistoryVisit[],
  fileName = 'unified-history.json'
) {
  exportAsJson(visits, fileName)
}

export function exportUnifiedVisitsAsCsv(
  visits: UnifiedHistoryVisit[],
  fileName = 'unified-history.csv'
) {
  const headers = ['source', 'title', 'url', 'domain', 'visitTime', 'visitCount'] as const

  const rows = visits.map((visit) => [
    visit.source,
    visit.title,
    visit.url,
    visit.domain,
    visit.visitTime.toISOString(),
    visit.visitCount
  ])

  downloadBlob(toCsv(headers, rows), 'text/csv;charset=utf-8', fileName)
}
