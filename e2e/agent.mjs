#!/usr/bin/env node
/* oxlint-disable no-console, no-await-in-loop */
/**
 * E2E: a real coding agent changes page state through the `devframe connect`
 * MCP server (configured in .mcp.json / .codex/config.toml like pinia-colada).
 *
 *   node e2e/agent.mjs            # Claude Code
 *   node e2e/agent.mjs --agent codex
 */
import { execFileSync, spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const agent = args[args.indexOf('--agent') + 1] || 'claude'
const port = Number(args[args.indexOf('--port') + 1]) || 5199
const origin = `http://localhost:${port}`
const base = `${origin}/__mcp-devtools/`
const expected = { count: 42, label: 'agent' }

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

async function getCounter() {
  const result = await mcp('tools/call', {
    name: 'mcp-devtools_get-state',
    arguments: { arg0: { name: 'counter' } },
  })
  if (result.result?.isError) throw new Error(result.result.content[0].text)
  return JSON.parse(result.result.content[0].text).value
}

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
      'e2e/fixture',
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
    return list.result?.tools.some((t) => t.name === 'mcp-devtools_get-state')
  }, 'page tools over MCP')

  const before = await getCounter()
  console.log('▶ state before:', JSON.stringify(before))

  const prompt = [
    'You control an open web page through the "devframe" MCP server.',
    'First call devframe_connect_list-instances to find the running dev server and its tools.',
    'Then use devframe_connect_call-tool (args: { port, tool, args }) to run mcp-devtools_list-states,',
    'read the "counter" state with mcp-devtools_get-state, and change it so that count is 42 and label is "agent"',
    '(mcp-devtools_set-state or mcp-devtools_patch-state; their arguments are wrapped in an "arg0" object).',
    'Do not read or edit any file. Finish by printing the final state JSON only.',
  ].join(' ')

  console.log(`▶ running ${agent}…`)
  const { text, toolCalls } = runAgent(prompt)
  console.log(text.trim())
  const mcpCalls = toolCalls.filter((name) => name.startsWith('mcp__devframe__'))
  console.log(`▶ MCP tool calls: ${mcpCalls.length} (${[...new Set(mcpCalls)].join(', ')})`)

  // the page connection can be re-established right after the run
  const after = await waitFor(getCounter, 'state read-back', 30_000)
  console.log('▶ state after:', JSON.stringify(after))
  const usedMcp = mcpCalls.length > 0
  const pass = usedMcp && after.count === expected.count && after.label === expected.label
  console.log(pass ? '✔ PASS: the agent changed the page state' : '✘ FAIL: state does not match')
  process.exit(pass ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
