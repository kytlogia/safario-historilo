import initSqlJs, { type Database } from 'sql.js'

// sql.js (Emscripten) hands whatever locateFile() returns straight to
// fs.readFileSync() when running under Node. A path that only makes sense for the
// browser (root-relative "/sql-wasm.wasm") resolves to nothing on disk there, and
// once that first call aborts, sql.js's module-scope singleton stays aborted for
// every later call in the same process — even ones with a correct locateFile. So
// this must branch on the actual runtime rather than assume a browser.
//
// sql.js itself picks its Node-vs-browser code path via `process.versions.node`
// (dist/sql-wasm.js), not via `window` presence, so checking `window` here would
// disagree with sql.js under e.g. a jsdom test environment (window defined, but
// still Node underneath) — and inside the dedicated Worker this module also runs
// in, `process` is undefined just like in a real browser, so this same check
// resolves the browser branch there too. Match sql.js's own check.
const isNodeRuntime = typeof globalThis.process?.versions?.node === 'string'

let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null

async function resolveWasmLocateFile(): Promise<(file: string) => string> {
  let prefix = '/'
  if (isNodeRuntime) {
    const { fileURLToPath } = await import('node:url')
    prefix = fileURLToPath(new URL('.', import.meta.resolve('sql.js/dist/sql-wasm.wasm')))
  }
  return (file) => `${prefix}${file}`
}

// Shared between app/utils/parseHistoryDatabase.ts (Safari) and
// app/utils/parseFirefoxHistoryDatabase.ts (Firefox) — each runs inside its own
// dedicated Worker module, so this module-scope cache is never actually shared
// across the two at runtime, but the loader logic itself (and the reasoning
// above) is identical for both.
export function getSqlJs() {
  if (!sqlJsPromise) {
    sqlJsPromise = resolveWasmLocateFile()
      .then((locateFile) => initSqlJs({ locateFile }))
      .catch((err) => {
        sqlJsPromise = null
        throw err
      })
  }
  return sqlJsPromise
}

// Row-mapping helpers shared by parseHistoryDatabase.ts (Safari),
// parseFirefoxHistoryDatabase.ts (Firefox), and parseChromiumHistoryDatabase.ts
// (Chrome/Edge) — each browser's schema differs, but extracting a domain from
// a URL string, coercing SQLite's 0/1 integer flags to booleans, and
// introspecting a table's columns via PRAGMA are identical operations
// regardless of which browser's schema is being read.
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

export function toBool(value: unknown): boolean {
  return Number(value) === 1
}

export function getTableColumns(db: Database, table: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${table})`)
  return new Set((result[0]?.values ?? []).map((row) => String(row[1])))
}

// Marks an error whose message is already one of the friendly, localized
// strings from workerLocaleMessages.ts (thrown by an assertXSchema()'s known
// failure branches) — safe to surface to the user as-is. Anything else thrown
// while querying an openable-but-internally-corrupt database (bad pages, a
// corrupt index, etc.) is a raw sql.js/SQLite internal error and must not
// reach the UI unwrapped.
export class LocalizedParseError extends Error {}

// Shared by parseHistoryDatabase.ts (Safari), parseFirefoxHistoryDatabase.ts
// (Firefox), and parseChromiumHistoryDatabase.ts (Chrome/Edge): runs the
// schema assertion + row-mapping query for a single parse. A LocalizedParseError
// (assertXSchema()'s own known failure branches) passes straight through, since
// its message is already safe to show the user as-is. Anything else is an
// unexpected sql.js/SQLite internal error — e.g. from an openable-but-
// internally-corrupt file (bad pages, a corrupt index, etc.) — which must not
// reach the UI as raw, unlocalized text: it's logged for developers via
// console.error and rewrapped as `crashMessage` (each caller's
// WORKER_CRASH_MESSAGES[browser][locale]) instead. Centralized here, rather
// than duplicated per parser, so this "don't leak raw errors" invariant can't
// drift or get missed if a caller forgets to copy it.
export function runParse<T>(fn: () => T, crashMessage: string): T {
  try {
    return fn()
  } catch (err) {
    if (err instanceof LocalizedParseError) throw err
    console.error(err)
    throw new Error(crashMessage, { cause: err })
  }
}
