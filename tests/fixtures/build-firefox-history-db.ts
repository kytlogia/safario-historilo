import { fileURLToPath } from 'node:url'
import initSqlJs, { type Database } from 'sql.js'

export interface SamplePlace {
  id: number
  url: string
  title?: string | null
  visitCount?: number
  hidden?: boolean
  typed?: boolean
  frecency?: number
  guid?: string
}

export interface SampleVisit {
  id: number
  placeId: number
  visitDate: number
  visitType?: number
  fromVisit?: number | null
  session?: number
}

export interface SamplePlacesData {
  places: SamplePlace[]
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

export async function createFirefoxHistoryDatabase(data: SamplePlacesData): Promise<Database> {
  const SQL = await loadNodeSqlJs()
  const db = new SQL.Database()

  db.run(`
    CREATE TABLE moz_places (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT,
      visit_count INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      typed INTEGER NOT NULL DEFAULT 0,
      frecency INTEGER NOT NULL DEFAULT 0,
      guid TEXT
    );
    CREATE TABLE moz_historyvisits (
      id INTEGER PRIMARY KEY,
      from_visit INTEGER NOT NULL DEFAULT 0,
      place_id INTEGER NOT NULL,
      visit_date INTEGER NOT NULL,
      visit_type INTEGER NOT NULL DEFAULT 1,
      session INTEGER NOT NULL DEFAULT 0
    );
  `)

  const insertPlace = db.prepare(
    `INSERT INTO moz_places (id, url, title, visit_count, hidden, typed, frecency, guid)
     VALUES (:id, :url, :title, :visit_count, :hidden, :typed, :frecency, :guid)`
  )
  for (const place of data.places) {
    insertPlace.run({
      ':id': place.id,
      ':url': place.url,
      ':title': place.title ?? null,
      ':visit_count': place.visitCount ?? 1,
      ':hidden': bool(place.hidden, false),
      ':typed': bool(place.typed, false),
      ':frecency': place.frecency ?? 100,
      ':guid': place.guid ?? `guid-${place.id}`
    })
  }
  insertPlace.free()

  const insertVisit = db.prepare(
    `INSERT INTO moz_historyvisits (id, from_visit, place_id, visit_date, visit_type, session)
     VALUES (:id, :from_visit, :place_id, :visit_date, :visit_type, :session)`
  )
  for (const visit of data.visits) {
    insertVisit.run({
      ':id': visit.id,
      ':from_visit': visit.fromVisit ?? 0,
      ':place_id': visit.placeId,
      ':visit_date': visit.visitDate,
      ':visit_type': visit.visitType ?? 1,
      ':session': visit.session ?? 0
    })
  }
  insertVisit.free()

  return db
}

/** A small but varied dataset: a normal visit, a typed visit, a redirect, and a hidden entry. */
export const SAMPLE_PLACES_DATA: SamplePlacesData = {
  places: [
    { id: 1, url: 'https://www.example.com/', title: 'Example Domain', visitCount: 5 },
    { id: 2, url: 'https://blog.example.org/posts/1', title: 'Blog Post One', typed: true },
    { id: 3, url: 'https://hidden.example.net/tracker', title: null, hidden: true },
    { id: 4, url: 'https://redirected.example.com/old', title: 'Old Page' }
  ],
  visits: [
    { id: 101, placeId: 1, visitDate: 1700000000000000, visitType: 1 },
    { id: 102, placeId: 2, visitDate: 1700003600000000, visitType: 2 },
    { id: 103, placeId: 3, visitDate: 1700007200000000, visitType: 4 },
    { id: 104, placeId: 4, visitDate: 1700010800000000, visitType: 5, fromVisit: 104 }
  ]
}

export async function createSampleFirefoxHistoryDatabase(): Promise<Database> {
  return createFirefoxHistoryDatabase(SAMPLE_PLACES_DATA)
}
