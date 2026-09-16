// @vitest-environment node
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'vite'
import type { ViteDevServer } from 'vite'
import { medula } from './index'

describe('hub discovery', () => {
  let server: ViteDevServer | undefined
  let instancesDir: string | undefined

  afterEach(async () => {
    await server?.close()
    if (instancesDir) await rm(instancesDir, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('registers the hub at its actual port and removes it on close', async () => {
    instancesDir = await mkdtemp(join(tmpdir(), 'medula-registration-'))
    vi.stubEnv('DEVFRAME_INSTANCES_DIR', instancesDir)
    server = await createServer({
      configFile: false,
      logLevel: 'silent',
      devtools: { clientAuth: false, builtinDevTools: false },
      plugins: medula(),
      server: { host: '127.0.0.1', port: 0 },
    })
    await server.listen()
    const origin = new URL(server.resolvedUrls!.local[0]!).origin
    const response = await fetch(`${origin}/__devtools/__connection.json`)
    expect(response.ok).toBe(true)
    await expect.poll(async () => (await readdir(instancesDir!)).length).toBe(1)
    const [file] = await readdir(instancesDir)
    const record = JSON.parse(await readFile(join(instancesDir, file!), 'utf8'))
    expect(record).toMatchObject({
      id: 'vite-devtools',
      name: 'Vite DevTools',
      origin,
      port: Number(new URL(origin).port),
      basePath: '/__devtools/',
      rootDir: server.config.root,
      mcp: { path: '/__devtools/__mcp' },
    })
    await server.close()
    server = undefined
    expect(await readdir(instancesDir)).toEqual([])
  })
})
