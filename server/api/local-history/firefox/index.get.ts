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
    throw toHistoryDbHttpError(err, 'places.sqlite を読み込めませんでした。')
  }
})
