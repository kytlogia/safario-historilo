export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const profiles = await listVivaldiProfiles()
  return { profiles }
})
