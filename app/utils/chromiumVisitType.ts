// visits.transition — Chromium's `ui::PageTransition` bitmask
// (see components/page_transition_types.h in the Chromium source). The low
// byte is the "core" transition type; higher bits are independent qualifier
// flags (redirect, forward/back, from address bar, etc.) that can be OR'd
// onto any core type.
const CORE_TRANSITION_MASK = 0xff
const REDIRECT_QUALIFIER_MASK = 0xc0000000 // CLIENT_REDIRECT | SERVER_REDIRECT

const CORE_TRANSITION_KEYS: Record<number, string> = {
  0: 'visitType.chromium.0',
  1: 'visitType.chromium.1',
  2: 'visitType.chromium.2',
  3: 'visitType.chromium.3',
  4: 'visitType.chromium.4',
  5: 'visitType.chromium.5',
  6: 'visitType.chromium.6',
  7: 'visitType.chromium.7',
  8: 'visitType.chromium.8',
  9: 'visitType.chromium.9',
  10: 'visitType.chromium.10'
}

export function coreTransitionType(transition: number): number {
  return transition & CORE_TRANSITION_MASK
}

export function isRedirectTransition(transition: number): boolean {
  return (transition & REDIRECT_QUALIFIER_MASK) !== 0
}

export function formatChromiumTransitionType(
  transition: number,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  const core = coreTransitionType(transition)
  const key = CORE_TRANSITION_KEYS[core]
  return key ? t(key) : t('visitType.unknown', { code: core })
}
