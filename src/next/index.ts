import type { NextDevframeHubOptions } from '@devframes/next/hub'
import type { DevframeNextConfig } from '@devframes/next/single'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { BOOTSTRAP_SCRIPT } from '../page/bootstrap'
import { MEDULA_ID } from '../shared'

/** Default mount base of the medula hub in a Next app; the dock page lives at `<base>medula/`. */
export const MEDULA_NEXT_BASE: string = '/__devframes/'

/** Hook shims to inline at the top of `<head>` (see {@link Medula}). */
export const bootstrapScript: string = BOOTSTRAP_SCRIPT

function withTrailingSlash(base: string): string {
  return base.endsWith('/') ? base : `${base}/`
}

/**
 * Server component for the root layout `<head>`: in development it inlines
 * the hook shims and loads the hub UI bootstrap, which boots the hub client
 * runtime and the medula page script, so components and state are discovered
 * with no other app code.
 *
 * @example
 * <head><Medula /></head>
 */
export function Medula(props: { base?: string } = {}): ReactElement | null {
  if (process.env.NODE_ENV !== 'development') return null
  const embedded = `${withTrailingSlash(props.base ?? MEDULA_NEXT_BASE)}embedded.js`
  return createElement('script', {
    dangerouslySetInnerHTML: {
      __html: `${BOOTSTRAP_SCRIPT}document.head.append(Object.assign(document.createElement('script'),{type:'module',src:${JSON.stringify(embedded)}}))`,
    },
  })
}
export type { DevframeNextConfig as MedulaNextConfig }

export type MedulaNextHandlerOptions = Pick<
  NextDevframeHubOptions,
  'base' | 'port' | 'host' | 'auth' | 'mcp'
>

export interface MedulaNextHandler {
  /** Answer one request of the catch-all route. */
  fetch: (request: Request) => Promise<Response>
  /** Resolves once the hub runs. */
  ready: Promise<void>
  /** Tear down the side-car and forget the memoized hub. */
  close: () => Promise<void>
}

/**
 * Wrap `next.config` with the settings the devframe host needs. Mirrors
 * `withDevframe` from `@devframes/next` without importing it, so the
 * Next bundle of this module stays free of the node-only runtime.
 *
 * @example
 * export default withMedula({ reactStrictMode: true })
 */
export function withMedula<T extends DevframeNextConfig>(nextConfig: T = {} as T): T {
  // relative assets under `<base>` must not hit Next's trailing-slash redirect
  return { ...nextConfig, skipTrailingSlashRedirect: true }
}

// non-literal, otherwise tsdown resolves the self-import to a relative chunk
const selfPackage: string = 'medula'

interface LoadedHandler {
  fetch: (request: Request) => Promise<Response>
  ready: Promise<void>
  close: () => Promise<void>
  register: (request: Request) => void
}

const REGISTRATIONS = Symbol.for('medula:next-registrations')
const registrations: Map<string, { unregister: () => void }> = ((globalThis as any)[
  REGISTRATIONS
] ??= new Map())

// Bundler-ignored so Node loads the published `dist` at request time: a
// bundled copy breaks the `import.meta.url` lookup of `dist-client`.
async function loadHandler(options: MedulaNextHandlerOptions): Promise<LoadedHandler> {
  const [
    { createMedula, medulaDockClientScript },
    { nextDevframeHub },
    { registerDevframeInstance },
  ] = await Promise.all([
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ selfPackage) as Promise<
      typeof import('medula')
    >,
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ '@devframes/next/hub') as Promise<
      typeof import('@devframes/next/hub')
    >,
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'devframe/internal') as Promise<
      typeof import('devframe/internal')
    >,
  ])
  const base = withTrailingSlash(options.base ?? MEDULA_NEXT_BASE)
  // a hub serves every dock at `<base><id>/`
  const dockBase = `${base}${MEDULA_ID}/`
  const mcp = options.mcp ?? true
  const hub = nextDevframeHub({
    ...options,
    base,
    auth: options.auth ?? false,
    // client tools arrive after startup, so 'auto' would never mount
    mcp,
    devframes: [
      {
        devframe: createMedula({ base: dockBase }),
        dock: { clientScript: medulaDockClientScript(dockBase) },
      },
    ],
  })
  // The side-car does not know the Next origin, so publish the instance to
  // `~/.devframe/instances/` (what `devframe connect` reads) from the first
  // request. Loopback only: a forwarded Host must not end up in the registry.
  const register = (request: Request): void => {
    if (registrations.has(base)) return
    const url = new URL(request.url)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return
    const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80)
    const registration = registerDevframeInstance({
      pid: process.pid,
      port,
      origin: url.origin,
      basePath: base,
      id: MEDULA_ID,
      name: 'medula',
      rootDir: process.cwd(),
      mcp: mcp === false ? null : { path: `${base}__mcp` },
      startedAt: Date.now(),
    })
    registrations.set(base, registration)
    process.once('exit', () => registration.unregister())
  }
  return {
    fetch: (request) => hub.handler(request),
    ready: hub.ready().then(() => {}),
    close: () => hub.close(),
    register,
  }
}

/**
 * Route handler for `app/%5F_devframes/[[...path]]/route.ts` (Next
 * reserves `_`-prefixed folders, so `__devframes` is URL-encoded). Runs a
 * devframes hub with medula as its dock: the config page at `<base>medula/`,
 * the page script, the hub UI, the RPC side-car and the MCP route at
 * `<base>__mcp`. Memoized on `globalThis`, so Next dev reloads reuse the
 * same side-car.
 *
 * Add `<Medula />` to the root layout `<head>` so pages load the hub.
 *
 * @example
 * export const runtime = 'nodejs'
 * export const dynamic = 'force-dynamic'
 * const handler = createMedulaHandler()
 * export const GET = handler.fetch
 * export const POST = handler.fetch
 * export const DELETE = handler.fetch
 */
export function createMedulaHandler(options: MedulaNextHandlerOptions = {}): MedulaNextHandler {
  const loaded = loadHandler(options)
  const base = withTrailingSlash(options.base ?? MEDULA_NEXT_BASE)
  return {
    fetch: (request) =>
      loaded.then(({ fetch, register }) => {
        register(request)
        return fetch(request)
      }),
    ready: loaded.then(({ ready }) => ready),
    close: () =>
      loaded.then(({ close }) => {
        registrations.get(base)?.unregister()
        registrations.delete(base)
        return close()
      }),
  }
}
