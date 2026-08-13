export default defineEventHandler(async (event) => {
  try {
    const { buffer, fileName } = await readLocalHistoryDb()
    setHeader(event, 'content-type', 'application/octet-stream')
    setHeader(event, 'content-disposition', `attachment; filename="${fileName}"`)
    return buffer
  } catch (err) {
    throw createError({
      statusCode: 404,
      statusMessage: 'History.db Not Found',
      message: err instanceof Error ? err.message : 'History.db を読み込めませんでした。'
    })
  }
})
