/** Devframe id. Also the in-page channel name and the MCP tool prefix. */
export const MCP_DEVTOOLS_ID = 'mcp-devtools'

/** Default mount base of the devframe inside the host dev server. */
export const MCP_DEVTOOLS_BASE: string = `/__${MCP_DEVTOOLS_ID}/`

/** URL of the script that connects the app page to the devframe RPC. */
export function connectScriptUrl(base: string = MCP_DEVTOOLS_BASE): string {
  return `${base.endsWith('/') ? base : `${base}/`}connect.js`
}
