// @vitest-environment node
import type { Plugin, ResolvedConfig } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BOOTSTRAP_SCRIPT } from '../page/bootstrap'
import { medula } from './index'

type KitPlugin = Plugin & { devtools?: { setup: (ctx: unknown) => unknown } }

function plugin(name: string): Plugin {
  const found = medula().find((p) => p.name === name)
  if (!found) throw new Error(`plugin ${name} not returned`)
  return found
}

function hook<T>(value: T | { handler: T } | undefined): T {
  if (!value) throw new Error('hook missing')
  return typeof value === 'object' && 'handler' in value ? value.handler : value
}

describe('medula vite plugin', () => {
  afterEach(() => vi.restoreAllMocks())

  it('registers medula as a Vite DevTools dock', () => {
    const plugins = medula() as KitPlugin[]
    const kit = plugins.find((p) => p.devtools)
    expect(kit?.name).toBe('devframe:medula')
    expect(typeof kit?.devtools?.setup).toBe('function')
    expect(plugins.map((p) => p.name)).toContain('medula:svelte')
  })

  it('injects only the hook bootstrap into the served HTML', async () => {
    const inject = plugin('medula:inject')
    const transform = hook(inject.transformIndexHtml)
    const tags = await (transform as any).call({}, '<html></html>', { server: {}, path: '/' })
    expect(tags).toEqual([{ tag: 'script', children: BOOTSTRAP_SCRIPT, injectTo: 'head-prepend' }])
  })

  it('warns once when no Vite DevTools plugin is present', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const inject = plugin('medula:inject')
    const configResolved = hook(inject.configResolved) as (config: ResolvedConfig) => void
    const config = (plugins: string[]) =>
      ({ plugins: plugins.map((name) => ({ name })) }) as unknown as ResolvedConfig
    configResolved.call({} as any, config(['vite:vue']))
    configResolved.call({} as any, config(['vite:vue']))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toMatch(/Vite DevTools/)

    warn.mockClear()
    configResolved.call({} as any, config(['vite:devtools', 'devframe:medula']))
    expect(warn).toHaveBeenCalledTimes(0)
  })
})
