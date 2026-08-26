export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const query = getQuery(event)
  const profileId = typeof query.profileId === 'string' ? query.profileId : undefined

  try {
    const supported = await isNodeSqliteSupported()
    const { present, readable, path } = checkHistoryDbAccess(event, profileId)

    return {
      available: supported && present && readable,
      supported,
      present,
      readable,
      path
    }
  } catch (err) {
    throw toHistoryDbHttpError(err, 'History.db の状態を確認できませんでした。')
  }
})
