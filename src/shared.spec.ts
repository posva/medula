import { describe, expect, it } from 'vitest'
import { resolveMcpUrl } from './shared'

describe('resolveMcpUrl', () => {
  const metaBaseUrl = 'http://localhost:5173/__devtools/__connection.json'

  it('resolves the hub MCP route next to the hub connection meta', () => {
    expect(
      resolveMcpUrl({
        metaBaseUrl,
        connectionMeta: { mcp: { path: '__mcp' } },
      }),
    ).toBe('http://localhost:5173/__devtools/__mcp')
  })

  it('honours a side-car MCP port', () => {
    expect(
      resolveMcpUrl({
        metaBaseUrl,
        connectionMeta: { mcp: { path: '__mcp', port: 9777 } },
      }),
    ).toBe('http://localhost:9777/__devtools/__mcp')
  })

  it('returns undefined when the hub exposes no MCP route', () => {
    expect(resolveMcpUrl({ metaBaseUrl, connectionMeta: {} })).toBeUndefined()
  })
})
