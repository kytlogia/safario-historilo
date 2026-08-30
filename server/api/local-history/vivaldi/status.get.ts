export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const query = getQuery(event)
  const profileId = typeof query.profileId === 'string' ? query.profileId : undefined

  const [supported, profile] = await Promise.all([
    isNodeSqliteSupported(),
    resolveVivaldiProfile(profileId)
  ])
  const { present, readable, path } = checkVivaldiHistoryDbAccess(profile?.dbPath ?? null)

  return {
    available: supported && present && readable,
    supported,
    present,
    readable,
    path
  }
})
