import type { InPageChannelProtocol } from 'devframe/in-page-channel'
import { z } from 'zod'
import { replaceContents, setAtPath, writeAtPath } from '../client/path'
import type { StatePath } from '../client/path'
import { toJsonValue } from '../client/serialize'
import type { JsonValue } from '../client/serialize'
import { registerAgentTools } from '../client/tools'
import { SOLID_MODULE_ID, SOLID_STORE_KEY } from './hook'
import type {
  SolidComputation,
  SolidHookStore,
  SolidOwner,
  SolidRuntimeInternal,
  SolidSignalState,
  SolidSourceMapValue,
} from './hook'

export interface SolidComponentNode {
  id: string
  name: string
  /** Signal and store labels (writable). */
  state: string[]
  /** Memo labels (read-only). */
  derived: string[]
  /** Prop names as passed by the parent. */
  props: string[]
  children: SolidComponentNode[]
}

export interface SolidComponentState {
  id: string
  name: string
  props: Record<string, JsonValue>
  state: Record<string, JsonValue>
  derived: Record<string, JsonValue>
}

export interface SolidStateValue {
  id: string
  label: string
  value: JsonValue
}

export interface MedulaSolidProtocol extends InPageChannelProtocol {
  pageScript: {
    'list-components': () => SolidComponentNode[]
    'get-component-state': (args: { id: string }) => SolidComponentState
    'set-component-state': (args: {
      id: string
      label: string
      path: StatePath
      value: unknown
    }) => SolidStateValue
  }
}

const idSchema = z.string().min(1).describe('Component id from list-components.')
const pathSchema = z
  .array(z.union([z.string(), z.number().int().nonnegative()]))
  .describe('Path inside the value: object keys and array indexes. Empty replaces the whole value.')
const jsonSchema: z.ZodType<JsonValue> = z.json()
const jsonRecord = z.record(z.string(), jsonSchema)

const componentNodeSchema: z.ZodType<SolidComponentNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    state: z.array(z.string()),
    derived: z.array(z.string()),
    props: z.array(z.string()),
    children: z.array(componentNodeSchema),
  }),
)
const componentStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  props: jsonRecord,
  state: jsonRecord,
  derived: jsonRecord,
})
const stateValueSchema = z.object({ id: z.string(), label: z.string(), value: jsonSchema })

/** solid-refresh (HMR) wraps each component body in a memo with this prefix. */
const REFRESH_PREFIX = '[solid-refresh]'
/** Props whose getters build UI (or hold DOM nodes): never evaluated. */
const SKIPPED_PROPS = new Set(['children', 'ref'])

function getStore(): SolidHookStore {
  const g = globalThis as unknown as Record<symbol, SolidHookStore | undefined>
  return (g[SOLID_STORE_KEY] ??= {
    roots: new Set(),
    subRoots: new Map(),
    unowned: [],
    listeners: new Set(),
  })
}

function requireInternal(): SolidRuntimeInternal {
  const internal = getStore().internal
  if (!internal) {
    throw new Error(
      '[medula] Solid runtime not instrumented: this needs the Vite plugin (medula()) and a development build of solid-js.',
    )
  }
  return internal
}

let ids = new WeakMap<SolidOwner, string>()
let uid = 0

function idOf(owner: SolidOwner): string {
  let id = ids.get(owner)
  if (!id) ids.set(owner, (id = String(++uid)))
  return id
}

function isComponent(owner: SolidOwner): owner is ComponentOwner {
  return typeof (owner as SolidComputation).component === 'function'
}

function isMemo(owner: SolidOwner): owner is SolidComputation {
  return 'fn' in owner && 'comparator' in owner
}

function isSignal(value: SolidSourceMapValue): value is SolidSignalState {
  return 'observers' in value
}

type ComponentOwner = SolidComputation & { component: Function }

interface Collected {
  signals: SolidSourceMapValue[]
  memos: SolidComputation[]
  components: ComponentOwner[]
}

