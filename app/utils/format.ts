const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>()

function getDateFormatter(locale: string) {
  let formatter = dateFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
    dateFormatters.set(locale, formatter)
  }
  return formatter
}

function getDateTimeFormatter(locale: string) {
  let formatter = dateTimeFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' })
    dateTimeFormatters.set(locale, formatter)
  }
  return formatter
}

export function formatDate(date: Date, locale = 'ja-JP') {
  return getDateFormatter(locale).format(date)
}

export function formatDateInputValue(date: unknown, locale = 'ja-JP') {
  return date instanceof Date ? formatDate(date, locale) : ''
}

export function formatDateTime(date: Date, locale = 'ja-JP') {
  return getDateTimeFormatter(locale).format(date)
}

export function formatNumber(value: number, locale = 'ja-JP') {
  return value.toLocaleString(locale)
}

export function isSafeUrl(url: string) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}
