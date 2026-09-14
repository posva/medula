/**
 * The page script, loaded as `<script type="module" src="<base>connect.js">`
 * by the host adapter (no app code needed). It registers the state tools,
 * discovers Vue apps and React renderers through the hooks the bootstrap
 * script installed, and connects to the devframe RPC (`./__connection.json`
 * next to this script) so devframe mirrors the tools to MCP.
 */
import { connectDevframe } from 'devframe/client'
import { ensureChannel } from '../client/channel'
import { installReactInternals } from '../react/internals'
import { installSvelteInternals } from '../svelte/internals'
import { installVueInternals } from '../vue/internal'

const KEY = Symbol.for('mcp-devtools:connect')
const g = globalThis as { [KEY]?: Promise<unknown> }

g[KEY] ??= (() => {
  ensureChannel()
  installVueInternals()
  installReactInternals()
  installSvelteInternals()
  // this script lives at `<base>connect.js`; shared chunks live deeper, so resolve
  // `__connection.json` from here instead of from the executing chunk
  return connectDevframe({ baseURL: new URL('./', import.meta.url).href }).catch((error) => {
    console.warn('[mcp-devtools] could not connect to the dev server', error)
  })
})()
