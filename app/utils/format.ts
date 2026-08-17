const dateFormatter = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
  timeStyle: 'medium'
})

export function formatDate(date: Date) {
  return dateFormatter.format(date)
}

export function formatDateInputValue(date: unknown) {
  return date instanceof Date ? formatDate(date) : ''
}

export function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date)
}

export function isSafeUrl(url: string) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}
