/** Devframe id. Also the in-page channel name and the MCP tool prefix. */
export const MEDULA_ID = 'medula'

/** Default mount base of the devframe inside the host dev server. */
export const MEDULA_BASE: string = '/__medula/'

/** URL of the dock client script (page script) served with the config page. */
export function connectScriptUrl(base: string = MEDULA_BASE): string {
  return `${base.endsWith('/') ? base : `${base}/`}connect.js`
}

/** The parts of a devframe connection needed to locate the hub MCP route. */
export interface McpConnectionLike {
  /** Absolute URL of the hub `__connection.json`. */
  metaBaseUrl: string
  connectionMeta: { mcp?: { path: string; port?: number } }
}

/**
 * Absolute URL of the hub MCP route. The advertised `mcp.path` is relative to
 * the hub connection meta, so it only resolves from the hub connection (not
 * from the copy served under a dock base). `undefined` when the hub exposes
 * no MCP route.
 */
export function resolveMcpUrl(connection: McpConnectionLike): string | undefined {
  const mcp = connection.connectionMeta.mcp
  if (!mcp) return undefined
  const url = new URL(mcp.path, connection.metaBaseUrl)
  if (mcp.port) url.port = String(mcp.port)
  return url.href
}