/** solid-refresh wraps the body of a `[solid-refresh]*` component in one memo. */
function isRefreshWrapper(parent: SolidOwner, child: SolidOwner): boolean {
  return (
    isMemo(child) &&
    (child.name?.startsWith(REFRESH_PREFIX) ||
      (isComponent(parent) &&
        parent.owned?.length === 1 &&
        rawName(parent).startsWith(REFRESH_PREFIX)))
  )
}

/**
 * Everything under `owner` up to the next components: signals and memos
 * belong to the nearest component (effects, `<For>` item roots and the HMR
 * memo are transparent), components become its children.
 */
function collect(owner: SolidOwner, into: Collected): void {
  for (const value of owner.sourceMap ?? []) into.signals.push(value)
  const children: SolidOwner[] = [...(owner.owned ?? []), ...(getStore().subRoots.get(owner) ?? [])]
  for (const child of children) {
    if (isComponent(child)) {
      into.components.push(child)
      continue
    }
    if (isMemo(child) && !isRefreshWrapper(owner, child)) into.memos.push(child)
    collect(child, into)
  }
}

interface Entry {
  id: string
  name: string
  signals: Map<string, SolidSourceMapValue>
  memos: Map<string, SolidComputation>
  props: Record<string, unknown>
  children: Entry[]
}

/** Labels: the `name` option (autoname gives the variable name) or a positional fallback. */
function labelled(collected: Collected): Pick<Entry, 'signals' | 'memos'> {
  const signals = new Map<string, SolidSourceMapValue>()
  collected.signals.forEach((value, i) => {
    signals.set(value.name ?? `${isSignal(value) ? 'signal' : 'store'}${i}`, value)
  })
  const memos = new Map<string, SolidComputation>()
  collected.memos.forEach((memo, i) => memos.set(memo.name ?? `memo${i}`, memo))
  return { signals, memos }
}

function rawName(owner: ComponentOwner): string {
  return owner.component.displayName ?? owner.name ?? owner.component.name ?? 'Anonymous'
}

function componentName(owner: ComponentOwner): string {
  const name = rawName(owner)
  return name.startsWith(REFRESH_PREFIX) ? name.slice(REFRESH_PREFIX.length) : name
}

function entry(owner: ComponentOwner): Entry {
  const collected: Collected = { signals: [], memos: [], components: [] }
  collect(owner, collected)
  return {
    id: idOf(owner),
    name: componentName(owner),
    ...labelled(collected),
    props: owner.props ?? {},
    children: collected.components.map(entry),
  }
}

/** The live tree, rebuilt from the roots on every call. */
function snapshot(): Entry[] {
  const store = getStore()
  const module: Collected = { signals: [], memos: [], components: [] }
  store.unowned = store.unowned.filter((entry) => entry.ref.deref() !== undefined)
  for (const { name, ref, signal } of store.unowned) {
    const target = ref.deref()!
    module.signals.push(signal ? (target as SolidSignalState) : { value: target, name })
  }
  for (const root of store.roots) collect(root, module)
  const entries = module.components.map(entry)
  const { signals, memos } = labelled(module)
  if (signals.size || memos.size) {
    entries.push({ id: SOLID_MODULE_ID, name: '(module)', signals, memos, props: {}, children: [] })
  }
  return entries
}

function find(id: string, entries: Entry[] = snapshot()): Entry {
  for (const candidate of entries) {
    if (candidate.id === id) return candidate
    const found = candidate.children.length ? tryFind(id, candidate.children) : undefined
    if (found) return found
  }
  throw new Error(`[medula] Unknown component id "${id}". Call list-components first.`)
}

function tryFind(id: string, entries: Entry[]): Entry | undefined {
  try {
    return find(id, entries)
  } catch {
    return undefined
  }
}

function node(e: Entry): SolidComponentNode {
  return {
    id: e.id,
    name: e.name,
    state: [...e.signals.keys()],
    derived: [...e.memos.keys()],
    props: Object.keys(e.props),
    children: e.children.map(node),
  }
}

function readValue(value: SolidSourceMapValue): JsonValue {
  return toJsonValue(value.value)
}

