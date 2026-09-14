/**
 * Loaded by the app page as `<script type="module" src="<base>connect.js">`.
 * Connects to the devframe RPC (`./__connection.json` next to this script);
 * devframe then mirrors the page's agent tools (from `mcp-devtools/client`)
 * to the node side, where MCP serves them.
 */
import { connectDevframe } from 'devframe/client'

const KEY = Symbol.for('mcp-devtools:connect')
const g = globalThis as { [KEY]?: Promise<unknown> }

// this script lives at `<base>connect.js`; shared chunks live deeper, so resolve
// `__connection.json` from here instead of from the executing chunk
g[KEY] ??= connectDevframe({ baseURL: new URL('./', import.meta.url).href }).catch((error) => {
  console.warn('[mcp-devtools] could not connect to the dev server', error)
})
