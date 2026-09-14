export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // @nuxt/devtools 4 alpha (devframe based), coexists with medula
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', 'medula/nuxt'],
})
