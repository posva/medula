import { afterEach, expect, it } from 'vitest'
import { installSolid2RuntimeHook } from './hook2'
import { installSolidInternals } from './internals'
// Load the browser build and its development dependencies, not the SSR exports.
import * as solid from 'solid-js-v2'

const originalOwnerHook = solid.DEV!.hooks.onOwner
const key = Symbol.for('medula:solid')
const registry = Symbol.for('devframe:browser-agent-registry')
let stop: (() => void) | undefined
let disposeRoot: (() => void) | undefined
function tool(name: string, args = {}): Promise<any> {
  const tools = (globalThis as any)[registry].tools
  return [...tools.values()]
    .find((tool: any) => tool.id === `medula:solid:${name}`)
    .invoke({ arg0: args })
}
afterEach(() => {
  disposeRoot?.()
  stop?.()
  delete (globalThis as any)[key]
  delete (globalThis as any)[Symbol.for('medula:solid2-wrappers')]
  solid.DEV!.hooks.onOwner = originalOwnerHook
})
it('inspects and edits the real Solid 2 runtime and removes disposed components', async () => {
  const runtime = installSolid2RuntimeHook(solid)
  stop = installSolidInternals()
  const [theme] = runtime.createSignal('light', { name: 'theme' })
  let count: () => number, todos: any, doubled: () => number
  solid.createRoot((dispose) => {
    disposeRoot = dispose
    solid.createComponent(
      function App() {
        ;[count] = runtime.createSignal(0, { name: 'count' })
        ;[todos] = runtime.createStore({ list: [1, 2] }, { name: 'todos' })
        doubled = runtime.createMemo(() => count() * 2, { name: 'doubled' })
        return null
      },
      { title: 'hello' },
    )
  })
  solid.flush()
  const tree = await tool('list-components')
  const app = tree.find((entry: any) => entry.name === 'App')
  expect(app).toMatchObject({ state: ['count', 'todos'], derived: ['doubled'], props: ['title'] })
  const write = (label: string, path: (string | number)[], value: unknown) =>
    tool('set-component-state', { id: app.id, label, path, value })
  expect(await write('count', [], 4)).toMatchObject({ value: 4 })
  expect(count!()).toBe(4)
  expect(doubled!()).toBe(8)
  await write('todos', ['list', 1], 7)
  expect(solid.untrack(() => todos.list[1])).toBe(7)
  expect(await tool('get-component-state', { id: app.id })).toMatchObject({
    state: { count: 4, todos: { list: [1, 7] } },
    derived: { doubled: 8 },
  })
  await expect(write('doubled', [], 10)).rejects.toThrow(/read-only/)
  await tool('set-component-state', { id: 'module', label: 'theme', path: [], value: 'dark' })
  expect(theme()).toBe('dark')
  disposeRoot!()
  expect((await tool('list-components')).some((entry: any) => entry.id === app.id)).toBe(false)
})

it('shares discovery when both Solid 2 entry points use the same DEV object', async () => {
  const appRuntime = installSolid2RuntimeHook(solid)
  const primitives = installSolid2RuntimeHook({ ...solid })
  stop = installSolidInternals()
  solid.createRoot((dispose) => {
    disposeRoot = dispose
    solid.createComponent(function App() {
      appRuntime.createSignal(1, { name: 'app' })
      primitives.createSignal(2, { name: 'library' })
      return null
    }, {})
  })
  const tree = await tool('list-components')
  expect(tree).toHaveLength(1)
  expect(tree[0].state).toEqual(['app', 'library'])
})

it('keeps array projections read-only and supports writable derived signals', async () => {
  const runtime = installSolid2RuntimeHook(solid)
  stop = installSolidInternals()
  let projection: any
  solid.createRoot((dispose) => {
    disposeRoot = dispose
    solid.createComponent(function App() {
      const [count] = runtime.createSignal(() => 2, { name: 'count' })
      projection = runtime.createProjection(
        (draft: number[]) => {
          draft[0] = count()
        },
        [0],
        { name: 'projection' },
      )
      return null
    }, {})
  })
  solid.flush()
  const [app] = await tool('list-components')
  expect(app).toMatchObject({ state: ['count'], derived: ['projection'] })
  await tool('set-component-state', { id: app.id, label: 'count', path: [], value: 9 })
  expect(solid.untrack(() => projection[0])).toBe(9)
  expect(await tool('get-component-state', { id: app.id })).toMatchObject({
    state: { count: 9 },
    derived: { projection: [9] },
  })
  await expect(
    tool('set-component-state', { id: app.id, label: 'projection', path: [0], value: 7 }),
  ).rejects.toThrow(/read-only/)
})

it('reads pending and failed memos without breaking the rest of the component state', async () => {
  const runtime = installSolid2RuntimeHook(solid)
  stop = installSolidInternals()
  let resolveValue!: (value: number) => void
  const pending = new Promise<number>((resolve) => {
    resolveValue = resolve
  })
  solid.createRoot((dispose) => {
    disposeRoot = dispose
    solid.createComponent(function App() {
      runtime.createSignal(1, { name: 'count' })
      runtime.createMemo(() => pending, { name: 'pending', lazy: true })
      runtime.createMemo(
        () => {
          throw new Error('test failure')
        },
        { name: 'failed', lazy: true },
      )
      return null
    }, {})
  })
  const [app] = await tool('list-components')
  expect(await tool('get-component-state', { id: app.id })).toMatchObject({
    state: { count: 1 },
    derived: { pending: null, failed: null },
  })
  resolveValue(3)
  await pending
  solid.flush()
  expect(await tool('get-component-state', { id: app.id })).toMatchObject({
    derived: { pending: 3, failed: null },
  })
})
