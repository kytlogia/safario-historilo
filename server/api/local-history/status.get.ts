export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const supported = await isNodeSqliteSupported()
  const present = isHistoryDbFilePresent()

  return {
    available: supported && present,
    supported,
    present,
    path: resolveHistoryDbPath()
  }
})
