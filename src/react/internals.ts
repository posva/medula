import type { InPageChannelProtocol } from 'devframe/in-page-channel'
import { z } from 'zod'
import { registerAgentTools } from '../client/tools'
import { setAtPath } from '../client/path'
import type { StatePath } from '../client/path'
import { toJsonValue } from '../client/serialize'
import type { JsonValue } from '../client/serialize'
import { REACT_HOOK_STORE_KEY } from './hook'
import type { ReactHookStore } from './hook'

// react-reconciler work tags
const FunctionComponent = 0
const ClassComponent = 1
const ForwardRef = 11
const MemoComponent = 14
const SimpleMemoComponent = 15
const LISTED_TAGS = new Set([
  FunctionComponent,
  ClassComponent,
  ForwardRef,
  MemoComponent,
  SimpleMemoComponent,
])

interface Fiber {
  tag: number
  type: any
  memoizedProps: any
  pendingProps: any
  memoizedState: any
  stateNode: any
  child: Fiber | null
  sibling: Fiber | null
  alternate: Fiber | null
}

interface FiberRoot {
  current: Fiber
}

interface Hook {
  memoizedState: unknown
  queue: {
    lastRenderedReducer?: (...args: unknown[]) => unknown
    lastRenderedState?: unknown
  } | null
  next: Hook | null
}

interface RendererInternals {
  version?: string
  bundleType?: number
  overrideHookState?: (fiber: Fiber, id: number, path: StatePath, value: unknown) => void
  overrideProps?: (fiber: Fiber, path: StatePath, value: unknown) => void
}

interface DevtoolsHook {
  renderers: Map<number, RendererInternals>
  getFiberRoots?: (id: number) => Set<FiberRoot>
}

export interface ComponentSummary {
  id: number
  name: string
  statefulHooks: number
  propKeys: string[]
  children: ComponentSummary[]
}

export interface HookValue {
  index: number
  kind: 'useState' | 'useReducer' | 'other'
  value: JsonValue
}

export interface ComponentDetails {
  id: number
  name: string
  props: JsonValue
  hooks: HookValue[]
  /** Class components only. */
  state?: JsonValue
}

export interface MedulaReactProtocol extends InPageChannelProtocol {
  pageScript: {
    'list-components': () => ComponentSummary[]
    'get-component': (args: { id: number }) => ComponentDetails
    'set-hook-state': (args: {
      id: number
      hookIndex: number
      path: StatePath
      value: unknown
    }) => HookValue
    'set-props': (args: { id: number; path: StatePath; value: unknown }) => ComponentDetails
  }
}

const idSchema = z.number().int().describe('Component id from list-components.')
const pathSchema = z
  .array(z.union([z.string(), z.number().int().nonnegative()]))
  .describe('Path inside the value: object keys and array indexes. Empty replaces the whole value.')
const jsonSchema: z.ZodType<JsonValue> = z.json()

const componentSummarySchema: z.ZodType<ComponentSummary> = z.lazy(() =>
  z.object({
    id: z.number(),
    name: z.string(),
    statefulHooks: z.number(),
    propKeys: z.array(z.string()),
    children: z.array(componentSummarySchema),
  }),
)
const hookValueSchema = z.object({
  index: z.number(),
  kind: z.enum(['useState', 'useReducer', 'other']),
  value: jsonSchema,
})
const componentDetailsSchema = z.object({
  id: z.number(),
  name: z.string(),
  props: jsonSchema,
  hooks: z.array(hookValueSchema),
  state: jsonSchema.optional(),
})

const HOOK_MISSING =
  '[medula] React DevTools hook not found before React loaded. Enable it with the `medula()` Vite plugin, or inline `reactDevtoolsHookScript` from medula/next in <head>.'
const INTERNALS_MISSING =
  '[medula] React internals are not available: this needs a development build of React.'

function getHook(): DevtoolsHook {
  const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ as DevtoolsHook | undefined
  if (!hook?.renderers || typeof hook.getFiberRoots !== 'function') throw new Error(HOOK_MISSING)
  return hook
}

function* liveRoots(): Generator<[RendererInternals, FiberRoot]> {
  const hook = getHook()
  for (const [id, renderer] of hook.renderers) {
    for (const root of hook.getFiberRoots!(id)) yield [renderer, root]
  }
}

