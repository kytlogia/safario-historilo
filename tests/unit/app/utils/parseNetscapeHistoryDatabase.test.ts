import { describe, expect, it, vi } from 'vitest'
import { parseMorkDocument, parseNetscapeHistoryBuffer } from '~/utils/parseNetscapeHistoryDatabase'

const MORK_HEADER = '// <!-- <mdb:mork:z v="1.4"/> -->\n'

// A minimal but realistic Netscape 9 history.dat: the `(a=c)`-tagged column
// dictionary, the value dictionary, a metadata table holding the ByteOrder
// row, and two history rows (one fully atomized, one with inline literals).
const COLUMN_DICT =
  '< <(a=c)>(80=ByteOrder)(81=URL)(82=Name)(83=Hostname)(84=Referrer)' +
  '(85=LastVisitDate)(86=FirstVisitDate)(87=VisitCount)(88=Typed)(89=Hidden)>\n'

const VALUE_DICT =
  '<(90=LE)(91=http://example.com/)(92=example.com)(93=1200000000000000)' +
  '(94=1100000000000000)(95=3)(96=http://referrer.example/)>\n'

const META_TABLE = '{1:^80 {(k^81:c)(s=9)} [1(^80^90)] }\n'

const ROW_ATOMIZED =
  '[2(^81^91)(^82=Example Domain)(^83^92)(^84^96)(^85^93)(^86^94)(^87^95)(^88=1)]\n'

// Title "テスト" hexilated as UTF-16LE, the way Mozilla writes any value that
// doesn't fit in ASCII.
const ROW_HEXILATED =
  '[3(^81=http://example.org/jp)(^82=$C6$30$B9$30$C8$30)(^85=1300000000000000)(^87=1)(^89=1)]\n'

const SAMPLE = MORK_HEADER + COLUMN_DICT + VALUE_DICT + META_TABLE + ROW_ATOMIZED + ROW_HEXILATED

function toBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

function parse(text: string, locale: 'ja' | 'en' | 'zh' = 'ja') {
  return parseNetscapeHistoryBuffer(toBuffer(text), 'history.dat', locale)
}

