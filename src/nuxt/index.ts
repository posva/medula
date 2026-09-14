import { addVitePlugin, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import { medula } from '../vite'
import type { MedulaVitePluginOptions } from '../vite'
import { BOOTSTRAP_SCRIPT } from '../page/bootstrap'
import { MEDULA_BASE } from '../shared'

export type MedulaNuxtOptions = MedulaVitePluginOptions

/**
 * Nuxt module: registers medula as a Nuxt DevTools dock and inlines the hook
 * bootstrap in the app head in development. Does nothing in production.
 *
 * @example
 * export default defineNuxtConfig({ modules: ['medula/nuxt'] })
 */
const medulaModule: NuxtModule<MedulaNuxtOptions> = defineNuxtModule<MedulaNuxtOptions>({
  meta: {
    name: 'medula',
    configKey: 'medula',
    compatibility: { nuxt: '^4.0.0 || ^5.0.0-0' },
  },
  setup(options, nuxt) {
    if (!nuxt.options.dev) return
    const devtools = nuxt.options.devtools
    if (devtools === false || (typeof devtools === 'object' && devtools.enabled === false)) {
      console.warn('[medula] Nuxt DevTools is disabled: medula runs as one of its docks.')
      return
    }
    const base = options.base ?? MEDULA_BASE
    // Nuxt DevTools hosts Vite DevTools docks; Nuxt renders the HTML itself, so
    // the Vite `transformIndexHtml` injection does not apply: add the shims to the head.
    addVitePlugin(medula({ ...options, base }), { server: false })
    nuxt.options.app.head.script ??= []
    nuxt.options.app.head.script.push({
      innerHTML: BOOTSTRAP_SCRIPT,
      tagPosition: 'head',
      tagPriority: 'critical',
    })
  },
})

export default medulaModule
