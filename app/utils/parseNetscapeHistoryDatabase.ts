import type { NetscapeHistoryVisit, ParsedNetscapeHistory } from '~/types/history'
import { PARSER_MESSAGES, WORKER_CRASH_MESSAGES } from './workerLocaleMessages'
// extractDomain/LocalizedParseError/runParse live in sqlJs.ts but are not
// themselves sql.js-specific (see the comments there) — reused as-is so the
// "never leak a raw parser error to the UI" invariant stays in one place,
// even though this parser touches no SQLite at all.
import { extractDomain, LocalizedParseError, runParse } from './sqlJs'

// Netscape Navigator 9 (Gecko 1.8, Firefox 2 era) predates places.sqlite, so
// its history.dat is a Mork database: a line-oriented, mostly-plain-text
// format with a dictionary of column names, a dictionary of interned values
// ("atoms"), and rows referencing both by hex id.
//
//   // <!-- <mdb:mork:z v="1.4"/> -->
//   < <(a=c)> (80=ByteOrder)(81=URL)(85=Name) >   // column dict
//   < (90=LE)(91=http://example.com/) >           // atom dict
//   [1:^80 (^81^91)(^85=Example)]                 // row
//
// Reference implementation cross-checked against File::Mork (CPAN), the
// long-standing Perl reader for exactly this file.
const MESSAGES = PARSER_MESSAGES.netscape

// This parser sits directly on a trust boundary (an arbitrary user-supplied
// upload), so every limit below exists to keep a corrupt or hostile file
// from hanging or OOM-ing the parser worker rather than to reject real
// files: a real history.dat is a few MB and never nests tables at all.
const MAX_INPUT_BYTES = 64 * 1024 * 1024
const MAX_NESTING_DEPTH = 64
// Longest a transaction group marker can legitimately be (`@$$}~abort~<hex>}@`
// is well under 32) — see readGroupMarker(), which bounds its search by this
// so a crafted file can't make marker scanning quadratic.
const MAX_GROUP_MARKER_LENGTH = 256

// Mork's magic comment, e.g. `// <!-- <mdb:mork:z v="1.4"/> -->`. Only the
// stable `<mdb:mork` part is matched so a different minor version still
// loads; searching just the head of the file keeps a wrong-file rejection
// from scanning megabytes first.
const MORK_MAGIC = '<mdb:mork'
const MORK_MAGIC_SEARCH_LENGTH = 512

/** Shown in the "missing column" error — Netscape's history file name. */
const NETSCAPE_FILE_NAME = 'history.dat'

const COLUMN_URL = 'URL'
const COLUMN_NAME = 'Name'
const COLUMN_HOSTNAME = 'Hostname'
const COLUMN_REFERRER = 'Referrer'
const COLUMN_LAST_VISIT_DATE = 'LastVisitDate'
const COLUMN_FIRST_VISIT_DATE = 'FirstVisitDate'
const COLUMN_VISIT_COUNT = 'VisitCount'
const COLUMN_HIDDEN = 'Hidden'
const COLUMN_TYPED = 'Typed'
const COLUMN_BYTE_ORDER = 'ByteOrder'

// Mozilla's PRTime — microseconds since the Unix epoch, same unit as
// Firefox's moz_historyvisits.visit_date.
const MICROSECONDS_PER_MILLISECOND = 1000

type MorkByteOrder = 'LE' | 'BE'

/** A row cell is either an inline literal (`=text`) or an atom ref (`^id`). */
type MorkCellValue = { kind: 'literal'; text: string } | { kind: 'atom'; id: string }

export interface MorkDocument {
  /** hex id -> column name, from the `<(a=c)>`-tagged dictionary. */
  columns: Map<string, string>
  /** hex id -> raw (still-escaped) value text, from the value dictionary. */
  atoms: Map<string, string>
  /** row id -> (column id or literal column name) -> cell value. */
  rows: Map<string, Map<string, MorkCellValue>>
}

function isSpace(charCode: number): boolean {
  return charCode === 32 || charCode === 9 || charCode === 10 || charCode === 13
}

