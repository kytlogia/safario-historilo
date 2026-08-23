import type { Database } from 'sql.js'
import type { ChromiumHistoryVisit, ParsedChromiumHistory } from '~/types/history'
import { coreTransitionType } from './chromiumVisitType'
import { getSqlJs } from './sqlJs'

// Chrome/Edge (WebKit epoch) timestamps in visits.visit_time and
// urls.last_visit_time are microseconds since 1601-01-01T00:00:00Z — the
// number of seconds between that and the Unix epoch (1970-01-01) is
// 11644473600.
const MICROSECONDS_PER_MILLISECOND = 1000
const WEBKIT_EPOCH_OFFSET_MICROSECONDS = 11644473600 * 1_000_000

// PAGE_TRANSITION_TYPED — see chromiumVisitType.ts for the full transition
// type table.
const CORE_TRANSITION_TYPED = 1

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
  urls: ['id', 'url', 'title', 'visit_count', 'typed_count', 'hidden'],
  visits: ['id', 'url', 'visit_time', 'from_visit', 'transition', 'visit_duration']
}

function getTableColumns(db: Database, table: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${table})`)
  return new Set((result[0]?.values ?? []).map((row) => String(row[1])))
}

function assertHistorySchema(db: Database) {
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
    throw new Error(
      'ファイルを開けませんでした。有効なSQLiteデータベースファイルを選択してください。'
    )
  }
  const found = new Set((tables[0]?.values ?? []).map((row) => String(row[0])))
  if (!found.has('urls') || !found.has('visits')) {
    throw new Error(
      'このファイルはChrome/Edgeの履歴データベース(History)ではないようです。urls / visits テーブルが見つかりませんでした。'
    )
  }

  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const existing = getTableColumns(db, table)
    const missing = columns.filter((column) => !existing.has(column))
    if (missing.length > 0) {
      throw new Error(
        `このHistoryのスキーマは対応していません。テーブル "${table}" に想定していた列が見つかりませんでした: ${missing.join(', ')}`
      )
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
  fileName: string
): Promise<ParsedChromiumHistory> {
  const SQL = await getSqlJs()

  let db: Database
  try {
    db = new SQL.Database(new Uint8Array(buffer))
  } catch {
    throw new Error(
      'ファイルを開けませんでした。有効なSQLiteデータベースファイルを選択してください。'
    )
  }

  try {
    assertHistorySchema(db)

    const result = db.exec(`
      SELECT
        v.id              AS visit_id,
        u.id              AS url_id,
        u.url             AS url,
        u.title           AS title,
        v.visit_time      AS visit_time,
        u.visit_count     AS visit_count,
        u.typed_count     AS typed_count,
        v.transition      AS transition,
        v.from_visit      AS from_visit,
        v.visit_duration  AS visit_duration,
        u.hidden          AS hidden
      FROM visits v
      JOIN urls u ON v.url = u.id
      ORDER BY v.visit_time DESC
    `)

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

      const rawMicroseconds = Number(visitTimeRaw ?? 0)
      const urlStr = String(url ?? '')
      const fromVisitNum = Number(fromVisit ?? 0)
      const transitionNum = Number(transition ?? 0)

      return {
        visitId: Number(visitId),
        urlId: Number(urlId),
        url: urlStr,
        domain: extractDomain(urlStr),
        title: title ? String(title) : '(タイトルなし)',
        visitTime: new Date(
          (rawMicroseconds - WEBKIT_EPOCH_OFFSET_MICROSECONDS) / MICROSECONDS_PER_MILLISECOND
        ),
        visitTimeRaw: rawMicroseconds,
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
  } finally {
    db.close()
  }
}
