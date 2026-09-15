/**
 * The dock client script (page script), served at `<base>connect.js` next to
 * the config page. The hub client runtime imports it into the app page, so no
 * app code is needed. It registers the state tools and discovers Vue apps,
 * React renderers, Svelte and Solid components through the hooks the
 * bootstrap script and the Vite wrappers installed. The hub's own RPC connection mirrors the tools to MCP;
 * this script never connects on its own, so it coexists with any other dock.
 */
import { ensureChannel } from '../client/channel'
import { installReactInternals } from '../react/internals'
import { installSolidInternals } from '../solid/internals'
import { installSvelteInternals } from '../svelte/internals'
import { installVueInternals } from '../vue/internal'

const KEY = Symbol.for('medula:connect')
const g = globalThis as { [KEY]?: true }

/** Install the channel and the framework internals once per page. */
export default function setup(): void {
  if (g[KEY]) return
  g[KEY] = true
  ensureChannel()
  installVueInternals()
  installReactInternals()
  installSvelteInternals()
  installSolidInternals()
}

setup()
