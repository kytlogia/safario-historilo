export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  try {
    const { buffer, fileName } = await readLocalHistoryDb()
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
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: err instanceof Error ? err.message : 'History.db を読み込めませんでした。'
    })
  }
})
