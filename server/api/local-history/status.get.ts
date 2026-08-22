export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const query = getQuery(event)
  const profileId = typeof query.profileId === 'string' ? query.profileId : undefined

  const supported = await isNodeSqliteSupported()
  const { present, readable } = checkHistoryDbAccess(event, profileId)

  return {
    available: supported && present && readable,
    supported,
    present,
    readable,
    path: resolveHistoryDbPath(event, profileId)
  }
})
