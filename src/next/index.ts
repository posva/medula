import type {
  CreateDevframeNextHandlerOptions,
  DevframeNextConfig,
  DevframeNextHandler,
} from '@devframes/next/single'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { BOOTSTRAP_SCRIPT } from '../page/bootstrap'
import { MEDULA_BASE, MEDULA_ID, connectScriptUrl } from '../shared'

export { MEDULA_BASE, connectScriptUrl }
/** Hook shims to inline at the top of `<head>` (see {@link Medula}). */
export const bootstrapScript: string = BOOTSTRAP_SCRIPT

/**
 * Server component for the root layout `<head>`: in development it inlines
 * the hook shims and loads the page script, so components and state are
 * discovered with no other app code.
 *
 * @example
 * <head><Medula /></head>
 */
export function Medula(props: { base?: string } = {}): ReactElement | null {
  if (process.env.NODE_ENV !== 'development') return null
  return createElement('script', {
    dangerouslySetInnerHTML: {
      __html: `${BOOTSTRAP_SCRIPT}document.head.append(Object.assign(document.createElement('script'),{type:'module',src:${JSON.stringify(connectScriptUrl(props.base ?? MEDULA_BASE))}}))`,
    },
  })
}
export type { DevframeNextConfig as MedulaNextConfig }

export type MedulaNextHandlerOptions = Omit<CreateDevframeNextHandlerOptions, 'flags'>

/**
 * Wrap `next.config` with the settings the devframe host needs. Mirrors
 * `withDevframe` from `@devframes/next/single` without importing it, so the
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
  handler: DevframeNextHandler
  register: (request: Request) => void
}

const REGISTRATIONS = Symbol.for('medula:next-registrations')
const registrations: Map<string, { unregister: () => void }> = ((globalThis as any)[
  REGISTRATIONS
] ??= new Map())

// Bundler-ignored so Node loads the published `dist` at request time: a
// bundled copy breaks the `import.meta.url` lookup of `dist-client`.
async function loadHandler(options: MedulaNextHandlerOptions): Promise<LoadedHandler> {
  const [{ createMedula }, { createDevframeNextHandler }, { registerDevframeInstance }] =
    await Promise.all([
      import(/* webpackIgnore: true */ /* turbopackIgnore: true */ selfPackage) as Promise<
        typeof import('medula')
      >,
      import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ '@devframes/next/single'
      ) as Promise<typeof import('@devframes/next/single')>,
      import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'devframe/internal') as Promise<
        typeof import('devframe/internal')
      >,
    ])
  const base = options.base ?? MEDULA_BASE
  const mcp = options.mcp ?? true
  const handler = createDevframeNextHandler(createMedula({ base }), {
    ...options,
    base,
    auth: options.auth ?? false,
    // client tools arrive after startup, so 'auto' would never mount
    mcp,
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
  return { handler, register }
}

/**
 * Route handler for `app/%5F_medula/[[...path]]/route.ts` (Next
 * reserves `_`-prefixed folders, so `__medula` is URL-encoded). Serves
 * the config page and `connect.js`, runs the RPC side-car and the MCP route.
 * Memoized on `globalThis`, so Next dev reloads reuse the same side-car.
 *
 * Add `<script type="module" src="/__medula/connect.js" />` to the
 * root layout in development so pages connect.
 *
 * @example
 * export const runtime = 'nodejs'
 * export const dynamic = 'force-dynamic'
 * const handler = createMedulaHandler()
 * export const GET = handler.fetch
 * export const POST = handler.fetch
 * export const DELETE = handler.fetch
 */
export function createMedulaHandler(options: MedulaNextHandlerOptions = {}): DevframeNextHandler {
  const loaded = loadHandler(options)
  const base = options.base ?? MEDULA_BASE
  return {
    fetch: (request) =>
      loaded.then(({ handler, register }) => {
        register(request)
        return handler.fetch(request)
      }),
    ready: loaded.then(({ handler }) => handler.ready),
    close: () =>
      loaded.then(({ handler }) => {
        registrations.get(base)?.unregister()
        registrations.delete(base)
        return handler.close()
      }),
  }
}
