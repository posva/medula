import { fileURLToPath } from 'node:url'
import { defineDevframe } from 'devframe'
import type { DevframeDefinition } from 'devframe'
import pkg from '../package.json' with { type: 'json' }
import { MEDULA_BASE, MEDULA_ID, connectScriptUrl } from './shared'

export interface MedulaOptions {
  /** Mount base inside the host dev server. @default '/__medula/' */
  base?: string
}

const HELP = `# medula

The open web page exposes its state through these MCP tools:

- \`${MEDULA_ID}_list-states\`: names, descriptions and a preview of every exposed state. Call it first.
- \`${MEDULA_ID}_get-state\`: full JSON value of one state.
- \`${MEDULA_ID}_set-state\`: replace the whole value. The page updates immediately.
- \`${MEDULA_ID}_patch-state\`: write a value at a path (object keys and array indexes) and keep the rest.

Arguments are passed as a single object under \`arg0\`, for example \`{ "arg0": { "name": "cart" } }\`.

If these tools are missing, no page is connected: open the app in a browser (dev server running) and list the tools again. Each open tab is a separate page; the tools act on the tab that synced last, the one the user looked at most recently.
`

/**
 * Dock client script entry: the page script served with the config page at
 * `base`. A hub imports it into the app page; it needs no app code. `eager`:
 * the tools must exist before anyone opens the medula dock.
 */
export function medulaDockClientScript(base: string = MEDULA_BASE): {
  importFrom: string
  eager: boolean
} {
  return { importFrom: connectScriptUrl(base), eager: true }
}

/**
 * The headless devframe: no UI besides a plain config page, meant to run as a
 * hub dock (Vite DevTools, Nuxt DevTools, a Next hub). The state tools come
 * from the page itself (see `medula/client`) and appear as MCP tools of the
 * hub while a page is connected.
 */
export function createMedula(options: MedulaOptions = {}): DevframeDefinition {
  return defineDevframe({
    id: MEDULA_ID,
    name: 'medula',
    version: pkg.version,
    packageName: pkg.name,
    homepage: pkg.homepage,
    description: pkg.description,
    importMetaUrl: import.meta.url,
    icon: 'ph:plugs-connected-duotone',
    basePath: options.base ?? MEDULA_BASE,
    clientAssets: fileURLToPath(new URL('../dist-client', import.meta.url)),
    cli: { mcp: true },
    setup(ctx) {
      ctx.agent.registerTool({
        id: `${MEDULA_ID}:help`,
        description:
          'Explain how to use the medula state tools. Call this when the state tools are missing or before changing page state.',
        safety: 'read',
        handler: () => ({ markdown: HELP }),
      })
      ctx.agent.registerResource({
        id: 'help',
        name: 'medula usage',
        mimeType: 'text/markdown',
        read: () => ({ text: HELP }),
      })
    },
  })
}

export default createMedula
