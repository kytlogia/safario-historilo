export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const profiles = await listArcProfiles()
  return { profiles }
})
