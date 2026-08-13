export default defineEventHandler(async () => {
  const supported = await isNodeSqliteSupported()
  const present = isHistoryDbFilePresent()

  return {
    available: supported && present,
    supported,
    present,
    path: resolveHistoryDbPath()
  }
})
