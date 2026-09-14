import type { App, ComponentInternalInstance, Plugin, VNode } from 'vue'
import type { InPageChannelProtocol } from 'devframe/in-page-channel'
import { z } from 'zod'
import { registerAgentTools, toJsonValue } from '../client'
import { onVueApp } from '../page/vue-hook'
import { installPiniaInternals } from './pinia'
import { installRouterInternals } from './router'
import { isReactive, isReadonly, isRef, isVNode } from './utils'
import type { JsonValue, StatePath } from '../client'

export interface ComponentNode {
  /** Stable id for the lifetime of the component instance. */
  id: string
  name: string
  /** Source file when the build provides it. */
  file?: string
  /** Kept alive by `<KeepAlive>` but not rendered right now. */
  inactive?: boolean
  children: ComponentNode[]
}

export type ComponentStateSection = 'props' | 'setupState' | 'data'

export interface ComponentState {
  id: string
  name: string
  file?: string
  props: Record<string, JsonValue>
  /** `setup()` / `<script setup>` bindings with refs unwrapped, functions and components skipped. */
  setupState: Record<string, JsonValue>
  /** Options API `data()`. */
  data: Record<string, JsonValue>
  /** `setupState` keys that cannot be written (computed without setter, readonly). */
  readonly: string[]
}

export interface ComponentSectionValue {
  id: string
  section: ComponentStateSection
  value: Record<string, JsonValue>
}

export interface McpDevtoolsVueProtocol extends InPageChannelProtocol {
  pageScript: {
    'list-components': () => ComponentNode[]
    'get-component-state': (args: { id: string }) => ComponentState
    'set-component-state': (args: {
      id: string
      section: ComponentStateSection
      path: StatePath
      value: unknown
    }) => ComponentSectionValue
  }
}

// Vue internals used like Vue DevTools does (`setupState` is @internal in the public types)
type Instance = ComponentInternalInstance & {
  setupState: Record<string, unknown>
  devtoolsRawSetupState?: Record<string, unknown>
  __v_cache?: Map<unknown, VNode>
  [UID_KEY]?: string
}

const UID_KEY = '__MCP_DEVTOOLS_UID__'

interface Shared {
  apps: Set<App>
  registered: boolean
  seq: number
}

// shared across bundles that load their own copy of the adapter
const shared: Shared = ((globalThis as any)[Symbol.for('mcp-devtools:vue')] ??= {
  apps: new Set(),
  registered: false,
  seq: 0,
})

function idOf(instance: Instance): string {
  // `uid` is not unique across apps, prefix with the app uid
  return (instance[UID_KEY] ??=
    `${instance.appContext.app._uid}:${instance.root === instance ? 'root' : instance.uid}`)
}

function nameOf(instance: Instance): string {
  const type = instance.type as any
  const name: string | undefined =
    typeof type === 'function' ? type.displayName || type.name : type.name || type.__name
  if (name) return name
  if (instance.root === instance) return 'Root'
  for (const registry of [instance.parent?.type as any, instance.appContext]) {
    for (const key in registry?.components ?? {}) if (registry.components[key] === type) return key
  }
  const file: string | undefined = type.__file
  if (file) {
    return file
      .split(/[/\\]/)
      .pop()!
      .replace(/\.\w+$/, '')
  }
  return 'Anonymous'
}

function isAlive(instance: Instance | null | undefined): instance is Instance {
  return !!instance && !instance.isUnmounted
}

/** Component instances directly under a vnode: through fragments, suspense and plain elements. */
function childInstances(vnode: VNode | null | undefined): Instance[] {
  if (!vnode) return []
  if (vnode.component) return [vnode.component as Instance]
  if (vnode.suspense) return childInstances(vnode.suspense.activeBranch)
  if (Array.isArray(vnode.children)) {
    return vnode.children.flatMap((child) => (isVNode(child) ? childInstances(child) : []))
  }
  return []
}

