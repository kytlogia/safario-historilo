/**
 * Sentinel profileId meaning "the classic, unnamed Safari profile" — used by
 * both server (server/utils/history-store.ts) and client (app/pages/index.vue,
 * app/components/UploadPanel.vue) code, so it lives here rather than being
 * duplicated as a string literal on each side of that boundary.
 */
export const DEFAULT_PROFILE_ID = 'default'

/**
 * Firefox's profiles.ini and Chrome/Edge's Local State don't guarantee any
 * entry is explicitly marked as the default profile — mutates `profiles` in
 * place so the first entry is promoted whenever none already is, keeping a
 * default always available when at least one profile exists. Shared by
 * server/utils/firefox-profiles.ts and server/utils/chromium-profiles.ts,
 * whose FirefoxProfile/ChromiumProfile shapes both carry `isDefault`.
 */
export function promoteFirstAsDefaultIfNoneSet(profiles: { isDefault: boolean }[]): void {
  if (profiles.length > 0 && !profiles.some((p) => p.isDefault)) {
    profiles[0]!.isDefault = true
  }
}
