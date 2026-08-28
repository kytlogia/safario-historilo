// localStorage can throw (Safari private mode, blocked storage, restrictive
// browser policies) — every caller here must degrade gracefully (keep
// whatever in-memory value/behavior it already has, just skip persistence)
// rather than let a thrown error break unrelated app logic. Shared by
// useAppTheme.ts and useAppLocale.ts, which used to each carry their own
// identical try/catch pair around getItem/setItem.
export const safeLocalStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Ignore: the caller's value still applies for this session, just isn't persisted.
    }
  }
}