function captureTree(instance: Instance, inactive: boolean = false): ComponentNode {
  const children = childInstances(instance.subTree).filter(isAlive)
  const node: ComponentNode = { id: idOf(instance), name: nameOf(instance), children: [] }
  const file = (instance.type as any).__file
  if (file) node.file = file
  if (inactive) node.inactive = true
  node.children = children.map((child) => captureTree(child))
  // KeepAlive keeps deactivated instances out of the subtree
  if ((instance.type as any).__isKeepAlive && instance.__v_cache) {
    for (const cached of instance.__v_cache.values()) {
      const cachedInstance = cached.component as Instance | null
      if (isAlive(cachedInstance) && !children.includes(cachedInstance)) {
        node.children.push(captureTree(cachedInstance, true))
      }
    }
  }
  return node
}

function roots(): Instance[] {
  const list: Instance[] = []
  for (const app of shared.apps) {
    const root = app._instance as Instance | null
    if (isAlive(root)) list.push(root)
    else if (root) shared.apps.delete(app)
  }
  return list
}

function walk(instance: Instance, visit: (instance: Instance) => boolean | void): boolean {
  if (visit(instance)) return true
  const children = childInstances(instance.subTree).filter(isAlive)
  if (instance.__v_cache) {
    for (const cached of instance.__v_cache.values()) {
      if (
        isAlive(cached.component as Instance) &&
        !children.includes(cached.component as Instance)
      ) {
        children.push(cached.component as Instance)
      }
    }
  }
  return children.some((child) => walk(child, visit))
}

function requireInstance(id: string): Instance {
  let found: Instance | undefined
  for (const root of roots()) {
    walk(root, (instance) => {
      if (idOf(instance) === id) {
        found = instance
        return true
      }
    })
    if (found) break
  }
  if (!found) {
    throw new Error(
      `[mcp-devtools] Unknown component "${id}". Call list-components to get current ids.`,
    )
  }
  return found
}

function isComponentLike(value: unknown): boolean {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' &&
      value !== null &&
      ('render' in value || 'setup' in value || '__asyncLoader' in value) &&
      !isRef(value) &&
      !isReactive(value))
  )
}

function rawSetupState(instance: Instance): Record<string, unknown> {
  return instance.devtoolsRawSetupState ?? instance.setupState
}

function isPiniaStore(value: unknown): value is { $id: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$id' in value &&
    typeof (value as any).$patch === 'function'
  )
}

function readSection(
  instance: Instance,
  section: ComponentStateSection,
): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {}
  if (section === 'setupState') {
    const raw = rawSetupState(instance)
    for (const key in instance.setupState) {
      if (isComponentLike(raw[key])) continue
      const value = instance.setupState[key]
      // stores are shared: point the agent at the Pinia adapter instead
      out[key] = isPiniaStore(value) ? { $piniaStore: value.$id } : toJsonValue(value)
    }
    return out
  }
  const source = section === 'props' ? instance.props : instance.data
  for (const key in source) out[key] = toJsonValue(source[key])
  return out
}

function readonlyKeys(instance: Instance): string[] {
  const raw = rawSetupState(instance)
  const keys: string[] = []
  for (const key in instance.setupState) {
    const value = raw[key] as any
    if (isComponentLike(value)) continue
    // computed refs carry an `effect`; writable ones have a setter
    const readonlyComputed = isRef(value) && 'effect' in value && !(value as any).setter
    if (readonlyComputed || isReadonly(value)) keys.push(key)
  }
  return keys
}

function readState(instance: Instance): ComponentState {
  const state: ComponentState = {
    id: idOf(instance),
    name: nameOf(instance),
    props: readSection(instance, 'props'),
    setupState: readSection(instance, 'setupState'),
    data: readSection(instance, 'data'),
    readonly: readonlyKeys(instance),
  }
  const file = (instance.type as any).__file
  if (file) state.file = file
  return state
}

function step(target: any, key: string | number): unknown {
  const raw = isRef(target) ? target.value : target
  if (raw instanceof Map) return raw.get(key)
  if (raw instanceof Set) return [...raw][key as number]
  return raw?.[key]
}

/** StateEditor semantics: walk the path, unwrap refs, write `.value` on refs, assign otherwise. */
function writeAtPath(target: Record<string, unknown>, path: StatePath, value: unknown): void {
  let parent: any = target
  for (const key of path.slice(0, -1)) {
    parent = step(parent, key)
    if (parent == null || typeof parent !== 'object') {
      throw new Error(`[mcp-devtools] Path ${JSON.stringify(path)} not found`)
    }
  }
  if (isRef(parent)) parent = parent.value
  const last = path[path.length - 1]!
  const item = parent instanceof Map ? parent.get(last) : parent[last]
  if (isRef(item)) item.value = value
  else if (parent instanceof Map) parent.set(last, value)
  else parent[last] = value
}

