import ResizeObserver from 'resize-observer-polyfill'

// jsdom does not implement ResizeObserver, but Vuetify components use it internally.
globalThis.ResizeObserver ??= ResizeObserver
