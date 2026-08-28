import type { UnifiedHistorySource } from '~/types/history'

export interface BrowserCatalogEntry {
  id: UnifiedHistorySource
  route: string
  icon: string
  label: string
  color: string
  /** i18n key (e.g. 'nav.viewSafari') for the nav bar link label. */
  navLabelKey: string
  /** `/api/local-history[/<brand>]` — base for the download/status/profiles endpoints. */
  apiBase: string
  /** File name to wrap the auto-loaded server blob in before parsing. */
  serverFileName: string
}

/**
 * Single source of truth for the four supported browsers' static definition
 * (icon/label/route/API base), consumed by the nav bar (BrowserNavLinks.vue),
 * the /all cross-search cards (app/pages/all.vue), and the per-source loaders
 * (useUnifiedHistoryPage.ts, useChromiumHistoryPage.ts, index.vue, firefox.vue)
 * instead of each duplicating this data. See issue #163.
 */
export const BROWSER_CATALOG: BrowserCatalogEntry[] = [
  {
    id: 'safari',
    route: '/',
    icon: 'mdi-compass-outline',
    label: 'Safari',
    color: 'primary',
    navLabelKey: 'nav.viewSafari',
    apiBase: '/api/local-history',
    serverFileName: 'History.db'
  },
  {
    id: 'firefox',
    route: '/firefox',
    icon: 'mdi-fire',
    label: 'Firefox',
    color: 'orange',
    navLabelKey: 'nav.viewFirefox',
    apiBase: '/api/local-history/firefox',
    serverFileName: 'places.sqlite'
  },
  {
    id: 'chrome',
    route: '/chrome',
    icon: 'mdi-google-chrome',
    label: 'Chrome',
    color: 'blue',
    navLabelKey: 'nav.viewChrome',
    apiBase: '/api/local-history/chrome',
    serverFileName: 'History'
  },
  {
    id: 'edge',
    route: '/edge',
    icon: 'mdi-microsoft-edge',
    label: 'Edge',
    color: 'teal',
    navLabelKey: 'nav.viewEdge',
    apiBase: '/api/local-history/edge',
    serverFileName: 'History'
  }
]

export function browserCatalogEntry(id: UnifiedHistorySource): BrowserCatalogEntry {
  const entry = BROWSER_CATALOG.find((b) => b.id === id)
  if (!entry) throw new Error(`Unknown browser id: ${id}`)
  return entry
}
