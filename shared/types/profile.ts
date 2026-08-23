export interface SafariProfile {
  id: string
  name: string
  dbPath: string
}

export interface FirefoxProfile {
  id: string
  name: string
  dbPath: string
  isDefault: boolean
}

/**
 * Chrome and Edge are both Chromium-based and share the exact same profile
 * directory / `Local State` layout, so a single shape covers both — see
 * server/utils/chromium-profiles.ts.
 */
export interface ChromiumProfile {
  id: string
  name: string
  dbPath: string
  isDefault: boolean
}
