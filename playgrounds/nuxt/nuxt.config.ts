export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // @nuxt/devtools 4 beta (devframe based), coexists with medula
  devtools: { enabled: true },
  // Nuxt DevTools 4 runs Vite DevTools; single-user localhost: no one-time code
  vite: { devtools: { clientAuth: false } },
  modules: ['@pinia/nuxt', 'medula/nuxt'],
})
