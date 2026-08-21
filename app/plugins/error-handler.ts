export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error, _instance, info) => {
    console.error('[Safari History Detail] Unhandled error', info, error)
    showError(error instanceof Error ? error : new Error(String(error)))
  }
})
