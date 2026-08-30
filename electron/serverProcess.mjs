import { join } from 'node:path'

/**
 * Resolves the path to the built Nitro server entry point
 * (`.output/server/index.mjs`, produced by `pnpm build` — see nitro.json's
 * "node-server" preset).
 *
 * - Packaged app: electron-builder copies `.output` into the app bundle as
 *   `Contents/Resources/output` via `extraResources` (see the `build` key in
 *   package.json), outside the asar archive — Nitro's server bundle isn't
 *   asar-friendly (it reads its own chunk files from disk by path).
 * - Dev/unpackaged (`pnpm electron`): the repo's own `.output`, which the
 *   caller must have already produced with `pnpm build`.
 */
export function resolveServerEntryPath({ isPackaged, resourcesPath, appDir }) {
  return isPackaged
    ? join(resourcesPath, 'output', 'server', 'index.mjs')
    : join(appDir, '.output', 'server', 'index.mjs')
}

/**
 * Polls `url` until something responds (any status counts — this only
 * confirms the Nitro server is listening, not that a particular route
 * works) or `timeoutMs` elapses.
 *
 * ponytail: a plain poll loop rather than parsing the child process's
 * stdout for its "Listening on ..." line (see server/index.mjs) — the log
 * line isn't a documented/stable contract, an HTTP request is a much more
 * direct way to ask "is the server up yet".
 */
export async function waitForServer(
  url,
  { timeoutMs = 15000, intervalMs = 200, fetchImpl = fetch } = {}
) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      await fetchImpl(url)
      return
    } catch (err) {
      if (Date.now() >= deadline) {
        throw new Error(`サーバーの起動待ちがタイムアウトしました: ${url}`, { cause: err })
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }
}
