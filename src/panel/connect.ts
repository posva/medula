/**
 * The page script, loaded as `<script type="module" src="<base>connect.js">`
 * by the host adapter (no app code needed). It registers the state tools,
 * discovers Vue apps, React renderers and Svelte components through the hooks
 * the bootstrap script installed, and connects to the devframe RPC
 * (`./__connection.json` next to this script) so devframe mirrors the tools to
 * MCP.
 *
 * Several open tabs offer the same tools: only visible tabs stay connected,
 * and a tab reconnects when it gains focus so it becomes the most recently
 * synced page, the one devframe routes tool calls to.
 */
import { connectDevframe } from 'devframe/client'
import { ensureChannel } from '../client/channel'
import { installReactInternals } from '../react/internals'
import { installSvelteInternals } from '../svelte/internals'
import { installVueInternals } from '../vue/internal'

const KEY = Symbol.for('mcp-devtools:connect')
const g = globalThis as { [KEY]?: true }

if (!g[KEY]) {
  g[KEY] = true
  ensureChannel()
  installVueInternals()
  installReactInternals()
  installSvelteInternals()

  // this script lives at `<base>connect.js`; shared chunks live deeper, so resolve
  // `__connection.json` from here instead of from the executing chunk
  const baseURL = new URL('./', import.meta.url).href
  let connection: Promise<{ close: () => void } | undefined> | undefined

  const connect = () => {
    connection ??= connectDevframe({ baseURL }).catch((error) => {
      console.warn('[mcp-devtools] could not connect to the dev server', error)
      return undefined
    })
  }
  const disconnect = () => {
    const current = connection
    connection = undefined
    void current?.then((client) => client?.close())
  }

  const reconnect = () => {
    disconnect()
    connect()
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) disconnect()
    else reconnect()
  })
  window.addEventListener('focus', reconnect)
  window.addEventListener('pagehide', disconnect)
  if (!document.hidden) connect()
}
