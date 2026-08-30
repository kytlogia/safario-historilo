// electron/serverProcess.mjs has no DOM dependency and isn't part of the
// jsdom-targeted app bundle — see the equivalent note in
// tests/unit/server/utils/history-store.test.ts for why `node` is forced here.
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { resolveServerEntryPath, waitForServer } from '../../../electron/serverProcess.mjs'

describe('resolveServerEntryPath', () => {
  it('points inside the packaged app bundle resources when packaged', () => {
    expect(
      resolveServerEntryPath({
        isPackaged: true,
        resourcesPath: '/Applications/Safari History Detail.app/Contents/Resources',
        appDir: '/dev/repo'
      })
    ).toBe('/Applications/Safari History Detail.app/Contents/Resources/output/server/index.mjs')
  })

  it('points at the repo .output when not packaged', () => {
    expect(
      resolveServerEntryPath({ isPackaged: false, resourcesPath: '/unused', appDir: '/dev/repo' })
    ).toBe('/dev/repo/.output/server/index.mjs')
  })
})

describe('waitForServer', () => {
  it('resolves as soon as fetch succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response('ok'))
    await expect(
      waitForServer('http://127.0.0.1:1/', { fetchImpl, intervalMs: 1 })
    ).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries after a failed attempt until one succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(new Response('ok'))
    await waitForServer('http://127.0.0.1:1/', { fetchImpl, intervalMs: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('throws once the timeout elapses without a successful response', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(
      waitForServer('http://127.0.0.1:1/', { fetchImpl, timeoutMs: 5, intervalMs: 2 })
    ).rejects.toThrow(/タイムアウト/)
  })
})
