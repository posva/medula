import { nextDevframeHub } from '@devframes/next/hub'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The whole hub behind one catch-all route (Next reserves `_`-prefixed
// folders, so `__devframes` is URL-encoded as `%5F_devframes`): the dock
// pages, the discovery endpoints, the embedded UI and the MCP route.
// `medula` loads through a bundler-ignored dynamic `import()` so Node reads
// its published `dist` at request time (its `import.meta.url` lookup of
// `dist-client` does not survive static bundling).
const hub = nextDevframeHub({
  devframes: [
    () =>
      import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'medula').then((m) =>
        m.medulaHubEntry(),
      ),
  ],
  // single-user localhost: no one-time code
  auth: false,
  // lets `devframe connect` discover this dev server
  register: true,
})

const handler = (request: Request) => hub.handler(request)

export { handler as DELETE, handler as GET, handler as POST }
