export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const profiles = await listSafariProfiles({
    defaultDbPath: resolveHistoryDbPath(event, DEFAULT_PROFILE_ID)
  })
  return { profiles }
})
