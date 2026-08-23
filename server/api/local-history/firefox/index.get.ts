export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const query = getQuery(event)
  const profileId = typeof query.profileId === 'string' ? query.profileId : undefined

  try {
    const { buffer, fileName } = await readLocalFirefoxHistoryDb(profileId)
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
    if (isError(err)) {
      throw err
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: err instanceof Error ? err.message : 'places.sqlite を読み込めませんでした。'
    })
  }
})
