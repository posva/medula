export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // @nuxt/devtools 4 alpha (devframe based), coexists with mcp-devtools
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', 'mcp-devtools/nuxt'],
})
