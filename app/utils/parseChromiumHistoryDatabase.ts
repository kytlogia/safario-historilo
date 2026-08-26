import type { Database } from 'sql.js'
import type { ChromiumHistoryVisit, ParsedChromiumHistory } from '~/types/history'
import { PARSER_MESSAGES, WORKER_CRASH_MESSAGES } from './workerLocaleMessages'
import { coreTransitionType } from './chromiumVisitType'
import { extractDomain, getSqlJs, getTableColumns, LocalizedParseError, toBool } from './sqlJs'

// See the equivalent comment in parseHistoryDatabase.ts — this file runs
// inside chromiumHistoryDatabase.worker.ts, so it can't use vue-i18n either.
const MESSAGES = PARSER_MESSAGES.chromium

// Chrome/Edge (WebKit epoch) timestamps in visits.visit_time and
// urls.last_visit_time are microseconds since 1601-01-01T00:00:00Z — the
// number of seconds between that and the Unix epoch (1970-01-01) is
// 11644473600.
//
// Real values (~1.3e16+ for any modern date) already exceed
// Number.MAX_SAFE_INTEGER (~9e15), so this arithmetic is done in BigInt
// throughout rather than via `Number(visit_time)`, which would round the
// 64-bit SQLite integer as soon as it crossed into a JS double.
const MICROSECONDS_PER_MILLISECOND = 1000n
const WEBKIT_EPOCH_OFFSET_MICROSECONDS = 11644473600n * 1_000_000n

// PAGE_TRANSITION_TYPED — see chromiumVisitType.ts for the full transition
// type table.
const CORE_TRANSITION_TYPED = 1

const REQUIRED_COLUMNS: Record<string, string[]> = {
  urls: ['id', 'url', 'title', 'visit_count', 'typed_count', 'hidden'],
  visits: ['id', 'url', 'visit_time', 'from_visit', 'transition', 'visit_duration']
}

function assertHistorySchema(db: Database, locale: AppLocale) {
  const messages = MESSAGES[locale]
  // sql.js's `SQL.Database` constructor accepts arbitrary bytes and doesn't
  // validate the SQLite file header — it only fails lazily on the first query
  // that actually touches the page structure, which is this one. Map that
  // failure to the same friendly message the constructor's own try/catch
  // covers, instead of letting a raw sql.js error reach the user.
  let tables: ReturnType<Database['exec']>
  try {
    tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('urls', 'visits')"
    )
  } catch {
    throw new LocalizedParseError(messages.openFailed)
  }
  const found = new Set((tables[0]?.values ?? []).map((row) => String(row[0])))
  if (!found.has('urls') || !found.has('visits')) {
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
// mirroring app/utils/parseFirefoxHistoryDatabase.ts's structure for
// Chrome/Edge's schema. Shared by both brands since Chrome and Edge are both
// Chromium-based and use an identical `urls`/`visits` schema. Runs either
// directly on the main thread (Node/test environments without Worker
// support) or inside chromiumHistoryDatabase.worker.ts.
export async function parseChromiumHistoryBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  locale: AppLocale = 'ja'
): Promise<ParsedChromiumHistory> {
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
        v.id                          AS visit_id,
        u.id                          AS url_id,
        u.url                         AS url,
        u.title                       AS title,
        CAST(v.visit_time AS TEXT)    AS visit_time,
        u.visit_count                 AS visit_count,
        u.typed_count                 AS typed_count,
        v.transition                  AS transition,
        v.from_visit                  AS from_visit,
        v.visit_duration              AS visit_duration,
        u.hidden                      AS hidden
      FROM visits v
      JOIN urls u ON v.url = u.id
      ORDER BY v.visit_time DESC
    `)

    // The urls/visits JOIN repeats each distinct URL once per visit to it
    // (a typical History has several visits per URL), so extractDomain()
    // (URL parsing + a try/catch) is cached per url_id instead of re-run for
    // every row that shares the same URL.
    const domainByUrlId = new Map<number, string>()
    function domainForUrl(urlId: number, url: string): string {
      let domain = domainByUrlId.get(urlId)
      if (domain === undefined) {
        domain = extractDomain(url)
        domainByUrlId.set(urlId, domain)
      }
      return domain
    }

    const rows = result[0]?.values ?? []
    const visits: ChromiumHistoryVisit[] = rows.map((row) => {
      const [
        visitId,
        urlId,
        url,
        title,
        visitTimeRaw,
        visitCount,
        typedCount,
        transition,
        fromVisit,
        visitDuration,
        hidden
      ] = row

      // visit_time comes through as an exact decimal string (see the CAST in
      // the query above), so BigInt() parses it without ever routing the
      // 64-bit value through a JS Number first.
      const visitTimeRawStr = String(visitTimeRaw ?? '0')
      const rawMicroseconds = BigInt(visitTimeRawStr)
      const urlIdNum = Number(urlId)
      const urlStr = String(url ?? '')
      const fromVisitNum = Number(fromVisit ?? 0)
      const transitionNum = Number(transition ?? 0)

      return {
        visitId: Number(visitId),
        urlId: urlIdNum,
        url: urlStr,
        domain: domainForUrl(urlIdNum, urlStr),
        title: title ? String(title) : MESSAGES[locale].noTitle,
        // The millisecond count Date() needs is always far below
        // Number.MAX_SAFE_INTEGER even for the BigInt division result, so
        // converting only at this last step loses no precision.
        visitTime: new Date(
          Number(
            (rawMicroseconds - WEBKIT_EPOCH_OFFSET_MICROSECONDS) / MICROSECONDS_PER_MILLISECOND
          )
        ),
        visitTimeRaw: visitTimeRawStr,
        visitCount: Number(visitCount ?? 0),
        typedCount: Number(typedCount ?? 0),
        transition: transitionNum,
        fromVisit: fromVisitNum === 0 ? null : fromVisitNum,
        visitDuration: Number(visitDuration ?? 0),
        hidden: toBool(hidden),
        // urls.typed_count is a URL-level aggregate ("how many times has this
        // URL ever been typed"), not a per-visit flag — using it directly
        // here would misreport every visit to a URL as "typed" once that URL
        // was ever typed on any visit. The transition's own core type is
        // Chromium's per-visit signal for "this specific visit was a typed
        // navigation" (see chromiumVisitType.ts), which is what a detail
        // view or export for one visit should reflect.
        typed: coreTransitionType(transitionNum) === CORE_TRANSITION_TYPED
      }
    })

    return { visits, fileName }
  } catch (err) {
    // See the equivalent comment in parseHistoryDatabase.ts — assertHistorySchema()'s
    // known failure branches already throw a friendly, localized
    // LocalizedParseError; anything else here is a raw sql.js/SQLite internal
    // error from an openable-but-internally-corrupt file.
    if (err instanceof LocalizedParseError) throw err
    console.error(err)
    throw new Error(WORKER_CRASH_MESSAGES.chromium[locale], { cause: err })
  } finally {
    db.close()
  }
}
