#!/usr/bin/env node
/* oxlint-disable no-console, no-await-in-loop */
/**
 * E2E: a real coding agent changes page state through the `devframe connect`
 * MCP server (configured in .mcp.json / .codex/config.toml like pinia-colada).
 *
 *   node e2e/agent.mjs                       # Claude Code, explicit exposeState fixture
 *   node e2e/agent.mjs --scenario vue        # zero-config Vue playground (component + Pinia tools)
 *   node e2e/agent.mjs --scenario svelte     # zero-config Svelte playground
 *   node e2e/agent.mjs --scenario solid      # zero-config Solid playground
 *   node e2e/agent.mjs --agent codex
 */
import { execFileSync, spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const agent = args[args.indexOf('--agent') + 1] || 'claude'
const scenarioName = args[args.indexOf('--scenario') + 1] || 'fixture'

/**
 * Scenarios: `fixture` uses the explicit `exposeState` API; `vue` drives the
 * zero-config Vue playground through the component tools (no app code).
 */
const scenarios = {
  fixture: {
    port: 5199,
    viteRoot: 'e2e/fixture',
    readyTool: 'medula_get-state',
    read: async () => stateValue(await callTool('medula_get-state', { name: 'counter' })),
    prompt:
      'read the "counter" state with medula_get-state, and change it so that count is 42 and label is "agent" (medula_set-state or medula_patch-state; their arguments are wrapped in an "arg0" object).',
    check: (value) => value.count === 42 && value.label === 'agent',
  },
  vue: {
    port: 5173,
    viteRoot: 'playgrounds/vue-vite',
    readyTool: 'medula_vue_list-components',
    read: async () => {
      const tree = await callTool('medula_vue_list-components', {})
      const app = tree.find((node) => node.name === 'App') ?? tree[0]
      const state = await callTool('medula_vue_get-component-state', { id: app.id })
      return {
        id: app.id,
        title: state.setupState.title,
        todos: await callTool('medula_get-state', { name: 'pinia:todos' }),
      }
    },
    prompt:
      'call medula_vue_list-components, find the "App" component, read it with medula_vue_get-component-state, then use medula_vue_set-component-state to change its setupState "title" to "Title set by the agent". Also read the "pinia:todos" state with medula_get-state and set its "filter" to "done" with medula_patch-state. Tool arguments are wrapped in an "arg0" object.',
    check: (value) =>
      value.title === 'Title set by the agent' && value.todos?.value?.filter === 'done',
  },
  svelte: {
    port: 5175,
    viteRoot: 'playgrounds/svelte-vite',
    readyTool: 'medula_svelte_list-components',
    read: async () => {
      const tree = await callTool('medula_svelte_list-components', {})
      const app = flatten(tree).find((node) => node.name === 'App')
      const state = await callTool('medula_svelte_get-component-state', { id: app.id })
      return { id: app.id, count: state.state.count, city: state.state.user?.address?.city }
    },
    prompt:
      'call medula_svelte_list-components, find the "App" component, read it with medula_svelte_get-component-state, then use medula_svelte_set-component-state to set its "count" state to 42 (empty path) and the "user" state at path ["address","city"] to "Lyon". Tool arguments are wrapped in an "arg0" object.',
    check: (value) => value.count === 42 && value.city === 'Lyon',
  },
  solid: {
    port: 5176,
    viteRoot: 'playgrounds/solid-vite',
    readyTool: 'medula_solid_list-components',
    read: async () => {
      const tree = await callTool('medula_solid_list-components', {})
      const app = flatten(tree).find((node) => node.name === 'App')
      const state = await callTool('medula_solid_get-component-state', { id: app.id })
      return { id: app.id, count: state.state.count, city: state.state.user?.address?.city }
    },
    prompt:
      'call medula_solid_list-components, find the "App" component, read it with medula_solid_get-component-state, then use medula_solid_set-component-state to set its "count" state to 42 (empty path) and the "user" state at path ["address","city"] to "Lyon". Tool arguments are wrapped in an "arg0" object.',
    check: (value) => value.count === 42 && value.city === 'Lyon',
  },
}
const flatten = (nodes) => nodes.flatMap((node) => [node, ...flatten(node.children ?? [])])
const scenario = scenarios[scenarioName]
if (!scenario) {
  throw new Error(`Unknown scenario "${scenarioName}" (${Object.keys(scenarios).join(', ')})`)
}
const port = Number(args[args.indexOf('--port') + 1]) || scenario.port
const origin = `http://localhost:${port}`
// medula is a Vite DevTools dock: the hub owns the connection meta and the MCP route
const base = `${origin}/__devtools/`

const children = []
function cleanup() {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill()
    }
  }
  try {
    execFileSync('agent-browser', ['close'], { stdio: 'ignore' })
  } catch {}
}
process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(130))

