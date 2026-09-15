import type { App } from 'vue'
import type { InPageChannelProtocol } from 'devframe/in-page-channel'
import { z } from 'zod'
import { registerAgentTools } from '../client/tools'
import { toJsonValue } from '../client/serialize'
import type { JsonValue } from '../client/serialize'

// vue-router is not imported: duck-typed on the public router surface
interface RouteLike {
  fullPath: string
  path: string
  name?: string | symbol | null
  params: Record<string, unknown>
  query: Record<string, unknown>
  hash: string
  meta: Record<string, unknown>
  matched: Array<{ name?: string | symbol | null; path: string }>
}

interface RouterLike {
  currentRoute: { value: RouteLike }
  getRoutes(): Array<{ name?: string | symbol | null; path: string; meta: Record<string, unknown> }>
  push(to: unknown): Promise<unknown>
}

export interface RouteInfo {
  fullPath: string
  path: string
  name: string | null
  params: Record<string, JsonValue>
  query: Record<string, JsonValue>
  hash: string
  meta: Record<string, JsonValue>
  /** Names (or paths) of the matched route records, parent first. */
  matched: string[]
}

export interface RouteRecordInfo {
  name: string | null
  path: string
  meta: Record<string, JsonValue>
}

export type NavigateTarget =
  | string
  | {
      name: string
      params?: Record<string, unknown>
      query?: Record<string, unknown>
      hash?: string
    }
  | { path: string; query?: Record<string, unknown>; hash?: string }

export interface MedulaRouterProtocol extends InPageChannelProtocol {
  pageScript: {
    'get-route': () => RouteInfo
    'list-routes': () => RouteRecordInfo[]
    navigate: (args: { to: NavigateTarget }) => Promise<RouteInfo>
  }
}

function nameOf(name: string | symbol | null | undefined): string | null {
  return name == null ? null : typeof name === 'symbol' ? (name.description ?? null) : name
}

function routeInfo(route: RouteLike): RouteInfo {
  return {
    fullPath: route.fullPath,
    path: route.path,
    name: nameOf(route.name),
    params: toJsonValue(route.params) as Record<string, JsonValue>,
    query: toJsonValue(route.query) as Record<string, JsonValue>,
    hash: route.hash,
    meta: toJsonValue(route.meta) as Record<string, JsonValue>,
    matched: route.matched.map((record) => nameOf(record.name) ?? record.path),
  }
}

const routeSchema = z.object({
  fullPath: z.string(),
  path: z.string(),
  name: z.string().nullable(),
  params: z.record(z.string(), z.json()),
  query: z.record(z.string(), z.json()),
  hash: z.string(),
  meta: z.record(z.string(), z.json()),
  matched: z.array(z.string()),
})

const routeRecordSchema = z.object({
  name: z.string().nullable(),
  path: z.string(),
  meta: z.record(z.string(), z.json()),
})

const stringRecord = z.record(z.string(), z.json())
const navigateArgs = z.object({
  to: z
    .union([
      z.string().describe('A full path like "/users/3?tab=info".'),
      z.object({
        name: z.string(),
        params: stringRecord.optional(),
        query: stringRecord.optional(),
        hash: z.string().optional(),
      }),
      z.object({ path: z.string(), query: stringRecord.optional(), hash: z.string().optional() }),
    ])
    .describe('Where to go: a path string, or a named route with params/query.'),
})

let registered = false

/**
 * Zero config: when the app has Vue Router (`$router`), register the
 * `medula_router_*` tools once per page.
 */
export function installRouterInternals(app: App): void {
  const router = app.config.globalProperties.$router as RouterLike | undefined
  if (registered || !router || typeof router.push !== 'function' || !router.currentRoute) return
  registered = true
  registerAgentTools<MedulaRouterProtocol>('router', {
    'get-route': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({}).describe('No arguments.')],
      returns: routeSchema,
      agent: {
        title: 'Current route',
        description:
          'Current Vue Router route of the open page: fullPath, name, params, query, hash, meta and the matched record names. Use it to know which page is displayed before reading component state.',
      },
      handler: () => routeInfo(router.currentRoute.value),
    },
    'list-routes': {
      type: 'query',
      jsonSerializable: true,
      args: [z.object({}).describe('No arguments.')],
      returns: z.array(routeRecordSchema),
      agent: {
        title: 'List routes',
        description:
          'All route records known to Vue Router (flat): name, path pattern and meta. Use it to pick a target for navigate.',
      },
      handler: () =>
        router.getRoutes().map((record) => ({
          name: nameOf(record.name),
          path: record.path,
          meta: toJsonValue(record.meta) as Record<string, JsonValue>,
        })),
    },
    navigate: {
      type: 'action',
      jsonSerializable: true,
      args: [navigateArgs],
      returns: routeSchema,
      agent: {
        title: 'Navigate',
        description:
          'Navigate the open page with router.push: a path string or { name, params, query }. Returns the route after navigation (guards may redirect or cancel).',
      },
      handler: async ({ to }) => {
        await router.push(to)
        return routeInfo(router.currentRoute.value)
      },
    },
  })
}
