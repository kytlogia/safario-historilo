export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const query = getQuery(event)
  const profileId = typeof query.profileId === 'string' ? query.profileId : undefined

  try {
    const { buffer, fileName } = await readLocalHistoryDb(event, profileId)
    setHeader(event, 'content-type', 'application/octet-stream')
    setHeader(event, 'content-disposition', `attachment; filename="${fileName}"`)
    return buffer
  } catch (err) {
    if (err instanceof HistoryDbNotFoundError) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        message: err.message
      })
    }
    if (err instanceof HistoryDbNotReadableError) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: err.message
      })
    }
    // resolveHistoryDbPath() throws its own H3 error (e.g. 400 for a
    // malformed profileId) — pass it through as-is instead of masking it
    // with a generic 500 below. isError() checks it's genuinely an H3Error
    // rather than duck-typing on a `statusCode` property, which some
    // unrelated error type could coincidentally have.
    if (isError(err)) {
      throw err
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: err instanceof Error ? err.message : 'History.db を読み込めませんでした。'
    })
  }
})
