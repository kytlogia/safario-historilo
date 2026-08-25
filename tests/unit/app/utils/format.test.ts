import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateInputValue,
  formatDateTime,
  formatNumber,
  isSafeUrl
} from '~/utils/format'

describe('format.ts', () => {
  describe('formatDate', () => {
    it('formats a date using the ja-JP medium style', () => {
      expect(formatDate(new Date('2024-01-02T03:04:05.000Z'))).toBe(
        new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(
          new Date('2024-01-02T03:04:05.000Z')
        )
      )
    })
  })

  describe('formatDateInputValue', () => {
    it('formats Date instances the same as formatDate', () => {
      const date = new Date('2024-01-02T03:04:05.000Z')
      expect(formatDateInputValue(date)).toBe(formatDate(date))
    })

    it('returns an empty string for non-Date values', () => {
      expect(formatDateInputValue(null)).toBe('')
      expect(formatDateInputValue('2024-01-02')).toBe('')
      expect(formatDateInputValue(undefined)).toBe('')
    })
  })

  describe('formatDateTime', () => {
    it('formats a date using the ja-JP medium date and time style', () => {
      const date = new Date('2024-01-02T03:04:05.000Z')
      expect(formatDateTime(date)).toBe(
        new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
      )
    })
  })

  describe('formatNumber', () => {
    it('formats a number using the ja-JP grouping by default', () => {
      expect(formatNumber(12345)).toBe(new Intl.NumberFormat('ja-JP').format(12345))
    })

    it('formats a number using the given locale', () => {
      expect(formatNumber(12345, 'en-US')).toBe(new Intl.NumberFormat('en-US').format(12345))
    })
  })

  describe('isSafeUrl', () => {
    it('accepts http and https URLs', () => {
      expect(isSafeUrl('https://example.com/')).toBe(true)
      expect(isSafeUrl('http://example.com/')).toBe(true)
    })

    it('rejects other protocols and malformed URLs', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false)
      expect(isSafeUrl('file:///etc/passwd')).toBe(false)
      expect(isSafeUrl('not a url')).toBe(false)
    })
  })
})
