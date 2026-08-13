export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const supported = await isNodeSqliteSupported()
  const { present, readable } = checkHistoryDbAccess()

  return {
    available: supported && present && readable,
    supported,
    present,
    readable,
    path: resolveHistoryDbPath()
  }
})
