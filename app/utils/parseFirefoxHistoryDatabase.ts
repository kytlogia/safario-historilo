import type { Database } from 'sql.js'
import type { FirefoxHistoryVisit, ParsedFirefoxHistory } from '~/types/history'
import { PARSER_MESSAGES, WORKER_CRASH_MESSAGES } from './workerLocaleMessages'
import {
  extractDomain,
  getSqlJs,
  getTableColumns,
  LocalizedParseError,
  runParse,
  toBool
} from './sqlJs'

// Firefox (Unix epoch) timestamps in moz_historyvisits.visit_date are
// microseconds since 1970-01-01T00:00:00Z.
const MICROSECONDS_PER_MILLISECOND = 1000

// See the equivalent comment in parseHistoryDatabase.ts — this file runs
// inside firefoxHistoryDatabase.worker.ts, so it can't use vue-i18n either.
const MESSAGES = PARSER_MESSAGES.firefox

const REQUIRED_COLUMNS: Record<string, string[]> = {
  moz_places: ['id', 'url', 'title', 'visit_count', 'hidden', 'typed', 'frecency', 'guid'],
  moz_historyvisits: ['id', 'from_visit', 'place_id', 'visit_date', 'visit_type', 'session']
}

function assertPlacesSchema(db: Database, locale: AppLocale) {
  const messages = MESSAGES[locale]
  // sql.js's `SQL.Database` constructor accepts arbitrary bytes and doesn't
  // validate the SQLite file header — it only fails lazily on the first query
  // that actually touches the page structure, which is this one. Map that
  // failure to the same friendly message the constructor's own try/catch
  // covers, instead of letting a raw sql.js error reach the user.
  let tables: ReturnType<Database['exec']>
  try {
    tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('moz_places', 'moz_historyvisits')"
    )
  } catch {
    throw new LocalizedParseError(messages.openFailed)
  }
  const found = new Set((tables[0]?.values ?? []).map((row) => String(row[0])))
  if (!found.has('moz_places') || !found.has('moz_historyvisits')) {
    throw new LocalizedParseError(messages.wrongSchema)
  }

  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const existing = getTableColumns(db, table)
    const missing = columns.filter((column) => !existing.has(column))
    if (missing.length > 0) {
      throw new LocalizedParseError(messages.missingColumns(table, missing.join(', ')))
    }
  }
}

// The actual sql.js parsing work (init, DB open, SQL execution, row mapping),
// mirroring app/utils/parseHistoryDatabase.ts's structure for Firefox's schema.
// Runs either directly on the main thread (Node/test environments without
// Worker support) or inside firefoxHistoryDatabase.worker.ts.
export async function parseFirefoxHistoryBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  locale: AppLocale = 'ja'
): Promise<ParsedFirefoxHistory> {
  const SQL = await getSqlJs()

  let db: Database
  try {
    db = new SQL.Database(new Uint8Array(buffer))
  } catch {
    throw new Error(MESSAGES[locale].openFailed)
  }

  try {
    return runParse(() => {
      assertPlacesSchema(db, locale)

      const result = db.exec(`
      SELECT
        hv.id            AS visit_id,
        p.id             AS place_id,
        p.url            AS url,
        p.title          AS title,
        hv.visit_date    AS visit_date,
        p.visit_count    AS visit_count,
        hv.visit_type    AS visit_type,
        hv.from_visit    AS from_visit,
        hv.session       AS session,
        p.hidden         AS hidden,
        p.frecency       AS frecency,
        p.guid           AS guid
      FROM moz_historyvisits hv
      JOIN moz_places p ON hv.place_id = p.id
      ORDER BY hv.visit_date DESC
    `)

      const rows = result[0]?.values ?? []
      const visits: FirefoxHistoryVisit[] = rows.map((row) => {
        const [
          visitId,
          placeId,
          url,
          title,
          visitDateRaw,
          visitCount,
          visitType,
          fromVisit,
          session,
          hidden,
          frecency,
          guid
        ] = row

        const rawMicroseconds = Number(visitDateRaw ?? 0)
        const urlStr = String(url ?? '')
        const fromVisitNum = Number(fromVisit ?? 0)
        const visitTypeNum = Number(visitType ?? 0)

        return {
          visitId: Number(visitId),
          placeId: Number(placeId),
          url: urlStr,
          domain: extractDomain(urlStr),
          title: title ? String(title) : MESSAGES[locale].noTitle,
          visitTime: new Date(rawMicroseconds / MICROSECONDS_PER_MILLISECOND),
          visitTimeRaw: rawMicroseconds,
          visitCount: Number(visitCount ?? 0),
          visitType: visitTypeNum,
          fromVisit: fromVisitNum === 0 ? null : fromVisitNum,
          session: Number(session ?? 0),
          hidden: toBool(hidden),
          // moz_places.typed is a URL-level flag ("has this URL ever been typed"),
          // not a per-visit one — using it directly here would misreport every
          // visit to a URL (e.g. a plain link click) as "typed" the moment that
          // URL was ever typed once, on any visit. visit_type === 2 is Firefox's
          // own per-visit signal for "this specific visit was a typed
          // navigation", which is what a detail view or export for one visit
          // should reflect.
          typed: visitTypeNum === 2,
          frecency: Number(frecency ?? 0),
          guid: guid ? String(guid) : ''
        }
      })

      return { visits, fileName }
    }, WORKER_CRASH_MESSAGES.firefox[locale])
  } finally {
    db.close()
  }
}