function details(e: Entry): SolidComponentState {
  const { untrack } = requireInternal()
  const out: SolidComponentState = { id: e.id, name: e.name, props: {}, state: {}, derived: {} }
  for (const key of Object.keys(e.props)) {
    let value: unknown = null
    if (!SKIPPED_PROPS.has(key)) {
      try {
        value = untrack(() => e.props[key])
      } catch {
        value = null
      }
    }
    out.props[key] = toJsonValue(value)
  }
  for (const [label, value] of e.signals) out.state[label] = readValue(value)
  for (const [label, memo] of e.memos) out.derived[label] = toJsonValue(memo.value)
  return out
}

/**
 * Run `listener` when a Solid root or module-level signal is recorded, and
 * right away when some already are. The store is shared with the runtime
 * wrapper, which may run before or after this.
 */
export function onSolidGraph(listener: () => void): () => void {
  const store = getStore()
  store.listeners.add(listener)
  if (store.roots.size || store.unowned.length) listener()
  return () => {
    store.listeners.delete(listener)
  }
}

let dispose: (() => void) | undefined

/**
 * Register the `solid` agent tools (`medula_solid_*`): inspect and edit
 * component signals and stores like a devtools would. The tools appear once
 * the first root renders through the instrumented `solid-js` (Vite plugin,
 * development builds only). Idempotent, browser only.
 */
export function installSolidInternals(): () => void {
  if (dispose || typeof window === 'undefined') return dispose ?? (() => {})
  ids = new WeakMap()
  uid = 0
  let stopTools: (() => void) | undefined
  const stopListening = onSolidGraph(() => {
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
  return registerAgentTools<MedulaSolidProtocol>('solid', {
    'list-components': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({}).describe('No arguments.')],
      returns: z.array(componentNodeSchema),
      agent: {
        title: 'List Solid components',
        description:
          'Tree of the mounted Solid components with the labels of their signals and stores (`state`, writable), memos (`derived`, read-only) and their prop names. Labels are the variable names (`createSignal(0, { name })`, added automatically by the Vite plugin) or `signalN`/`storeN`/`memoN` by creation order. Ids are stable while a component stays mounted. Signals and stores created outside components (module level, `createRoot`) show under the pseudo component "module". Flow: list-components -> get-component-state -> set-component-state.',
      },
      handler: () => snapshot().map(node),
    },
    'get-component-state': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({ id: idSchema })],
      returns: componentStateSchema,
      agent: {
        title: 'Inspect a Solid component',
        description:
          'Snapshot of one component (id from list-components): `state` (signals and stores, writable with set-component-state), `derived` (memos, read-only: change the state they depend on) and `props` as passed by the parent (read-only; `children` and `ref` are not evaluated).',
      },
      handler: ({ id }) => details(find(id)),
    },
    'set-component-state': {
      type: 'action',
      jsonSerializable: true,
      args: [
        z.object({
          id: idSchema,
          label: z.string().min(1).describe('A `state` label from get-component-state.'),
          path: pathSchema,
          value: jsonSchema.describe('New JSON value written at the path.'),
        }),
      ],
      returns: stateValueSchema,
      agent: {
        title: 'Set Solid component state',
        description:
          "Write a JSON value into a signal or store of a component, like editing it in a devtools; the UI and its memos update. Empty `path` replaces the whole value (a store is replaced in place). A nested path on a signal writes a copy with that path changed; on a store it writes through Solid's store setter. `derived` and `props` are read-only. Returns the new value.",
      },
      handler: ({ id, label, path, value }) => {
        const e = find(id)
        const target = e.signals.get(label)
        if (!target) {
          if (e.memos.has(label)) {
            throw new Error(
              `[medula] "${label}" is a memo: read-only. Change the state it depends on.`,
            )
          }
          throw new Error(
            `[medula] Component ${id} (${e.name}) has no state "${label}". Call get-component-state to see its labels.`,
          )
        }
        const internal = requireInternal()
        if (isSignal(target)) {
          internal.writeSignal(target, setAtPath(target.value, path, value))
        } else {
          internal.batch(() =>
            internal.produce((draft: object) => {
              if (path.length === 0) replaceContents(draft, value)
              else writeAtPath(draft, path, value)
            })(target.value),
          )
        }
        return { id, label, value: readValue(target) }
      },
    },
  })
}
