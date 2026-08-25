import type { Database } from 'sql.js'
import type { HistoryVisit, ParsedHistory } from '~/types/history'
import { PARSER_MESSAGES } from './workerLocaleMessages'
import { getSqlJs } from './sqlJs'

// Safari (Core Data) timestamps are seconds since 2001-01-01T00:00:00Z.
const CORE_DATA_EPOCH_OFFSET_SECONDS = 978307200

// This module runs inside historyDatabase.worker.ts (a separate execution
// context with no Vue instance), so its error/placeholder text is threaded
// in from the caller (which does have i18n context) via the `locale`
// parameter on parseHistoryBuffer() below, resolved against
// workerLocaleMessages.ts's shared per-locale message maps.
const MESSAGES = PARSER_MESSAGES.safari

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

function toBool(value: unknown): boolean {
  return Number(value) === 1
}

const REQUIRED_COLUMNS: Record<string, string[]> = {
  history_items: ['id', 'url', 'visit_count', 'domain_expansion', 'status_code'],
  history_visits: [
    'id',
    'history_item',
    'visit_time',
    'title',
    'load_successful',
    'http_non_get',
    'synthesized',
    'redirect_source',
    'redirect_destination',
    'origin',
    'generation',
    'attributes',
    'score'
  ]
}

function getTableColumns(db: Database, table: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${table})`)
  return new Set((result[0]?.values ?? []).map((row) => String(row[1])))
}

function assertHistorySchema(db: Database, locale: AppLocale) {
  const messages = MESSAGES[locale]
  // sql.js's `SQL.Database` constructor accepts arbitrary bytes and doesn't
  // validate the SQLite file header — it only fails lazily on the first query
  // that actually touches the page structure, which is this one. Map that
  // failure to the same friendly message the constructor's own try/catch
  // covers, instead of letting a raw sql.js error ("file is not a database")
  // reach the user.
  let tables: ReturnType<Database['exec']>
  try {
    tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('history_items', 'history_visits')"
    )
  } catch {
    throw new Error(messages.openFailed)
  }
  const found = new Set((tables[0]?.values ?? []).map((row) => String(row[0])))
  if (!found.has('history_items') || !found.has('history_visits')) {
    throw new Error(messages.wrongSchema)
  }

  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const existing = getTableColumns(db, table)
    const missing = columns.filter((column) => !existing.has(column))
    if (missing.length > 0) {
      throw new Error(messages.missingColumns(table, missing.join(', ')))
    }
  }
}

// The actual sql.js parsing work (init, DB open, SQL execution, row mapping).
// Runs either directly on the main thread (Node/test environments without
// Worker support) or inside historyDatabase.worker.ts — kept independent of
// both so the same logic and error messages apply either way. `locale`
// selects which of MESSAGES' error strings a caught failure surfaces (see
// useSafariHistoryParser.ts, which threads through the app's currently
// selected locale at call time).
export async function parseHistoryBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  locale: AppLocale = 'ja'
): Promise<ParsedHistory> {
  const SQL = await getSqlJs()

  let db: Database
  try {
    db = new SQL.Database(new Uint8Array(buffer))
  } catch {
    throw new Error(MESSAGES[locale].openFailed)
  }

  try {
    assertHistorySchema(db, locale)

    const result = db.exec(`
      SELECT
        hv.id            AS visit_id,
        hi.id            AS item_id,
        hi.url           AS url,
        hv.title         AS title,
        hv.visit_time    AS visit_time,
        hi.visit_count   AS visit_count,
        hi.domain_expansion AS domain_expansion,
        hi.status_code   AS status_code,
        hv.load_successful  AS load_successful,
        hv.http_non_get     AS http_non_get,
        hv.synthesized      AS synthesized,
        hv.redirect_source      AS redirect_source,
        hv.redirect_destination AS redirect_destination,
        hv.origin        AS origin,
        hv.generation     AS generation,
        hv.attributes     AS attributes,
        hv.score          AS score
      FROM history_visits hv
      JOIN history_items hi ON hv.history_item = hi.id
      ORDER BY hv.visit_time DESC
    `)

    const rows = result[0]?.values ?? []
    const visits: HistoryVisit[] = rows.map((row) => {
      const [
        visitId,
        itemId,
        url,
        title,
        visitTimeRaw,
        visitCount,
        domainExpansion,
        statusCode,
        loadSuccessful,
        httpNonGet,
        synthesized,
        redirectSource,
        redirectDestination,
        origin,
        generation,
        attributes,
        score
      ] = row

      const rawSeconds = Number(visitTimeRaw ?? 0)
      const urlStr = String(url ?? '')

      return {
        visitId: Number(visitId),
        itemId: Number(itemId),
        url: urlStr,
        domain: extractDomain(urlStr),
        title: title ? String(title) : MESSAGES[locale].noTitle,
        visitTime: new Date((rawSeconds + CORE_DATA_EPOCH_OFFSET_SECONDS) * 1000),
        visitTimeRaw: rawSeconds,
        visitCount: Number(visitCount ?? 0),
        domainExpansion: domainExpansion ? String(domainExpansion) : null,
        statusCode: Number(statusCode ?? 0),
        loadSuccessful: toBool(loadSuccessful),
        httpNonGet: toBool(httpNonGet),
        synthesized: toBool(synthesized),
        redirectSource: redirectSource === null ? null : Number(redirectSource),
        redirectDestination: redirectDestination === null ? null : Number(redirectDestination),
        origin: Number(origin ?? 0),
        generation: Number(generation ?? 0),
        attributes: Number(attributes ?? 0),
        score: Number(score ?? 0)
      }
    })

    return { visits, fileName }
  } finally {
    db.close()
  }
}
