import { connectDevframe } from 'devframe/client'
import type { ConnectionMeta } from 'devframe'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

function setStatus(text: string, kind?: 'ok' | 'warn') {
  const el = $('status')
  el.textContent = text
  el.className = `status ${kind ?? ''}`
}

async function main() {
  const meta: ConnectionMeta = await (await fetch('./__connection.json')).json()
  const mcpPath = meta.mcp?.path
  if (!mcpPath) {
    setStatus('MCP route is off. Enable it with `mcp: true`.', 'warn')
    return
  }
  const mcpUrl = new URL(mcpPath, document.baseURI)
  if (meta.mcp?.port) mcpUrl.port = String(meta.mcp.port)
  $('mcp-url').textContent = mcpUrl.href
  $('snippet-claude').textContent = `claude mcp add --transport http medula ${mcpUrl.href}`
  $('snippet-json').textContent = JSON.stringify(
    { mcpServers: { medula: { type: 'http', url: mcpUrl.href } } },
    null,
    2,
  )

  const rpc = await connectDevframe({ baseURL: document.baseURI })
  setStatus('Connected to the dev server.', 'ok')

  const list = $('tools')
  async function refresh() {
    const tools = (await rpc.call('devframe:agent:list-tools')) as Array<{
      id: string
      description?: string
    }>
    list.replaceChildren(
      ...tools.map((tool) => {
        const li = document.createElement('li')
        const b = document.createElement('b')
        b.textContent = tool.id
        const span = document.createElement('span')
        span.textContent = tool.description ?? ''
        li.append(b, span)
        return li
      }),
    )
  }
  await refresh()
  // client tools sync when pages connect; poll cheaply
  setInterval(() => refresh().catch(() => {}), 3000)
}

main().catch((error) => {
  console.error(error)
  setStatus(`Cannot reach the dev server: ${(error as Error).message}`, 'warn')
})