/**
 * Strips the `:scope` suffix Mork appends to ids (`^A3:c`, `1:^80`) and any
 * surrounding whitespace. Deliberately does not change case: ids are
 * consistent within one file, and the same function also normalizes literal
 * column names (`Name`), which are case-sensitive.
 */
function normalizeId(raw: string): string {
  const colon = raw.indexOf(':')
  return (colon === -1 ? raw : raw.slice(0, colon)).trim()
}

/**
 * Scans one Mork document. Every loop here is written so each iteration
 * either consumes at least one character or returns — the format is far too
 * loose to reject unknown constructs outright (that would fail on real
 * files), so unrecognized bytes are skipped rather than treated as an error,
 * and it is the guaranteed forward progress that keeps a malformed upload
 * from looping forever.
 */
class MorkScanner {
  private pos = 0
  private readonly length: number
  private readonly doc: MorkDocument = { columns: new Map(), atoms: new Map(), rows: new Map() }

  constructor(private readonly text: string) {
    this.length = text.length
  }

  parse(): MorkDocument {
    while (this.pos < this.length) {
      const before = this.pos
      this.skipTrivia()
      if (this.pos >= this.length) break

      const ch = this.text[this.pos]
      if (ch === '<') this.readDict()
      else if (ch === '[') this.readRow()
      else if (ch === '{') this.readTable(0)
      else if (ch === '@') this.readGroupMarker()
      else this.pos++

      // Backstop for the forward-progress invariant above: unreachable
      // today, but it turns a future editing mistake into a reported parse
      // failure instead of a hung worker.
      if (this.pos <= before) throw new Error('Mork parser made no progress')
    }
    return this.doc
  }

  private skipTrivia() {
    for (;;) {
      while (this.pos < this.length && isSpace(this.text.charCodeAt(this.pos))) this.pos++
      if (this.text.startsWith('//', this.pos)) {
        const newline = this.text.indexOf('\n', this.pos)
        this.pos = newline === -1 ? this.length : newline + 1
        continue
      }
      return
    }
  }

  /**
   * Reads raw cell text up to (not past) the first unescaped character in
   * `stops`, keeping backslash escapes intact for decodeMorkValue(). An
   * empty terminator means end of input.
   */
  private readToken(stops: string): { raw: string; terminator: string } {
    let raw = ''
    while (this.pos < this.length) {
      const ch = this.text[this.pos]!
      if (ch === '\\') {
        // A backslash escapes whatever follows — including `)`, which must
        // not be mistaken for the end of the cell.
        raw += this.text.slice(this.pos, this.pos + 2)
        this.pos += 2
        continue
      }
      if (stops.includes(ch)) return { raw, terminator: ch }
      raw += ch
      this.pos++
    }
    return { raw, terminator: '' }
  }

  private readCell(onCell: (key: string, value: MorkCellValue) => void) {
    this.pos++ // '('
    this.skipTrivia()
    // A leading '-' (cut) or '+' (add) marks how an update applies to an
    // existing row; both are treated as a plain assignment here, since rows
    // are merged in file order anyway.
    while (this.pos < this.length && (this.text[this.pos] === '-' || this.text[this.pos] === '+')) {
      this.pos++
    }
    if (this.text[this.pos] === '^') this.pos++

    const key = this.readToken('=^)')
    const keyId = normalizeId(key.raw)

    if (key.terminator === '=') {
      this.pos++
      const value = this.readToken(')')
      if (value.terminator === ')') this.pos++
      onCell(keyId, { kind: 'literal', text: value.raw })
      return
    }
    if (key.terminator === '^') {
      this.pos++
      const value = this.readToken(')')
      if (value.terminator === ')') this.pos++
      onCell(keyId, { kind: 'atom', id: normalizeId(value.raw) })
      return
    }
    if (key.terminator === ')') {
      this.pos++
      onCell(keyId, { kind: 'literal', text: '' })
    }
    // Anything else is end of input: the file is truncated, so keep what has
    // been read so far rather than discarding the whole history.
  }

