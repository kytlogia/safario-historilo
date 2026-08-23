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
