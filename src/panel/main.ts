import { getDevframeConnection } from 'devframe/client'
import { resolveMcpUrl } from '../shared'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

/**
 * The hub MCP route is only known to the hub connection, which the parent
 * window holds when this page runs as a dock. Wait briefly for it: the dock
 * can open before the hub runtime has connected.
 */
function findMcpUrl(attempts = 20, interval = 250): Promise<string | undefined> {
  return new Promise((resolve) => {
    const tick = () => {
      const connection = getDevframeConnection()
      const url = connection && resolveMcpUrl(connection)
      if (url || --attempts <= 0) resolve(url)
      else setTimeout(tick, interval)
    }
    tick()
  })
}

async function main() {
  const mcpUrl = await findMcpUrl()
  if (!mcpUrl) {
    $('status').textContent =
      'Open this page from the devtools dock to see the MCP URL of this dev server.'
    return
  }
  $('mcp-url').textContent = mcpUrl
  const origin = new URL(mcpUrl).origin
  $('snippet-claude').textContent =
    `claude mcp add --transport http medula ${mcpUrl} --header "Origin: ${origin}"`
  $('snippet-json').textContent = JSON.stringify(
    { mcpServers: { medula: { type: 'http', url: mcpUrl, headers: { Origin: origin } } } },
    null,
    2,
  )
  $('status').hidden = true
  $('mcp').hidden = false
}

void main()
