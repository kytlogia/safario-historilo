export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const profiles = await listEdgeProfiles()
  return { profiles }
})
