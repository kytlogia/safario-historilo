export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const query = getQuery(event)
  const profileId = typeof query.profileId === 'string' ? query.profileId : undefined

  const supported = await isNodeSqliteSupported()
  const profile = await resolveFirefoxProfile(profileId)
  const { present, readable, path } = checkFirefoxHistoryDbAccess(profile?.dbPath ?? null)

  return {
    available: supported && present && readable,
    supported,
    present,
    readable,
    path
  }
})
