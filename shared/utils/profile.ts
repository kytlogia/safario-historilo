/**
 * Sentinel profileId meaning "the classic, unnamed Safari profile" — used by
 * both server (server/utils/history-store.ts) and client (app/pages/index.vue,
 * app/components/UploadPanel.vue) code, so it lives here rather than being
 * duplicated as a string literal on each side of that boundary.
 */
export const DEFAULT_PROFILE_ID = 'default'