// ids follow the fiber pair (current + alternate), so they survive re-renders
const ids = new WeakMap<Fiber, number>()
let nextId = 1

function idOf(fiber: Fiber): number {
  let id = ids.get(fiber) ?? (fiber.alternate ? ids.get(fiber.alternate) : undefined)
  if (id === undefined) id = nextId++
  ids.set(fiber, id)
  if (fiber.alternate) ids.set(fiber.alternate, id)
  return id
}

function nameOf(fiber: Fiber): string {
  const type = fiber.type
  if (typeof type === 'function') return type.displayName || type.name || 'Anonymous'
  if (type && typeof type === 'object') {
    // memo(forwardRef(...)) and friends
    const inner = type.render ?? type.type
    if (inner) return type.displayName || nameOf({ ...fiber, type: inner })
  }
  return 'Anonymous'
}

function* hooksOf(fiber: Fiber): Generator<[number, Hook]> {
  if (fiber.tag === ClassComponent) return
  let hook = fiber.memoizedState as Hook | null
  for (let index = 0; hook; hook = hook.next, index++) {
    if (hook.queue) yield [index, hook]
  }
}

function hookValue(index: number, hook: Hook): HookValue {
  const reducer = hook.queue?.lastRenderedReducer
  const kind = !reducer ? 'other' : reducer.name === 'basicStateReducer' ? 'useState' : 'useReducer'
  return { index, kind, value: toJsonValue(hook.memoizedState) }
}

function summarize(fiber: Fiber): ComponentSummary {
  return {
    id: idOf(fiber),
    name: nameOf(fiber),
    statefulHooks: [...hooksOf(fiber)].length,
    propKeys: Object.keys(fiber.memoizedProps ?? {}),
    children: collectChildren(fiber.child),
  }
}

function collectChildren(fiber: Fiber | null): ComponentSummary[] {
  const out: ComponentSummary[] = []
  for (; fiber; fiber = fiber.sibling) {
    if (LISTED_TAGS.has(fiber.tag)) out.push(summarize(fiber))
    // host elements and wrappers are skipped, their components are hoisted
    else out.push(...collectChildren(fiber.child))
  }
  return out
}

function findFiber(fiber: Fiber | null, id: number): Fiber | undefined {
  for (; fiber; fiber = fiber.sibling) {
    if (LISTED_TAGS.has(fiber.tag) && idOf(fiber) === id) return fiber
    const found = findFiber(fiber.child, id)
    if (found) return found
  }
  return undefined
}

/** Resolve an id to its CURRENT fiber (the mounted one, not the alternate). */
function requireFiber(id: number): { fiber: Fiber; renderer: RendererInternals } {
  for (const [renderer, root] of liveRoots()) {
    const fiber = findFiber(root.current, id)
    if (fiber) return { fiber, renderer }
  }
  throw new Error(`[medula] Unknown component id ${id}. Call list-components first.`)
}

function details(id: number, fiber: Fiber): ComponentDetails {
  const out: ComponentDetails = {
    id,
    name: nameOf(fiber),
    props: toJsonValue(fiber.memoizedProps),
    hooks: [...hooksOf(fiber)].map(([index, hook]) => hookValue(index, hook)),
  }
  if (fiber.tag === ClassComponent) out.state = toJsonValue(fiber.stateNode?.state)
  return out
}

/**
 * Run `listener` for every injected React renderer, past and future. The
 * store is shared with the hook shim, which may run before or after this.
 */
export function onReactRenderer(listener: (id: number, renderer: unknown) => void): () => void {
  const g = globalThis as unknown as Record<symbol, ReactHookStore | undefined>
  const store = (g[REACT_HOOK_STORE_KEY] ??= { renderers: new Map(), listeners: new Set() })
  store.listeners.add(listener)
  for (const [id, renderer] of store.renderers) listener(id, renderer)
  return () => {
    store.listeners.delete(listener)
  }
}

let dispose: (() => void) | undefined

/**
 * Register the `react` agent tools (`medula_react_*`): inspect and edit
 * component hooks/props like React DevTools. The tools appear once a React
 * renderer injects into the DevTools hook (installed before React by the
 * bootstrap script). Idempotent, browser only.
 */