describe('parseNetscapeHistoryBuffer', () => {
  it('converts a well-formed history.dat into NetscapeHistoryVisit[]', async () => {
    const { visits, fileName } = await parse(SAMPLE)

    expect(fileName).toBe('history.dat')
    // The ByteOrder metadata row carries no URL and is not a history entry.
    expect(visits).toHaveLength(2)
    // Sorted by LastVisitDate DESC, like every other parser here.
    expect(visits.map((v) => v.url)).toEqual(['http://example.org/jp', 'http://example.com/'])
  })

  it('resolves atom references, literals and derived fields', async () => {
    const { visits } = await parse(SAMPLE)
    const visit = visits.find((v) => v.url === 'http://example.com/')!

    expect(visit).toMatchObject({
      rowId: '2',
      title: 'Example Domain',
      domain: 'example.com',
      hostname: 'example.com',
      referrer: 'http://referrer.example/',
      visitCount: 3,
      visitTimeRaw: 1200000000000000,
      firstVisitTimeRaw: 1100000000000000,
      typed: true,
      hidden: false
    })
    // PRTime is microseconds since the Unix epoch.
    expect(visit.visitTime.toISOString()).toBe(new Date(1200000000000).toISOString())
    expect(visit.firstVisitTime?.toISOString()).toBe(new Date(1100000000000).toISOString())
  })

  it('decodes a hexilated ($XX) value as UTF-16 in the declared byte order', async () => {
    const { visits } = await parse(SAMPLE)
    expect(visits.find((v) => v.rowId === '3')?.title).toBe('テスト')
  })

  it('decodes hexilated values as UTF-16BE when ByteOrder says BE', async () => {
    const beSample = SAMPLE.replace('(90=LE)', '(90=BE)').replace(
      '(^82=$C6$30$B9$30$C8$30)',
      '(^82=$30$C6$30$B9$30$C8)'
    )
    const { visits } = await parse(beSample)
    expect(visits.find((v) => v.rowId === '3')?.title).toBe('テスト')
  })

  it('treats unescaped ASCII inside a hexilated value as part of the UTF-16 bytes', async () => {
    // "Aあ" in UTF-16LE is 41 00 42 30 — Mozilla leaves the printable 0x41
    // byte as a literal 'A' and only escapes the rest.
    const sample = SAMPLE.replace('(^82=$C6$30$B9$30$C8$30)', '(^82=A$00$42$30)')
    const { visits } = await parse(sample)
    expect(visits.find((v) => v.rowId === '3')?.title).toBe('Aあ')
  })

  it('unescapes backslash escapes and joins backslash line continuations', async () => {
    const sample = SAMPLE.replace('(^82=Example Domain)', '(^82=Ex\\)am\\\\ple \\\nDomain)')
    const { visits } = await parse(sample)
    expect(visits.find((v) => v.rowId === '2')?.title).toBe('Ex)am\\ple Domain')
  })

  // A backslash-escaped dollar decodes to a literal '$', but matches the
  // /\$[0-9a-fA-F]{2}/ shape that used to decide "this value is UTF-16" —
  // so ordinary ASCII titles and URLs containing "$" were silently mojibake.
  it('treats a backslash-escaped dollar as a literal, not as a UTF-16 marker', async () => {
    const sample = SAMPLE.replace('(^82=Example Domain)', '(^82=Save \\$50 today)')
    const { visits } = await parse(sample)

    expect(visits.find((v) => v.rowId === '2')?.title).toBe('Save $50 today')
  })

  it('keeps a URL containing an escaped dollar intact, including its domain', async () => {
    const sample = SAMPLE.replace(
      '(^81=http://example.org/jp)',
      '(^81=http://example.com/pay?amt=US\\$100)'
    )
    const { visits } = await parse(sample)
    const visit = visits.find((v) => v.rowId === '3')!

    expect(visit.url).toBe('http://example.com/pay?amt=US$100')
    // A mojibake URL would poison extractDomain(), the domain filter and the
    // detail dialog's link alike.
    expect(visit.domain).toBe('example.com')
  })

  it('still decodes a genuinely hexilated value containing no escaped dollar', async () => {
    // Guards the fix from over-correcting: real `$XX` escapes must keep
    // switching the value to UTF-16.
    const { visits } = await parse(SAMPLE)
    expect(visits.find((v) => v.rowId === '3')?.title).toBe('テスト')
  })

  it('merges repeated rows in file order, with later cells winning', async () => {
    const sample = SAMPLE + '[2(^87=42)(^89=1)]\n'
    const { visits } = await parse(sample)
    const visit = visits.find((v) => v.rowId === '2')!

    expect(visit.visitCount).toBe(42)
    expect(visit.hidden).toBe(true)
    // Untouched cells from the earlier row survive the merge.
    expect(visit.title).toBe('Example Domain')
  })

  it('reads rows inside transaction groups and skips the group markers', async () => {
    const sample =
      SAMPLE + '@$${1F{@\n[4(^81=http://grouped.example/)(^85=1400000000000000)]\n@$$}1F}@\n'
    const { visits } = await parse(sample)

    expect(visits.map((v) => v.url)).toContain('http://grouped.example/')
  })

  it('falls back to the localized placeholder when a row has no title', async () => {
    const { visits } = await parse(SAMPLE + '[5(^81=http://untitled.example/)]\n', 'en')
    expect(visits.find((v) => v.rowId === '5')?.title).toBe('(no title)')
  })

  it('ignores comment lines outside values but not "//" inside a URL', async () => {
    const sample = SAMPLE.replace(META_TABLE, '// a stray comment\n' + META_TABLE)
    const { visits } = await parse(sample)
    expect(visits.find((v) => v.rowId === '2')?.url).toBe('http://example.com/')
  })

  describe('malformed input', () => {
    it('rejects a file without the Mork header', async () => {
      await expect(parse('not a mork file at all', 'en')).rejects.toThrow(
        /doesn't look like Netscape's history database/
      )
    })

    it('rejects a Mork file with no URL column', async () => {
      const notHistory = MORK_HEADER + '< <(a=c)>(80=DisplayName)>\n<(90=Bob)>\n[1(^80^90)]\n'
      await expect(parse(notHistory, 'en')).rejects.toThrow(/Expected column\(s\) not found: URL/)
    })

    it('rejects a file larger than the size limit', async () => {
      // Fake the length rather than allocating 64MB of real bytes.
      const oversized = { byteLength: 65 * 1024 * 1024 } as ArrayBuffer
      await expect(parseNetscapeHistoryBuffer(oversized, 'history.dat', 'en')).rejects.toThrow(
        /Could not open the file/
      )
    })

    it.each([
      ['unterminated column dictionary', MORK_HEADER + '< <(a=c)>(81=URL)(82=Name'],
      ['unterminated row', MORK_HEADER + COLUMN_DICT + '[2(^81=http://a.example/'],
      ['unterminated table', MORK_HEADER + COLUMN_DICT + '{1:^80 [2(^81=http://a.example/)]'],
      ['unterminated cell', MORK_HEADER + COLUMN_DICT + '[2(^81'],
      ['unterminated group marker', MORK_HEADER + COLUMN_DICT + '@$${1F'],
      ['stray closing brackets', MORK_HEADER + COLUMN_DICT + ']]}}>>))'],
      ['deeply nested tables', MORK_HEADER + COLUMN_DICT + '{'.repeat(5000)]
    ])('terminates on %s instead of hanging', async (_name, text) => {
      // No assertion on the result beyond "it returns": a truncated file is
      // read as far as it goes (Mork is append-only, so a crash mid-write
      // leaves exactly this), and the contract being tested is that a
      // malformed upload can never spin the parser worker forever.
      await expect(parse(text)).resolves.toBeDefined()
    })

    // Unterminated `@$$` markers used to each scan to the end of the file,
    // making this O(n^2): ~400ms at 500KB, extrapolating to minutes at the
    // multi-MB sizes MAX_INPUT_BYTES allows. Forward progress alone never
    // caught it — the parse finished, just not this century.
    it('scans group markers in linear time on a crafted marker flood', async () => {
      const timeFor = async (repeats: number) => {
        const text = MORK_HEADER + COLUMN_DICT + '@$$}@'.repeat(repeats) + '{@'
        const started = performance.now()
        await parse(text)
        return performance.now() - started
      }

      // Timing ratios are noisy in CI, so this asserts only the shape that
      // separates linear from quadratic: 4x the input must not cost ~16x.
      await timeFor(20000) // warm up, so JIT effects don't skew the first sample
      const small = await timeFor(25000)
      const large = await timeFor(100000)

      expect(large).toBeLessThan(Math.max(small, 5) * 8)
      expect(large).toBeLessThan(5000)
    })

    it('never loops on a pathological repetition of unparsable bytes', async () => {
      const noise = MORK_HEADER + COLUMN_DICT + '^:$&!~'.repeat(200000)
      const started = Date.now()
      await expect(parse(noise)).resolves.toBeDefined()
      expect(Date.now() - started).toBeLessThan(10_000)
    })

    it('reports an unexpected internal failure as a generic localized message', async () => {
      // Forces a throw from deep inside the parse, standing in for a bug or
      // an exotic corruption: it must not reach the UI as a raw JS error.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const sortSpy = vi.spyOn(Array.prototype, 'sort').mockImplementation(() => {
        throw new TypeError('boom')
      })
      try {
        await expect(parse(SAMPLE, 'en')).rejects.toThrow(
          'An error occurred while parsing history.dat.'
        )
      } finally {
        sortSpy.mockRestore()
        consoleError.mockRestore()
      }
    })
  })
})

describe('parseMorkDocument', () => {
  it('separates the column dictionary from the value dictionary', () => {
    const doc = parseMorkDocument(SAMPLE)

    expect(doc.columns.get('81')).toBe('URL')
    expect(doc.columns.get('82')).toBe('Name')
    expect(doc.atoms.get('91')).toBe('http://example.com/')
    // A dictionary without the `(a=c)` meta tag holds values, not columns.
    expect(doc.columns.has('91')).toBe(false)
  })

  it('records literal and atom-reference cells distinctly', () => {
    const doc = parseMorkDocument(SAMPLE)
    const row = doc.rows.get('2')!

    expect(row.get('81')).toEqual({ kind: 'atom', id: '91' })
    expect(row.get('82')).toEqual({ kind: 'literal', text: 'Example Domain' })
  })

  it('strips the :scope suffix from row, column and atom ids', () => {
    const doc = parseMorkDocument(MORK_HEADER + '[7:^80(^81:c^91:c)]')

    expect(doc.rows.get('7')?.get('81')).toEqual({ kind: 'atom', id: '91' })
  })
})
