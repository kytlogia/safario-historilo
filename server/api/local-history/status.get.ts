export default defineEventHandler(async (event) => {
  assertLocalRequest(event)

  const supported = await isNodeSqliteSupported()
  const { present, readable } = checkHistoryDbAccess(event)

  return {
    available: supported && present && readable,
    supported,
    present,
    readable,
    path: resolveHistoryDbPath(event)
  }
})
