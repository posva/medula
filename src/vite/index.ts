import type { Server } from 'node:http'
import { initDevframe } from 'devframe/initiate'
import type { DevframeInstance, InitDevframeOptions } from 'devframe/initiate'
import type { Plugin } from 'vite'
import { createMedula } from '../devframe'
import { BOOTSTRAP_SCRIPT } from '../page/bootstrap'
import { MEDULA_BASE, connectScriptUrl } from '../shared'
import { svelteInstrumentation } from './svelte'

export interface MedulaVitePluginOptions extends Pick<
  InitDevframeOptions,
  'auth' | 'mcp' | 'host' | 'allowedOrigins'
> {
  /** Mount base inside the dev server. @default '/__medula/' */
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
 * bridge and the MCP route at `<base>` (default `/__medula/`) and
 * injects the hook bootstrap + page script in dev. No app code needed: Vue
 * apps, Pinia stores and React components are discovered like the official
 * devtools do.
 *
 * Auth is off by default: this is a single-user localhost tool. Pass
 * `auth: true` for devframe's one-time-code gate.
 */
export function medula(options: MedulaVitePluginOptions = {}): Plugin[] {
  const base = options.base ?? MEDULA_BASE
  const def = createMedula({ base })
  let instance: DevframeInstance | undefined

  const plugins: Plugin[] = [
    {
      name: 'medula',
      apply: 'serve',
      async configureServer(server) {
        // Vite re-runs this on restarts: drop the previous WS transport first
        await instance?.close().catch(() => {})
        instance = initDevframe(def, {
          base,
          auth: options.auth ?? false,
          // client tools arrive after startup, so 'auto' would never mount
          mcp: options.mcp ?? true,
          // lets `devframe connect` discover this dev server
          register: true,
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
    const connectUrl = connectScriptUrl(base)
    plugins.push({
      name: 'medula:inject',
      apply: (_config, env) => env.command === 'serve' && !env.isSsrBuild,
      transformIndexHtml: {
        order: 'pre',
        handler: (_html, ctx) =>
          ctx.server
            ? [
                // hook shims must run before the frameworks load
                { tag: 'script', children: BOOTSTRAP_SCRIPT, injectTo: 'head-prepend' },
                // classic inline script: Vite would try to warm up a module
                // `src` through its own pipeline, but the middleware serves it
                {
                  tag: 'script',
                  children: `document.head.append(Object.assign(document.createElement('script'),{type:'module',src:${JSON.stringify(connectUrl)}}))`,
                  injectTo: 'body',
                },
              ]
            : [],
      },
    })
  }
  // Svelte 5 components import `svelte/internal/client`; the wrapper records them
  plugins.push(svelteInstrumentation())
  return plugins
}

export default medula
