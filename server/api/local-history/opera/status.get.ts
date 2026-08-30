export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const query = getQuery(event)
  const profileId = typeof query.profileId === 'string' ? query.profileId : undefined

  const [supported, profile] = await Promise.all([
    isNodeSqliteSupported(),
    resolveOperaProfile(profileId)
  ])
  const { present, readable, path } = checkOperaHistoryDbAccess(profile?.dbPath ?? null)

  return {
    available: supported && present && readable,
    supported,
    present,
    readable,
    path
  }
})