  private readCellsUntil(closer: string, onCell: (key: string, value: MorkCellValue) => void) {
    for (;;) {
      this.skipTrivia()
      if (this.pos >= this.length) return
      const ch = this.text[this.pos]
      if (ch === closer) {
        this.pos++
        return
      }
      if (ch === '(') {
        this.readCell(onCell)
        continue
      }
      this.pos++
    }
  }

  private readDict() {
    this.pos++ // '<'
    this.skipTrivia()

    // An optional nested meta-dict tags what this dictionary holds: `(a=c)`
    // means "atom scope c", i.e. the column-name dictionary. Anything else
    // (or no meta-dict at all) is the value/atom dictionary.
    let isColumnDict = false
    if (this.text[this.pos] === '<') {
      this.pos++
      const meta = new Map<string, string>()
      this.readCellsUntil('>', (key, value) => {
        if (value.kind === 'literal') meta.set(key, value.text)
      })
      isColumnDict = meta.get('a') === 'c'
    }

    const target = isColumnDict ? this.doc.columns : this.doc.atoms
    this.readCellsUntil('>', (key, value) => {
      if (value.kind === 'literal') target.set(key, value.text)
    })
  }

  private readRow() {
    this.pos++ // '['
    this.skipTrivia()
    while (
      this.pos < this.length &&
      (this.text[this.pos] === '-' || this.text[this.pos] === '+' || this.text[this.pos] === '!')
    ) {
      this.pos++
    }

    let id = ''
    while (this.pos < this.length) {
      const ch = this.text[this.pos]!
      if (ch === '(' || ch === ']' || isSpace(ch.charCodeAt(0))) break
      id += ch
      this.pos++
    }

    const rowId = normalizeId(id)
    // Rows are merged by id in file order (later cells win) rather than
    // replayed as transactions — see readGroupMarker().
    const existing = this.doc.rows.get(rowId)
    const cells = existing ?? new Map<string, MorkCellValue>()
    if (!existing) this.doc.rows.set(rowId, cells)
    this.readCellsUntil(']', (key, value) => cells.set(key, value))
  }

  private readTable(depth: number) {
    this.pos++ // '{'
    // Beyond the depth limit the table's braces are simply not tracked any
    // more; its rows still get picked up by the top-level loop, and the
    // recursion can't blow the stack on a hostile file.
    if (depth >= MAX_NESTING_DEPTH) return

    for (;;) {
      this.skipTrivia()
      if (this.pos >= this.length) return
      const ch = this.text[this.pos]
      if (ch === '}') {
        this.pos++
        return
      }
      if (ch === '[') {
        this.readRow()
        continue
      }
      if (ch === '{') {
        this.readTable(depth + 1)
        continue
      }
      if (ch === '(') {
        // Table metadata (`{(k=v)}`) — irrelevant to the history rows.
        this.readCell(() => {})
        continue
      }
      this.pos++
    }
  }

  /**
   * Skips a transaction group marker: `@$${1F{@` (begin), `@$$}1F}@`
   * (commit), `@$$}~abort~1F}@` (abort).
   *
   * ponytail: group contents are parsed inline and an *aborted* group is
   * therefore applied instead of rolled back. Buffering each group to
   * support rollback would roughly double this parser for a case that only
   * arises when Netscape crashed mid-write, and the worst outcome is one
   * stale row.
   */
  private readGroupMarker() {
    this.pos++ // '@'
    if (!this.text.startsWith('$$', this.pos)) return

    // The terminator is searched for only within a bounded window, never to
    // the end of the file. A real marker is a couple of dozen characters at
    // most, but an unterminated `@$$` made each occurrence scan all the
    // remaining text — so an upload full of them (`'@$$}@'.repeat(n) + '{@'`)
    // cost O(n^2) and could tie the parser worker up for minutes without
    // ever tripping the forward-progress guard.
    const window = this.text.slice(this.pos, this.pos + MAX_GROUP_MARKER_LENGTH)
    const begin = window.indexOf('{@')
    const end = window.indexOf('}@')
    const candidates = [begin, end].filter((index) => index !== -1)
    // No terminator nearby: this isn't a group marker after all. Leave the
    // rest to the caller's skip-one-character path instead of swallowing the
    // remainder of the file.
    if (candidates.length === 0) return
    this.pos += Math.min(...candidates) + 2
  }
}

