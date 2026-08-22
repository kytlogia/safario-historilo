import { fileURLToPath } from 'node:url'
import initSqlJs, { type Database } from 'sql.js'

// Safari (Core Data) timestamps are seconds since 2001-01-01T00:00:00Z — kept
// in sync with app/utils/parseHistoryDatabase.ts for readable fixture data.
export const CORE_DATA_EPOCH_OFFSET_SECONDS = 978307200

export interface SampleHistoryItem {
  id: number
  url: string
  visitCount?: number
  domainExpansion?: string | null
  statusCode?: number
}

export interface SampleHistoryVisit {
  id: number
  historyItem: number
  visitTime: number
  title?: string | null
  loadSuccessful?: boolean
  httpNonGet?: boolean
  synthesized?: boolean
  redirectSource?: number | null
  redirectDestination?: number | null
  origin?: number
  generation?: number
  attributes?: number
  score?: number
}

export interface SampleHistoryData {
  items: SampleHistoryItem[]
  visits: SampleHistoryVisit[]
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

export async function createHistoryDatabase(data: SampleHistoryData): Promise<Database> {
  const SQL = await loadNodeSqlJs()
  const db = new SQL.Database()

  db.run(`
    CREATE TABLE history_items (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      domain_expansion TEXT,
      visit_count INTEGER NOT NULL DEFAULT 0,
      status_code INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE history_visits (
      id INTEGER PRIMARY KEY,
      history_item INTEGER NOT NULL,
      visit_time REAL NOT NULL,
      title TEXT,
      load_successful INTEGER NOT NULL DEFAULT 1,
      http_non_get INTEGER NOT NULL DEFAULT 0,
      synthesized INTEGER NOT NULL DEFAULT 0,
      redirect_source INTEGER,
      redirect_destination INTEGER,
      origin INTEGER NOT NULL DEFAULT 0,
      generation INTEGER NOT NULL DEFAULT 0,
      attributes INTEGER NOT NULL DEFAULT 0,
      score REAL NOT NULL DEFAULT 0
    );
  `)

  const insertItem = db.prepare(
    `INSERT INTO history_items (id, url, domain_expansion, visit_count, status_code)
     VALUES (:id, :url, :domain_expansion, :visit_count, :status_code)`
  )
  for (const item of data.items) {
    insertItem.run({
      ':id': item.id,
      ':url': item.url,
      ':domain_expansion': item.domainExpansion ?? null,
      ':visit_count': item.visitCount ?? 1,
      ':status_code': item.statusCode ?? 200
    })
  }
  insertItem.free()

  const insertVisit = db.prepare(
    `INSERT INTO history_visits (
       id, history_item, visit_time, title, load_successful, http_non_get,
       synthesized, redirect_source, redirect_destination, origin, generation,
       attributes, score
     ) VALUES (
       :id, :history_item, :visit_time, :title, :load_successful, :http_non_get,
       :synthesized, :redirect_source, :redirect_destination, :origin, :generation,
       :attributes, :score
     )`
  )
  for (const visit of data.visits) {
    insertVisit.run({
      ':id': visit.id,
      ':history_item': visit.historyItem,
      ':visit_time': visit.visitTime,
      ':title': visit.title ?? null,
      ':load_successful': bool(visit.loadSuccessful, true),
      ':http_non_get': bool(visit.httpNonGet, false),
      ':synthesized': bool(visit.synthesized, false),
      ':redirect_source': visit.redirectSource ?? null,
      ':redirect_destination': visit.redirectDestination ?? null,
      ':origin': visit.origin ?? 0,
      ':generation': visit.generation ?? 0,
      ':attributes': visit.attributes ?? 0,
      ':score': visit.score ?? 0
    })
  }
  insertVisit.free()

  return db
}

/** A small but varied dataset: a normal visit, a failed load, a redirect pair, and a synthesized entry. */
export const SAMPLE_HISTORY_DATA: SampleHistoryData = {
  items: [
    {
      id: 1,
      url: 'https://www.example.com/',
      visitCount: 5,
      domainExpansion: null,
      statusCode: 200
    },
    { id: 2, url: 'https://blog.example.org/posts/1', visitCount: 2, statusCode: 200 },
    { id: 3, url: 'https://broken.example.net/missing', visitCount: 1, statusCode: 404 },
    { id: 4, url: 'https://redirected.example.com/old', visitCount: 1, statusCode: 301 }
  ],
  visits: [
    {
      id: 101,
      historyItem: 1,
      visitTime: 700000000,
      title: 'Example Domain',
      loadSuccessful: true
    },
    {
      id: 102,
      historyItem: 2,
      visitTime: 700003600,
      title: 'Blog Post One',
      loadSuccessful: true,
      synthesized: true
    },
    {
      id: 103,
      historyItem: 3,
      visitTime: 700007200,
      title: null,
      loadSuccessful: false
    },
    {
      id: 104,
      historyItem: 4,
      visitTime: 700010800,
      title: 'Old Page (redirected)',
      loadSuccessful: true,
      redirectSource: 104,
      redirectDestination: 105
    }
  ]
}

export async function createSampleHistoryDatabase(): Promise<Database> {
  return createHistoryDatabase(SAMPLE_HISTORY_DATA)
}

export async function createSampleHistoryDatabaseBytes(): Promise<Uint8Array> {
  const db = await createSampleHistoryDatabase()
  try {
    return db.export()
  } finally {
    db.close()
  }
}