async function waitFor(check, label, timeout = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const value = await check()
      if (value) return value
    } catch {}
    await sleep(300)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function mcp(method, params, id = 1) {
  const res = await fetch(`${base}__mcp`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  const text = await res.text()
  const data = text
    .split('\n')
    .find((line) => line.startsWith('data: '))
    ?.slice(6)
  return JSON.parse(data ?? text)
}

async function callTool(name, arg0) {
  const result = await mcp('tools/call', { name, arguments: { arg0 } })
  if (result.result?.isError) throw new Error(result.result.content[0].text)
  return JSON.parse(result.result.content[0].text)
}

const stateValue = (result) => result.value

function runAgent(prompt) {
  // a nested Claude Code refuses to start while CLAUDECODE is set
  const env = { ...process.env, CLAUDECODE: undefined }
  if (agent === 'codex') {
    // approvals go through Codex's automatic reviewer; the sandbox stays on
    const raw = execFileSync(
      'codex',
      ['exec', '--skip-git-repo-check', '-C', root, '--approve-for-me', '--json', prompt],
      { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64e6 },
    )
    const items = raw
      .trim()
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .map((event) => event.item)
      .filter(Boolean)
    const toolCalls = items
      .filter((item) => item.type === 'mcp_tool_call')
      .map((item) => `mcp__${item.server}__${item.tool}`)
    const text = items.findLast((item) => item.type === 'agent_message')?.text ?? ''
    return { text, toolCalls }
  }
  const raw = execFileSync(
    'claude',
    [
      '-p',
      prompt,
      '--mcp-config',
      '.mcp.json',
      '--strict-mcp-config',
      // the MCP server is the only way to reach the page
      '--tools',
      '',
      '--allowedTools',
      'mcp__devframe__devframe_connect_list-instances',
      'mcp__devframe__devframe_connect_call-tool',
      // project hooks would format files and make Vite reload the page
      '--setting-sources',
      'user',
      '--output-format',
      'stream-json',
      '--verbose',
      '--max-turns',
      '20',
    ],
    { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64e6 },
  )
  const events = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const toolCalls = events
    .flatMap((event) => event.message?.content ?? [])
    .filter((block) => block.type === 'tool_use')
    .map((block) => block.name)
  const result = events.find((event) => event.type === 'result')
  return { text: result?.result ?? '', toolCalls }
}

async function main() {
  console.log(`▶ starting fixture dev server on ${origin}`)
  // run vite's bin directly (no pnpm wrapper) in its own process group so
  // cleanup can kill it reliably
  const vite = spawn(
    process.execPath,
    [
      fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
      scenario.viteRoot,
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: root, stdio: 'ignore', detached: true },
  )
  children.push(vite)
  await waitFor(async () => (await fetch(`${base}__connection.json`)).ok, 'dev server')

  console.log('▶ opening the page in a browser so its tools reach MCP')
  execFileSync('agent-browser', ['open', `${origin}/`], { stdio: 'ignore' })
  await waitFor(async () => {
    const list = await mcp('tools/list', {})
    return list.result?.tools.some((t) => t.name === scenario.readyTool)
  }, 'page tools over MCP')

  const before = await scenario.read()
  console.log('▶ state before:', JSON.stringify(before))

  const prompt = [
    'You control an open web page through the "devframe" MCP server.',
    'First call devframe_connect_list-instances to find the running dev server and its tools.',
    'Then use devframe_connect_call-tool (args: { port, tool, args }) on that port:',
    scenario.prompt,
    'Do not read or edit any file. Finish by printing the final state JSON only.',
  ].join(' ')

  console.log(`▶ running ${agent}…`)
  const { text, toolCalls } = runAgent(prompt)
  console.log(text.trim())
  const mcpCalls = toolCalls.filter((name) => name.startsWith('mcp__devframe__'))
  console.log(`▶ MCP tool calls: ${mcpCalls.length} (${[...new Set(mcpCalls)].join(', ')})`)

  // the page connection can be re-established right after the run
  const after = await waitFor(scenario.read, 'state read-back', 30_000)
  console.log('▶ state after:', JSON.stringify(after))
  const usedMcp = mcpCalls.length > 0
  const pass = usedMcp && scenario.check(after)
  console.log(pass ? '✔ PASS: the agent changed the page state' : '✘ FAIL: state does not match')
  process.exit(pass ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