const HEX_PAIR_RE = /^[0-9a-fA-F]{2}$/

const UTF8_DECODER = new TextDecoder('utf-8')
const UTF16LE_DECODER = new TextDecoder('utf-16le')
const UTF16BE_DECODER = new TextDecoder('utf-16be')

interface DecodedMorkBytes {
  bytes: Uint8Array
  /**
   * Whether an *unescaped* `$XX` was actually consumed. This has to come
   * from the decode itself rather than from re-matching `/\$[0-9a-f]{2}/`
   * over the raw text: a backslash-escaped dollar (`Save \$50`) looks
   * identical to that pattern but decodes to a literal '$', so testing the
   * raw string would misread ordinary ASCII as UTF-16 and silently mojibake
   * any title or URL containing "$" followed by two hex-ish characters.
   */
  hexilated: boolean
}

/**
 * Resolves Mork's two escape mechanisms into the raw bytes they stand for:
 * `\x` (literal x, and a line continuation when x is a newline) and `$XX`
 * (one hex byte). Unescaped line breaks are dropped — no URL or title can
 * legitimately contain one, and a writer that wrapped a long line without a
 * backslash would otherwise leak the break into the value.
 */
function decodeMorkBytes(raw: string): DecodedMorkBytes {
  const bytes: number[] = []
  let hexilated = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (ch === '\\') {
      const next = raw[i + 1]
      if (next === undefined) break
      i++
      if (next === '\n' || next === '\r') continue
      bytes.push(next.charCodeAt(0) & 0xff)
      continue
    }
    if (ch === '$') {
      const hex = raw.slice(i + 1, i + 3)
      if (HEX_PAIR_RE.test(hex)) {
        bytes.push(Number.parseInt(hex, 16))
        hexilated = true
        i += 2
        continue
      }
      // A '$' that isn't followed by a hex pair is a literal '$'.
    }
    if (ch === '\n' || ch === '\r') continue
    bytes.push(ch.charCodeAt(0) & 0xff)
  }
  return { bytes: Uint8Array.from(bytes), hexilated }
}

/**
 * Mozilla hexilates a *whole* value as soon as one character doesn't fit in
 * ASCII, so `Caf$E9$00` style text is one UTF-16 byte sequence in which the
 * unescaped ASCII characters are themselves part of the encoding (each
 * followed by a `$00` low byte). That's why a value that really used a `$XX`
 * escape — see DecodedMorkBytes.hexilated — is decoded as UTF-16 as a whole,
 * in the byte order the file's own ByteOrder cell declares.
 */
function decodeMorkValue(raw: string, byteOrder: MorkByteOrder | null): string {
  const { bytes, hexilated } = decodeMorkBytes(raw)
  if (!hexilated) return UTF8_DECODER.decode(bytes)
  return byteOrder === 'BE' ? UTF16BE_DECODER.decode(bytes) : UTF16LE_DECODER.decode(bytes)
}

/** Byte-for-byte string view of the upload, so `$XX` escapes stay exact. */
function toBinaryString(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let out = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return out
}

/** row id -> column name -> raw (still-escaped) value text. */
type ResolvedRows = Map<string, Map<string, string>>

function resolveRows(doc: MorkDocument): ResolvedRows {
  const resolved: ResolvedRows = new Map()
  for (const [rowId, cells] of doc.rows) {
    const row = new Map<string, string>()
    for (const [key, value] of cells) {
      // A cell key is normally a hex column id; a Mork writer may also spell
      // the column name out inline, in which case there's nothing to look up.
      const column = doc.columns.get(key) ?? key
      row.set(column, value.kind === 'literal' ? value.text : (doc.atoms.get(value.id) ?? ''))
    }
    resolved.set(rowId, row)
  }
  return resolved
}

/**
 * The ByteOrder cell is what tells UTF-16 values apart from each other, and
 * it is itself plain ASCII ("LE"/"BE") — so it can be decoded without
 * knowing the byte order yet. Defaults to little-endian, which is what every
 * x86 Netscape build wrote.
 */
