import { fileURLToPath } from 'node:url'
import initSqlJs, { type Database } from 'sql.js'

export interface SampleUrl {
  id: number
  url: string
  title?: string | null
  visitCount?: number
  typedCount?: number
  hidden?: boolean
}

export interface SampleVisit {
  id: number
  urlId: number
  visitTime: number
  transition?: number
  fromVisit?: number | null
  visitDuration?: number
}

export interface SampleChromiumData {
  urls: SampleUrl[]
  visits: SampleVisit[]
}

/**
 * Loads sql.js pointed at the real wasm binary shipped in node_modules —
 * only used here to *build* fixture databases directly under Node, so this
 * is unrelated to how the app itself locates the wasm file in the browser.
 */
async function loadNodeSqlJs() {
  const wasmDir = fileURLToPath(new URL('../../node_modules/sql.js/dist/', import.meta.url))
  return initSqlJs({ locateFile: (file) => `${wasmDir}${file}` })
}

function bool(value: boolean | undefined, fallback: boolean) {
  return (value ?? fallback) ? 1 : 0
}

export async function createChromiumHistoryDatabase(data: SampleChromiumData): Promise<Database> {
  const SQL = await loadNodeSqlJs()
  const db = new SQL.Database()

  db.run(`
    CREATE TABLE urls (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT,
      visit_count INTEGER NOT NULL DEFAULT 0,
      typed_count INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE visits (
      id INTEGER PRIMARY KEY,
      url INTEGER NOT NULL,
      visit_time INTEGER NOT NULL,
      from_visit INTEGER NOT NULL DEFAULT 0,
      transition INTEGER NOT NULL DEFAULT 0,
      visit_duration INTEGER NOT NULL DEFAULT 0
    );
  `)

  const insertUrl = db.prepare(
    `INSERT INTO urls (id, url, title, visit_count, typed_count, hidden)
     VALUES (:id, :url, :title, :visit_count, :typed_count, :hidden)`
  )
  for (const url of data.urls) {
    insertUrl.run({
      ':id': url.id,
      ':url': url.url,
      ':title': url.title ?? null,
      ':visit_count': url.visitCount ?? 1,
      ':typed_count': url.typedCount ?? 0,
      ':hidden': bool(url.hidden, false)
    })
  }
  insertUrl.free()

  const insertVisit = db.prepare(
    `INSERT INTO visits (id, url, visit_time, from_visit, transition, visit_duration)
     VALUES (:id, :url, :visit_time, :from_visit, :transition, :visit_duration)`
  )
  for (const visit of data.visits) {
    insertVisit.run({
      ':id': visit.id,
      ':url': visit.urlId,
      ':visit_time': visit.visitTime,
      ':from_visit': visit.fromVisit ?? 0,
      ':transition': visit.transition ?? 0,
      ':visit_duration': visit.visitDuration ?? 0
    })
  }
  insertVisit.free()

  return db
}

// WebKit epoch (1601-01-01 UTC) microseconds corresponding to
// 2023-11-14T22:13:20.000Z (an arbitrary but fixed reference instant), so
// tests can assert the epoch conversion without hardcoding the raw
// microsecond math inline everywhere.
export const SAMPLE_WEBKIT_BASE_TIME = 13_345_469_600_000_000

/** A small but varied dataset: a normal visit, a typed visit, a redirect, and a hidden entry. */
export const SAMPLE_CHROMIUM_DATA: SampleChromiumData = {
  urls: [
    { id: 1, url: 'https://www.example.com/', title: 'Example Domain', visitCount: 5 },
    { id: 2, url: 'https://blog.example.org/posts/1', title: 'Blog Post One', typedCount: 3 },
    { id: 3, url: 'https://hidden.example.net/tracker', title: null, hidden: true },
    { id: 4, url: 'https://redirected.example.com/old', title: 'Old Page' }
  ],
  visits: [
    { id: 101, urlId: 1, visitTime: SAMPLE_WEBKIT_BASE_TIME, transition: 0 },
    { id: 102, urlId: 2, visitTime: SAMPLE_WEBKIT_BASE_TIME + 3_600_000_000, transition: 1 },
    { id: 103, urlId: 3, visitTime: SAMPLE_WEBKIT_BASE_TIME + 7_200_000_000, transition: 3 },
    {
      id: 104,
      urlId: 4,
      visitTime: SAMPLE_WEBKIT_BASE_TIME + 10_800_000_000,
      transition: 0 | 0x40000000,
      fromVisit: 104
    }
  ]
}

export async function createSampleChromiumHistoryDatabase(): Promise<Database> {
  return createChromiumHistoryDatabase(SAMPLE_CHROMIUM_DATA)
}
