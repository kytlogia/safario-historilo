export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const profiles = await listOperaProfiles()
  return { profiles }
})
