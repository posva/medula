import { fileURLToPath } from 'node:url'
import { defineDevframe } from 'devframe'
import type { DevframeDefinition } from 'devframe'
import pkg from '../package.json' with { type: 'json' }
import { MCP_DEVTOOLS_BASE, MCP_DEVTOOLS_ID } from './shared'

export interface McpDevtoolsOptions {
  /** Mount base inside the host dev server. @default '/__mcp-devtools/' */
  base?: string
}

const HELP = `# mcp-devtools

The open web page exposes its state through these MCP tools:

- \`${MCP_DEVTOOLS_ID}_list-states\`: names, descriptions and a preview of every exposed state. Call it first.
- \`${MCP_DEVTOOLS_ID}_get-state\`: full JSON value of one state.
- \`${MCP_DEVTOOLS_ID}_set-state\`: replace the whole value. The page updates immediately.
- \`${MCP_DEVTOOLS_ID}_patch-state\`: write a value at a path (object keys and array indexes) and keep the rest.

Arguments are passed as a single object under \`arg0\`, for example \`{ "arg0": { "name": "cart" } }\`.

If these tools are missing, no page is connected: open the app in a browser (dev server running) and list the tools again. Each open tab is a separate page; the tools act on the tab that connected first.
`

/**
 * The headless devframe: no UI besides a plain config page. The state tools
 * come from the page itself (see `mcp-devtools/client`) and appear as MCP
 * tools while a page is connected.
 */
export function createMcpDevtools(options: McpDevtoolsOptions = {}): DevframeDefinition {
  return defineDevframe({
    id: MCP_DEVTOOLS_ID,
    name: 'MCP DevTools',
    version: pkg.version,
    packageName: pkg.name,
    homepage: pkg.homepage,
    description: pkg.description,
    importMetaUrl: import.meta.url,
    icon: 'ph:plugs-connected-duotone',
    basePath: options.base ?? MCP_DEVTOOLS_BASE,
    clientAssets: fileURLToPath(new URL('../dist-client', import.meta.url)),
    cli: { mcp: true },
    setup(ctx) {
      ctx.agent.registerTool({
        id: `${MCP_DEVTOOLS_ID}:help`,
        description:
          'Explain how to use the mcp-devtools state tools. Call this when the state tools are missing or before changing page state.',
        safety: 'read',
        handler: () => ({ markdown: HELP }),
      })
      ctx.agent.registerResource({
        id: 'help',
        name: 'mcp-devtools usage',
        mimeType: 'text/markdown',
        read: () => ({ text: HELP }),
      })
    },
  })
}

export default createMcpDevtools
