import ResizeObserver from 'resize-observer-polyfill'

// jsdom does not implement ResizeObserver, but Vuetify components use it internally.
globalThis.ResizeObserver ??= ResizeObserver

// jsdom does not define `visualViewport` at all (not even as `undefined`), so
// Vuetify's overlay positioning code (v-dialog, v-menu, v-autocomplete, ...),
// which references the bare global identifier, throws a ReferenceError
// rather than just seeing an undefined value. A minimal stand-in avoids that.
// This setup file also runs for tests forced back to `node` environment
// (e.g. via `@vitest-environment node`), where `window` itself doesn't exist.
if (typeof window !== 'undefined') {
  globalThis.visualViewport ??= {
    width: window.innerWidth,
    height: window.innerHeight,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    onresize: null,
    onscroll: null
  } as unknown as VisualViewport
}
