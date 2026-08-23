// moz_historyvisits.visit_type — Firefox's `nsINavHistoryService` transition
// type constants (see mozilla-central toolkit/components/places/nsINavHistoryService.idl).
const VISIT_TYPE_LABELS: Record<number, string> = {
  1: 'リンク',
  2: '直接入力',
  3: 'ブックマーク',
  4: '埋め込み',
  5: 'リダイレクト（恒久的）',
  6: 'リダイレクト（一時的）',
  7: 'ダウンロード',
  8: 'フレーム内リンク',
  9: '再読み込み'
}

export const REDIRECT_VISIT_TYPES: ReadonlySet<number> = new Set([5, 6])

export function formatFirefoxVisitType(visitType: number): string {
  return VISIT_TYPE_LABELS[visitType] ?? `不明 (${visitType})`
}
