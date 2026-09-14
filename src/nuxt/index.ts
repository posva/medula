import { addVitePlugin, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import { Medula } from '../vite'
import type { MedulaVitePluginOptions } from '../vite'
import { BOOTSTRAP_SCRIPT } from '../page/bootstrap'
import { MEDULA_BASE, connectScriptUrl } from '../shared'

export type MedulaNuxtOptions = Omit<MedulaVitePluginOptions, 'inject'>

/**
 * Nuxt module: mounts the devframe on the Vite dev server and adds the
 * connect script to the app head in development. Does nothing in production.
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
    const base = options.base ?? MEDULA_BASE
    // Nuxt renders the HTML itself, so the Vite `transformIndexHtml` injection
    // does not apply: add the script to the head instead.
    addVitePlugin(Medula({ ...options, base, inject: false }), { server: false })
    nuxt.options.app.head.script ??= []
    nuxt.options.app.head.script.push(
      // devtools hooks: must run before Vue loads
      { innerHTML: BOOTSTRAP_SCRIPT, tagPosition: 'head', tagPriority: 'critical' },
      { type: 'module', src: connectScriptUrl(base), tagPosition: 'bodyClose' },
    )
  },
})

export default medulaModule
