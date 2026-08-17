export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(date)
}

export function formatDateInputValue(date: unknown) {
  return date instanceof Date ? formatDate(date) : ''
}

export function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
}

export function isSafeUrl(url: string) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}