const idSchema = z.string().min(1).describe('Component id from list-components.')
const sectionSchema = z
  .enum(['props', 'setupState', 'data'])
  .describe('Which part of the component state to write.')
const pathSchema = z
  .array(z.union([z.string(), z.number().int().nonnegative()]))
  .min(1)
  .describe('Path inside the section: first the binding name, then object keys and array indexes.')
const jsonRecord = z.record(z.string(), z.json())

const componentNodeSchema: z.ZodType<ComponentNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    file: z.string().optional(),
    inactive: z.boolean().optional(),
    children: z.array(componentNodeSchema),
  }),
)

const componentStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  file: z.string().optional(),
  props: jsonRecord,
  setupState: jsonRecord,
  data: jsonRecord,
  readonly: z.array(z.string()),
})

const sectionValueSchema = z.object({ id: z.string(), section: sectionSchema, value: jsonRecord })

function registerVueTools(): void {
  if (shared.registered || typeof window === 'undefined') return
  shared.registered = true
  registerAgentTools<McpDevtoolsVueProtocol>('vue', {
    'list-components': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({}).describe('No arguments.')],
      returns: z.array(componentNodeSchema),
      agent: {
        title: 'List Vue components',
        description:
          'Component tree of every mounted Vue app in the open page, with ids for get-component-state and set-component-state. Call this first. Prefer the exposed states (list-states) when the app exposes what you need: component internals are lower level.',
      },
      handler: () => roots().map((root) => captureTree(root)),
    },
    'get-component-state': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({ id: idSchema })],
      returns: componentStateSchema,
      agent: {
        title: 'Read Vue component state',
        description:
          'Internal state of one Vue component by id: props, setupState (refs and computed unwrapped) and Options API data, as JSON. `readonly` lists setupState keys you cannot write. Pinia stores appear as `{ $piniaStore: id }`: read and write them with the *-state tools instead.',
      },
      handler: ({ id }) => readState(requireInstance(id)),
    },
    'set-component-state': {
      type: 'action',
      jsonSerializable: true,
      args: [z.object({ id: idSchema, section: sectionSchema, path: pathSchema, value: z.json() })],
      returns: sectionValueSchema,
      agent: {
        title: 'Write Vue component state',
        description:
          'Write a JSON value at a path inside props, setupState or data of one Vue component (dev only). Refs are updated through `.value`, objects in place, so the UI re-renders. Returns the whole section after the write. Props edits are overwritten when the parent re-renders.',
      },
      handler: ({ id, section, path, value }) => {
        const instance = requireInstance(id)
        if (section === 'setupState' && readonlyKeys(instance).includes(String(path[0]))) {
          throw new Error(
            `[mcp-devtools] "${String(path[0])}" is read-only (computed without setter or readonly)`,
          )
        }
        const target =
          section === 'props'
            ? instance.props
            : section === 'data'
              ? instance.data
              : rawSetupState(instance)
        writeAtPath(target as Record<string, unknown>, path, value)
        return { id, section, value: readSection(instance, section) }
      },
    },
  })
}

/**
 * Vue plugin: lets agents inspect and edit the internal state of every
 * component (props, setup bindings, data) like Vue DevTools does. Registers
 * the `mcp-devtools_vue_*` tools once per page. Browser only, no-op on SSR.
 *
 * @example
 * createApp(App).use(mcpDevtoolsVue)
 */
function registerApp(app: App): void {
  if (typeof window === 'undefined') return
  shared.apps.add(app)
  registerVueTools()
}

export const mcpDevtoolsVue: Plugin = {
  install(app) {
    registerApp(app)
  },
}

/**
 * Zero-config entry used by the page script: picks up every Vue app announced
 * through the devtools hook (installed by the bootstrap script) and registers
 * the component tools, the Pinia stores (`pinia:<id>` states) and the Vue
 * Router tools when present.
 */
export function installVueInternals(): () => void {
  if (typeof window === 'undefined') return () => {}
  return onVueApp((value) => {
    const app = value as App
    registerApp(app)
    installPiniaInternals(app)
    installRouterInternals(app)
  })
}
