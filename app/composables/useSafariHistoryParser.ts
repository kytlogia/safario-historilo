import initSqlJs, { type Database } from 'sql.js'
import type { HistoryVisit, ParsedHistory } from '~/types/history'

// Safari (Core Data) timestamps are seconds since 2001-01-01T00:00:00Z.
const CORE_DATA_EPOCH_OFFSET_SECONDS = 978307200

let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null

// sql.js (Emscripten) hands whatever locateFile() returns straight to
// fs.readFileSync() when running under Node. A path that only makes sense for the
// browser (root-relative "/sql-wasm.wasm") resolves to nothing on disk there, and
// once that first call aborts, sql.js's module-scope singleton stays aborted for
// every later call in the same process — even ones with a correct locateFile. So
// this must branch on the actual runtime rather than assume a browser.
function resolveWasmLocateFile(): (file: string) => string {
  if (typeof window === 'undefined') {
    const wasmDir = new URL('.', import.meta.resolve('sql.js/dist/sql-wasm.wasm')).href
    return (file) => `${wasmDir}${file}`
  }
  return (file) => `/${file}`
}

function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: resolveWasmLocateFile()
    }).catch((err) => {
      sqlJsPromise = null
      throw err
    })
  }
  return sqlJsPromise
}

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

function assertHistorySchema(db: Database) {
  const tables = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('history_items', 'history_visits')"
  )
  const found = new Set((tables[0]?.values ?? []).map((row) => String(row[0])))
  if (!found.has('history_items') || !found.has('history_visits')) {
    throw new Error(
      'このファイルはSafariの履歴データベース(History.db)ではないようです。history_items / history_visits テーブルが見つかりませんでした。'
    )
  }

  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const existing = getTableColumns(db, table)
    const missing = columns.filter((column) => !existing.has(column))
    if (missing.length > 0) {
      throw new Error(
        `このHistory.dbのスキーマは対応していません。テーブル "${table}" に想定していた列が見つかりませんでした: ${missing.join(', ')}`
      )
    }
  }
}

export async function parseSafariHistoryFile(file: File): Promise<ParsedHistory> {
  const SQL = await getSqlJs()
  const buffer = new Uint8Array(await file.arrayBuffer())

  let db: Database
  try {
    db = new SQL.Database(buffer)
  } catch {
    throw new Error(
      'ファイルを開けませんでした。有効なSQLiteデータベースファイルを選択してください。'
    )
  }

  try {
    assertHistorySchema(db)

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
        title: title ? String(title) : '(タイトルなし)',
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

    return { visits, fileName: file.name }
  } finally {
    db.close()
  }
}
