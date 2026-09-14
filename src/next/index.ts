import type {
  CreateDevframeNextHandlerOptions,
  DevframeNextConfig,
  DevframeNextHandler,
} from '@devframes/next/single'
import { REACT_DEVTOOLS_HOOK_SCRIPT } from '../react/hook'
import { MCP_DEVTOOLS_BASE, MCP_DEVTOOLS_ID, connectScriptUrl } from '../shared'

export { MCP_DEVTOOLS_BASE, connectScriptUrl }
/**
 * Inline this in `<head>` of the root layout (development only) so the
 * `mcp-devtools_react_*` component tools work:
 * `<script dangerouslySetInnerHTML={{ __html: reactDevtoolsHookScript }} />`
 */
export const reactDevtoolsHookScript: string = REACT_DEVTOOLS_HOOK_SCRIPT
export type { DevframeNextConfig as McpDevtoolsNextConfig }

export type McpDevtoolsNextHandlerOptions = Omit<CreateDevframeNextHandlerOptions, 'flags'>

/**
 * Wrap `next.config` with the settings the devframe host needs. Mirrors
 * `withDevframe` from `@devframes/next/single` without importing it, so the
 * Next bundle of this module stays free of the node-only runtime.
 *
 * @example
 * export default withMcpDevtools({ reactStrictMode: true })
 */
export function withMcpDevtools<T extends DevframeNextConfig>(nextConfig: T = {} as T): T {
  // relative assets under `<base>` must not hit Next's trailing-slash redirect
  return { ...nextConfig, skipTrailingSlashRedirect: true }
}

// non-literal, otherwise tsdown resolves the self-import to a relative chunk
const selfPackage: string = MCP_DEVTOOLS_ID

// Bundler-ignored so Node loads the published `dist` at request time: a
// bundled copy breaks the `import.meta.url` lookup of `dist-client`.
async function loadHandler(options: McpDevtoolsNextHandlerOptions): Promise<DevframeNextHandler> {
  const [{ createMcpDevtools }, { createDevframeNextHandler }] = await Promise.all([
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ selfPackage) as Promise<
      typeof import('mcp-devtools')
    >,
    import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ '@devframes/next/single'
    ) as Promise<typeof import('@devframes/next/single')>,
  ])
  const base = options.base ?? MCP_DEVTOOLS_BASE
  return createDevframeNextHandler(createMcpDevtools({ base }), {
    ...options,
    base,
    auth: options.auth ?? false,
    // client tools arrive after startup, so 'auto' would never mount
    mcp: options.mcp ?? true,
  })
}

/**
 * Route handler for `app/%5F_mcp-devtools/[[...path]]/route.ts` (Next
 * reserves `_`-prefixed folders, so `__mcp-devtools` is URL-encoded). Serves
 * the config page and `connect.js`, runs the RPC side-car and the MCP route.
 * Memoized on `globalThis`, so Next dev reloads reuse the same side-car.
 *
 * Add `<script type="module" src="/__mcp-devtools/connect.js" />` to the
 * root layout in development so pages connect.
 *
 * @example
 * export const runtime = 'nodejs'
 * export const dynamic = 'force-dynamic'
 * const handler = createMcpDevtoolsHandler()
 * export const GET = handler.fetch
 * export const POST = handler.fetch
 * export const DELETE = handler.fetch
 */
export function createMcpDevtoolsHandler(
  options: McpDevtoolsNextHandlerOptions = {},
): DevframeNextHandler {
  const handler = loadHandler(options)
  return {
    fetch: (request) => handler.then((h) => h.fetch(request)),
    ready: handler.then((h) => h.ready),
    close: () => handler.then((h) => h.close()),
  }
}
