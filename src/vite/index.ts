import type { AddressInfo } from 'node:net'
import { DEVTOOLS_MOUNT_PATH } from '@vitejs/devtools-kit/constants'
import { createPluginFromDevframe } from '@vitejs/devtools-kit/node'
import { registerDevframeInstance } from 'devframe/internal'
import type { Plugin } from 'vite'
import { createMedula, medulaDockClientScript } from '../devframe'
import { BOOTSTRAP_SCRIPT } from '../page/bootstrap'
import { MEDULA_BASE, MEDULA_ID } from '../shared'
import { solidInstrumentation } from './solid'
import { svelteInstrumentation } from './svelte'

export interface MedulaVitePluginOptions {
  /** Mount base of the medula dock page inside the dev server. @default '/__medula/' */
  base?: string
  /**
   * Solid apps: name signals, memos and stores after their variable in dev
   * (`createSignal(0, { name: 'count' })`) so the tools show readable labels.
   * @default true
   */
  solidAutoname?: boolean
}

/**
 * Vite plugin: registers medula as a dock of Vite DevTools (the hub Nuxt
 * DevTools 4 runs too). The hub serves the config page at `<base>`, loads the
 * page script into the app and exposes the page tools on its own MCP route.
 * The plugin also inlines the hook bootstrap in dev so Vue apps, Pinia stores,
 * React, Svelte and Solid components are discovered like the official devtools
 * do.
 *
 * Requires Vite DevTools: `devtools: true` in the Vite config with
 * `@vitejs/devtools` installed, or Nuxt DevTools in a Nuxt app.
 */
export function medula(options: MedulaVitePluginOptions = {}): Plugin[] {
  const base = options.base ?? MEDULA_BASE
  let warned = false
  return [
    createPluginFromDevframe(createMedula({ base }), {
      base,
      dock: { clientScript: medulaDockClientScript(base) },
    }),
    {
      name: 'medula:inject',
      apply: (_config, env) => env.command === 'serve' && !env.isSsrBuild,
      configResolved(config) {
        if (warned || config.devtools) return
        if (config.plugins.some((plugin) => plugin.name.startsWith('vite:devtools'))) return
        warned = true
        console.warn(
          '[medula] medula runs as a Vite DevTools dock. Enable Vite DevTools (`devtools: true` in vite.config with `@vitejs/devtools` installed) or Nuxt DevTools, otherwise no tool reaches MCP.',
        )
      },
      configureServer(server) {
        // Vite DevTools does not publish itself to `~/.devframe/instances/`;
        // register its hub so `devframe connect` discovers this dev server.
        const httpServer = server.httpServer
        if (!httpServer) return
        httpServer.once('listening', () => {
          const address = httpServer.address() as AddressInfo | string | null
          if (!address || typeof address === 'string') return
          const registration = registerDevframeInstance({
            pid: process.pid,
            port: address.port,
            origin: `http://localhost:${address.port}`,
            basePath: DEVTOOLS_MOUNT_PATH,
            id: MEDULA_ID,
            name: 'medula',
            rootDir: server.config.root,
            mcp: { path: `${DEVTOOLS_MOUNT_PATH}__mcp` },
            startedAt: Date.now(),
          })
          httpServer.once('close', () => registration.unregister())
        })
      },
      transformIndexHtml: {
        order: 'pre',
        handler: (_html, ctx) =>
          // hook shims must run before the frameworks load
          ctx.server
            ? [{ tag: 'script', children: BOOTSTRAP_SCRIPT, injectTo: 'head-prepend' }]
            : [],
      },
    },
    // Svelte 5 components import `svelte/internal/client`; the wrapper records them
    svelteInstrumentation(),
    // Solid apps import `solid-js`; the wrapper hooks its DEV object
    solidInstrumentation({ autoname: options.solidAutoname }),
  ]
}

export default medula
