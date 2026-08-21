import { createVueErrorHandler } from '~/utils/error-reporting'

export default defineNuxtPlugin((nuxtApp) => {
  // Leave Vue's default errorHandler (unset) in dev so Vite's error overlay
  // still fires; only take over for the production/preview build.
  if (import.meta.dev) return

  nuxtApp.vueApp.config.errorHandler = createVueErrorHandler(showError)
})
