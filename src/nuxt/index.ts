import { addVitePlugin, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import { McpDevtools } from '../vite'
import type { McpDevtoolsVitePluginOptions } from '../vite'
import { MCP_DEVTOOLS_BASE, connectScriptUrl } from '../shared'

export type McpDevtoolsNuxtOptions = Omit<McpDevtoolsVitePluginOptions, 'inject'>

/**
 * Nuxt module: mounts the devframe on the Vite dev server and adds the
 * connect script to the app head in development. Does nothing in production.
 *
 * @example
 * export default defineNuxtConfig({ modules: ['mcp-devtools/nuxt'] })
 */
const mcpDevtoolsModule: NuxtModule<McpDevtoolsNuxtOptions> =
  defineNuxtModule<McpDevtoolsNuxtOptions>({
    meta: {
      name: 'mcp-devtools',
      configKey: 'mcpDevtools',
      compatibility: { nuxt: '^4.0.0 || ^5.0.0-0' },
    },
    setup(options, nuxt) {
      if (!nuxt.options.dev) return
      const base = options.base ?? MCP_DEVTOOLS_BASE
      // Nuxt renders the HTML itself, so the Vite `transformIndexHtml` injection
      // does not apply: add the script to the head instead.
      addVitePlugin(McpDevtools({ ...options, base, inject: false }), { server: false })
      nuxt.options.app.head.script ??= []
      nuxt.options.app.head.script.push({
        type: 'module',
        src: connectScriptUrl(base),
        tagPosition: 'bodyClose',
      })
    },
  })

export default mcpDevtoolsModule
