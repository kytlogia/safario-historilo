import initSqlJs from 'sql.js'

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
