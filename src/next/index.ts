import { createDevframeNextHandler, withDevframe } from '@devframes/next/single'
import type { CreateDevframeNextHandlerOptions, DevframeNextHandler } from '@devframes/next/single'
import { createMcpDevtools } from '../devframe'
import { MCP_DEVTOOLS_BASE, connectScriptUrl } from '../shared'

export { withDevframe as withMcpDevtools }
export { MCP_DEVTOOLS_BASE, connectScriptUrl }

export type McpDevtoolsNextHandlerOptions = Omit<CreateDevframeNextHandlerOptions, 'flags'>

/**
 * Route handler for `app/__mcp-devtools/[[...path]]/route.ts`. Serves the
 * config page and `connect.js`, runs the RPC side-car and the MCP route.
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
  const base = options.base ?? MCP_DEVTOOLS_BASE
  return createDevframeNextHandler(createMcpDevtools({ base }), {
    ...options,
    base,
    auth: options.auth ?? false,
    mcp: options.mcp ?? true,
  })
}
