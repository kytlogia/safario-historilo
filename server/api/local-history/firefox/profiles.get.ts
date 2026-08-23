export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const profiles = await listFirefoxProfiles()
  return { profiles }
})
