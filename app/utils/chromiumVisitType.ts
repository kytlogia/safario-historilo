// visits.transition — Chromium's `ui::PageTransition` bitmask
// (see components/page_transition_types.h in the Chromium source). The low
// byte is the "core" transition type; higher bits are independent qualifier
// flags (redirect, forward/back, from address bar, etc.) that can be OR'd
// onto any core type.
const CORE_TRANSITION_MASK = 0xff
const REDIRECT_QUALIFIER_MASK = 0xc0000000 // CLIENT_REDIRECT | SERVER_REDIRECT

const CORE_TRANSITION_LABELS: Record<number, string> = {
  0: 'リンク',
  1: '直接入力',
  2: 'ブックマーク/自動補完',
  3: '自動サブフレーム',
  4: '手動サブフレーム',
  5: '生成（検索候補など）',
  6: '開始ページ',
  7: 'フォーム送信',
  8: '再読み込み',
  9: 'キーワード検索',
  10: 'キーワード検索（生成）'
}

export function coreTransitionType(transition: number): number {
  return transition & CORE_TRANSITION_MASK
}

export function isRedirectTransition(transition: number): boolean {
  return (transition & REDIRECT_QUALIFIER_MASK) !== 0
}

export function formatChromiumTransitionType(transition: number): string {
  const core = coreTransitionType(transition)
  return CORE_TRANSITION_LABELS[core] ?? `不明 (${core})`
}
