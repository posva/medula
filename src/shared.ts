/** Devframe id. Also the in-page channel name and the MCP tool prefix. */
export const MEDULA_ID = 'medula'

/** Default mount base of the devframe inside the host dev server. */
export const MEDULA_BASE: string = '/__medula/'

/** URL of the script that connects the app page to the devframe RPC. */
export function connectScriptUrl(base: string = MEDULA_BASE): string {
  return `${base.endsWith('/') ? base : `${base}/`}connect.js`
}