export function installReactInternals(): () => void {
  if (dispose || typeof window === 'undefined') return dispose ?? (() => {})
  let stopTools: (() => void) | undefined
  const stopListening = onReactRenderer(() => {
    stopTools ??= registerTools()
  })
  dispose = () => {
    stopListening()
    stopTools?.()
    dispose = undefined
  }
  return dispose
}

function registerTools(): () => void {
  return registerAgentTools<MedulaReactProtocol>('react', {
    'list-components': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({}).describe('No arguments.')],
      returns: z.array(componentSummarySchema),
      agent: {
        title: 'List React components',
        description:
          'Tree of the mounted React components with their number of stateful hooks (useState/useReducer) and prop names. Use this to reach internal component state. Ids are stable while the component stays mounted.',
      },
      handler: () => {
        const out: ComponentSummary[] = []
        for (const [, root] of liveRoots()) out.push(...collectChildren(root.current))
        return out
      },
    },
    'get-component': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({ id: idSchema })],
      returns: componentDetailsSchema,
      agent: {
        title: 'Inspect a React component',
        description:
          'Props and stateful hook values of one component (id from list-components). `hooks[].index` is the hook position you pass to set-hook-state. Hooks with kind `other`, including external store snapshots, are read-only. Class components also return `state`.',
      },
      handler: ({ id }) => details(id, requireFiber(id).fiber),
    },
    'set-hook-state': {
      type: 'action',
      jsonSerializable: true,
      args: [
        z.object({
          id: idSchema,
          hookIndex: z.number().int().nonnegative().describe('`hooks[].index` from get-component.'),
          path: pathSchema,
          value: jsonSchema.describe('New JSON value written at the path.'),
        }),
      ],
      returns: hookValueSchema,
      agent: {
        title: 'Set React hook state',
        description:
          'Write a value into a useState/useReducer hook of a component, like editing it in React DevTools; the component re-renders. Hooks with kind `other` are read-only: external stores must be changed through their own APIs. Flow: list-components -> get-component -> set-hook-state. Development builds of React only.',
      },
      handler: ({ id, hookIndex, path, value }) => {
        const { fiber, renderer } = requireFiber(id)
        if (fiber.tag === ClassComponent) {
          const instance = fiber.stateNode
          // setState is async: report the state we asked for
          const next = setAtPath(instance.state, path, value)
          instance.setState(next)
          return { index: hookIndex, kind: 'other', value: toJsonValue(next) }
        }
        if (typeof renderer.overrideHookState !== 'function') throw new Error(INTERNALS_MISSING)
        const hook = [...hooksOf(fiber)].find(([index]) => index === hookIndex)
        if (!hook) {
          throw new Error(`[medula] Component ${id} has no stateful hook at index ${hookIndex}.`)
        }
        if (typeof hook[1].queue?.lastRenderedReducer !== 'function') {
          throw new Error(
            '[medula] Only useState and useReducer hooks can be edited. External store snapshots are read-only; update the store through its own API.',
          )
        }
        renderer.overrideHookState(fiber, hookIndex, path, value)
        // React's override leaves the eager update cache at the old value.
        if (hook[1].queue && 'lastRenderedState' in hook[1].queue) {
          hook[1].queue.lastRenderedState = hook[1].memoizedState
        }
        return hookValue(hookIndex, hook[1])
      },
    },
    'set-props': {
      type: 'action',
      jsonSerializable: true,
      args: [
        z.object({
          id: idSchema,
          path: pathSchema,
          value: jsonSchema.describe('New JSON value written at the path.'),
        }),
      ],
      returns: componentDetailsSchema,
      agent: {
        title: 'Set React props',
        description:
          'Override a prop of a component at a path and re-render it, like editing props in React DevTools. The parent keeps its own values, so the next parent render restores them. Development builds of React only.',
      },
      handler: ({ id, path, value }) => {
        const { fiber, renderer } = requireFiber(id)
        if (fiber.tag === ClassComponent) {
          const instance = fiber.stateNode
          fiber.pendingProps = setAtPath(instance.props, path, value)
          instance.forceUpdate()
        } else {
          if (typeof renderer.overrideProps !== 'function') throw new Error(INTERNALS_MISSING)
          renderer.overrideProps(fiber, path, value)
        }
        return { ...details(id, fiber), props: toJsonValue(fiber.pendingProps) }
      },
    },
  })
}
