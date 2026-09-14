import { createPageScriptChannel } from 'devframe/in-page-channel'
import type {
  CreatePageScriptChannelOptions,
  InPageChannelProtocol,
} from 'devframe/in-page-channel'
import { MCP_DEVTOOLS_ID } from '../shared'

/**
 * Register extra agent tools from an adapter (framework internals, custom
 * actions). Functions with `agent` metadata and `jsonSerializable: true`
 * become MCP tools named `mcp-devtools_<namespace>_<function>`. Browser only;
 * returns a dispose function.
 *
 * @example
 * registerAgentTools<MyProtocol>('vue', {
 *   'list-components': { type: 'query', jsonSerializable: true, agent: { description: '…' }, handler: () => [] },
 * })
 */
export function registerAgentTools<P extends InPageChannelProtocol>(
  namespace: string,
  functions: CreatePageScriptChannelOptions<P>['functions'],
): () => void {
  if (typeof window === 'undefined') return () => {}
  const channel = createPageScriptChannel<P>({
    name: `${MCP_DEVTOOLS_ID}:${namespace}`,
    functions,
  })
  return () => channel.close()
}
