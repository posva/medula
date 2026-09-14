import type { Plugin } from 'vite'
import { installSvelteRuntimeHook } from '../svelte/hook'

const REAL_ID = 'svelte/internal/client'
const WRAPPER_ID = '\0medula:svelte-internal-client'

/**
 * Source of the module served in place of `svelte/internal/client` to
 * compiled components: re-exports the real runtime and overrides the dev entry
 * points with the recording hook. `svelte` and the internals resolve to the
 * same runtime instance, so contexts and lifecycle work across the wrapper.
 */
export function svelteWrapperSource(): string {
  return [
    `import * as __original from '${REAL_ID}'`,
    `import { getContext, setContext, onDestroy } from 'svelte'`,
    `export * from '${REAL_ID}'`,
    `const __hooked = (${installSvelteRuntimeHook.toString()})(__original, { getContext, setContext, onDestroy }, globalThis)`,
    `export const push = __hooked.push`,
    `export const tag = __hooked.tag`,
    `export const tag_proxy = __hooked.tag_proxy`,
  ].join('\n')
}

/**
 * Serve-only plugin: every import of `svelte/internal/client` (what compiled
 * Svelte 5 components use) gets the instrumented wrapper so agents can list
 * components and read/write their `$state` with no app code. Harmless for
 * non-Svelte apps: nothing imports that specifier.
 */
export function svelteInstrumentation(): Plugin {
  return {
    name: 'medula:svelte',
    apply: 'serve',
    // must run before vite:resolve, which maps the specifier to the pre-bundled dep
    enforce: 'pre',
    resolveId(id, importer, options) {
      if (id !== REAL_ID || options?.ssr || !importer || importer.startsWith('\0')) return
      return WRAPPER_ID
    },
    load(id) {
      if (id === WRAPPER_ID) return svelteWrapperSource()
    },
  }
}
