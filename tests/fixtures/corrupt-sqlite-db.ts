/**
 * Corrupts an in-memory SQLite export to simulate an openable-but-internally-
 * corrupt file (bad pages, a corrupt index, etc.) — as opposed to a missing
 * table or column, which the various assertXSchema() functions already
 * reject with their own friendly messages. Used by the
 * useXHistoryParser.test.ts suites to exercise the "normalizes an unexpected
 * sql.js error" path (issue #111).
 *
 * Reads the actual page size from the SQLite file header instead of assuming
 * SQLite's 4096-byte default, and scribbles over every page after the first
 * (rather than a single hard-coded "page 2") so this works regardless of how
 * many pages the exported DB has. assertXSchema()'s own checks
 * (sqlite_master / PRAGMA table_info) only ever read page 1, so they still
 * pass; only a query that actually walks a table's b-tree — i.e. the main
 * JOIN query in parseXHistoryBuffer() — hits the corrupted pages and throws.
 */
export function corruptDataPages(bytes: Uint8Array): Uint8Array {
  // SQLite header bytes 16-17 (big-endian) hold the page size; a value of 1
  // is a special case meaning 65536 (the largest allowed page size, which
  // doesn't fit in a 16-bit field). See
  // https://www.sqlite.org/fileformat.html#page_size
  const rawPageSize = ((bytes[16] ?? 0) << 8) | (bytes[17] ?? 0)
  const pageSize = rawPageSize === 1 ? 65536 : rawPageSize

  if (bytes.length <= pageSize) {
    // Nothing past the schema page to corrupt — fail loudly instead of
    // silently exercising the wrong code path.
    throw new Error(
      `corruptDataPages: exported DB is only ${bytes.length} bytes (page size ${pageSize}); there's no data page after the schema page to corrupt`
    )
  }

  const corrupted = new Uint8Array(bytes)
  for (let offset = pageSize; offset < corrupted.length; offset++) {
    corrupted[offset] = 0xaa
  }
  return corrupted
}
