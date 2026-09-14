import type { Server } from 'node:http'
import { initDevframe } from 'devframe/initiate'
import type { DevframeInstance, InitDevframeOptions } from 'devframe/initiate'
import type { Plugin } from 'vite'
import { createMcpDevtools } from '../devframe'
import { MCP_DEVTOOLS_BASE, connectScriptUrl } from '../shared'

export interface McpDevtoolsVitePluginOptions extends Pick<
  InitDevframeOptions,
  'auth' | 'mcp' | 'host' | 'allowedOrigins'
> {
  /** Mount base inside the dev server. @default '/__mcp-devtools/' */
  base?: string
  /** Pin a side-car WebSocket port instead of sharing Vite's server. */
  port?: number
  /**
   * Inject `<script type="module" src="<base>connect.js">` into the served
   * HTML so the page connects on its own. Set to `false` when the app loads
   * the script itself (for example a framework that owns the HTML).
   * @default true
   */
  inject?: boolean
}

/**
 * Vite plugin: serves the config page, `connect.js`, the RPC/WebSocket
 * bridge and the MCP route at `<base>` (default `/__mcp-devtools/`) and
 * injects the connect script in dev.
 *
 * Auth is off by default: this is a single-user localhost tool. Pass
 * `auth: true` for devframe's one-time-code gate.
 */
export function McpDevtools(options: McpDevtoolsVitePluginOptions = {}): Plugin[] {
  const base = options.base ?? MCP_DEVTOOLS_BASE
  const def = createMcpDevtools({ base })
  let instance: DevframeInstance | undefined

  const plugins: Plugin[] = [
    {
      name: 'mcp-devtools',
      apply: 'serve',
      async configureServer(server) {
        // Vite re-runs this on restarts: drop the previous WS transport first
        await instance?.close().catch(() => {})
        instance = initDevframe(def, {
          base,
          auth: options.auth ?? false,
          // client tools arrive after startup, so 'auto' would never mount
          mcp: options.mcp ?? true,
          host: options.host,
          allowedOrigins: options.allowedOrigins,
          ...(options.port != null
            ? { ws: { port: options.port } }
            : server.httpServer
              ? { server: server.httpServer as Server }
              : { ws: { sidecar: true } }),
        })
        const current = instance
        server.httpServer?.once('close', () => {
          if (instance === current) {
            instance = undefined
            void current.close().catch(() => {})
          }
        })
        server.middlewares.use(base, (req, res, next) => {
          // the middleware sees paths relative to `base`; devframe expects them full
          req.url = base.slice(0, -1) + (req.url ?? '/')
          current.nodeMiddleware(req, res, next)
        })
      },
    },
  ]
  if (options.inject !== false) {
    plugins.push({
      name: 'mcp-devtools:inject',
      apply: (_config, env) => env.command === 'serve' && !env.isSsrBuild,
      transformIndexHtml: {
        order: 'pre',
        handler: (_html, ctx) =>
          ctx.server
            ? [
                {
                  tag: 'script',
                  attrs: { type: 'module', src: connectScriptUrl(base) },
                  injectTo: 'body',
                },
              ]
            : [],
      },
    })
  }
  return plugins
}

export default McpDevtools
