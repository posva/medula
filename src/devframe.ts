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

Framework state is discovered automatically in the open web page. Use the \`medula_vue_*\`, \`medula_react_*\`, \`medula_svelte_*\` or \`medula_solid_*\` tools to list components, read their state and change it.

Pinia stores also appear as \`pinia:<id>\` through these MCP tools:

- \`${MEDULA_ID}_list-states\`: names, descriptions and a preview of every exposed state. Call it first.
- \`${MEDULA_ID}_get-state\`: full JSON value of one state.
- \`${MEDULA_ID}_set-state\`: replace the whole value. The page updates immediately.
- \`${MEDULA_ID}_patch-state\`: write a value at a path (object keys and array indexes) and keep the rest.

Arguments are passed as a single object under \`arg0\`, for example \`{ "arg0": { "name": "pinia:cart" } }\`.

If these tools are missing, no page is connected: open the app in a browser (dev server running) and list the tools again. When several apps run, call \`devframe_connect_list-instances\` first and use the selected instance port with \`devframe_connect_call-tool\`.
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
 * Mount entry for a devframes hub (`@devframes/next/hub`, `@devframes/vite/hub`):
 * medula as a dock with its page script. A hub serves every dock at
 * `<hubBase><id>/`, so the script URL follows the hub base.
 *
 * @example
 * nextDevframeHub({ devframes: [medulaHubEntry()] })
 */
export function medulaHubEntry(hubBase: string = '/__devframes/'): {
  devframe: DevframeDefinition
  dock: { clientScript: { importFrom: string; eager: boolean } }
} {
  const base = hubBase.endsWith('/') ? hubBase : `${hubBase}/`
  return {
    devframe: createMedula(),
    dock: { clientScript: medulaDockClientScript(`${base}${MEDULA_ID}/`) },
  }
}

/**
 * The headless devframe: no UI besides a plain config page, meant to run as a
 * hub dock (Vite DevTools, Nuxt DevTools, a Next hub). The state tools come
 * from automatic framework discovery in the page and appear as MCP tools of the
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
    // TODO: replace with actual icon
    icon: 'solar:bones-bold-duotone',
    basePath: options.base ?? MEDULA_BASE,
    clientAssets: fileURLToPath(new URL('../dist-client', import.meta.url)),
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