function detectByteOrder(rows: ResolvedRows): MorkByteOrder {
  for (const row of rows.values()) {
    const raw = row.get(COLUMN_BYTE_ORDER)
    if (raw === undefined) continue
    const text = decodeMorkValue(raw, null).trim().toUpperCase()
    if (text === 'BE' || text === 'LE') return text
  }
  return 'LE'
}

function toNumber(text: string): number {
  const value = Number.parseInt(text, 10)
  return Number.isFinite(value) ? value : 0
}

export function parseMorkDocument(text: string): MorkDocument {
  return new MorkScanner(text).parse()
}

/**
 * The Netscape-specific half: turns a parsed Mork document into visits.
 * Unlike Safari/Firefox/Chromium, history.dat stores one row *per URL*
 * (with FirstVisitDate/LastVisitDate/VisitCount) rather than one row per
 * visit, so each entry's `visitTime` is its last visit.
 */
function toVisits(doc: MorkDocument, noTitle: string): NetscapeHistoryVisit[] {
  const rows = resolveRows(doc)
  const byteOrder = detectByteOrder(rows)

  const visits: NetscapeHistoryVisit[] = []
  for (const [rowId, row] of rows) {
    const read = (column: string) => {
      const raw = row.get(column)
      return raw === undefined ? '' : decodeMorkValue(raw, byteOrder)
    }

    const url = read(COLUMN_URL)
    // Rows without a URL are Netscape's own metadata rows (the ByteOrder
    // row, table headers) rather than history entries.
    if (!url) continue

    const lastVisitRaw = toNumber(read(COLUMN_LAST_VISIT_DATE))
    const firstVisitRaw = toNumber(read(COLUMN_FIRST_VISIT_DATE))
    const title = read(COLUMN_NAME)

    visits.push({
      rowId,
      url,
      domain: extractDomain(url),
      title: title || noTitle,
      visitTime: new Date(lastVisitRaw / MICROSECONDS_PER_MILLISECOND),
      visitTimeRaw: lastVisitRaw,
      firstVisitTime:
        firstVisitRaw > 0 ? new Date(firstVisitRaw / MICROSECONDS_PER_MILLISECOND) : null,
      firstVisitTimeRaw: firstVisitRaw,
      visitCount: toNumber(read(COLUMN_VISIT_COUNT)),
      referrer: read(COLUMN_REFERRER),
      hostname: read(COLUMN_HOSTNAME),
      hidden: read(COLUMN_HIDDEN) === '1',
      typed: read(COLUMN_TYPED) === '1'
    })
  }

  // Mirrors the `ORDER BY visit_date DESC` every other parser here applies.
  visits.sort((a, b) => b.visitTimeRaw - a.visitTimeRaw)
  return visits
}

/**
 * Parses a Netscape Navigator 9 `history.dat` (Mork). Runs either directly
 * on the main thread (Node/test environments without Worker support) or
 * inside historyParser.worker.ts, exactly like the sql.js-based parsers —
 * hence the same locale-map-instead-of-vue-i18n arrangement.
 */
export async function parseNetscapeHistoryBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  locale: AppLocale = 'ja'
): Promise<ParsedNetscapeHistory> {
  const messages = MESSAGES[locale]

  if (buffer.byteLength > MAX_INPUT_BYTES) throw new LocalizedParseError(messages.openFailed)

  const text = toBinaryString(new Uint8Array(buffer))
  if (!text.slice(0, MORK_MAGIC_SEARCH_LENGTH).includes(MORK_MAGIC)) {
    throw new LocalizedParseError(messages.wrongSchema)
  }

  return runParse(() => {
    const doc = parseMorkDocument(text)

    const hasUrlColumn =
      [...doc.columns.values()].includes(COLUMN_URL) ||
      [...doc.rows.values()].some((cells) => cells.has(COLUMN_URL))
    if (!hasUrlColumn) {
      throw new LocalizedParseError(messages.missingColumns(NETSCAPE_FILE_NAME, COLUMN_URL))
    }

    return { visits: toVisits(doc, messages.noTitle), fileName }
  }, WORKER_CRASH_MESSAGES.netscape[locale])
}
