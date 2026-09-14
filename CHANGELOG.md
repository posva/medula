# [0.1.0](https://github.com/posva/medula/compare/v0.0.2...v0.1.0) (2026-09-14)

- refactor(next)!: follow the devframe hub-next example ([9094419](https://github.com/posva/medula/commit/9094419ceff6aefdc3b083614ad5c0d82a0c8890))
- feat!: run as a hub dock instead of a standalone devframe ([582dd64](https://github.com/posva/medula/commit/582dd641bd56fe85095bfe689bc65602ecd9c7fd))

### BREAKING CHANGES

- createMedulaHandler, withMedula and the Next handler
  options are removed from medula/next; @devframes/next is no longer a
  dependency of medula.
- medula/vite requires Vite DevTools and drops the
  auth, mcp, host, port and inject options. medula/next mounts a hub at
  /__devframes/ (route folder app/%5F_devframes/) and needs
  @devframes/hub-ui. The MCP route is the hub's: /__devtools/__mcp or
  /__devframes/__mcp.

## 0.0.2 (2026-09-14)

### Bug Fixes

- **next:** register the instance for devframe connect on the first request ([fd87844](https://github.com/posva/medula/commit/fd87844dea57f0e95942d24c581d048b8fccde87))
- route tool calls to the focused page ([1a41985](https://github.com/posva/medula/commit/1a41985c2fd32dd55023cfa62a6bbfb6e5e17fec))
- **vite:** load connect.js from an inline script so Vite does not warm it up ([4df9a47](https://github.com/posva/medula/commit/4df9a470d38fff633a77c839adadd312def2ca77))

### Features

- headless mcp devtools core on devframe ([58fedc1](https://github.com/posva/medula/commit/58fedc1ed5866709dc9f78ff1c954eb0d6a20792)), closes [devframes/devframe#376](https://github.com/devframes/devframe/issues/376)
- **react:** DevTools hook shim and component tools to edit hook state and props ([d368a0f](https://github.com/posva/medula/commit/d368a0ff2636576bc3ea1443f6e2debaeda62041))
- **react:** hooks and store adapters with Vite and Next.js playgrounds ([a5cd05f](https://github.com/posva/medula/commit/a5cd05f2f3c337c44f5d4c2c6b2c44c9200ec7fa))
- **react:** lazy zero-config component tools from the hook shim, playgrounds without app code ([ac1e909](https://github.com/posva/medula/commit/ac1e909ed4ad3abe2622df7c8dcb64ed1fe830e4))
- **svelte:** exposeStore and exposeRune adapters ([ec2b43b](https://github.com/posva/medula/commit/ec2b43b9a9b3735ba210e78b09155dabcc46f619))
- **svelte:** zero-config Svelte 5 component tools through an instrumented svelte/internal/client ([3c81053](https://github.com/posva/medula/commit/3c8105374ee51854b5ce7119e7f78cc5f888749b))
- **vue:** component tree tools to inspect and edit internal state like Vue DevTools ([797b834](https://github.com/posva/medula/commit/797b834a8787560378595142a7f7c74ac01108e1))
- **vue:** ref, reactive and Pinia adapters with Vite and Nuxt playgrounds ([48680cc](https://github.com/posva/medula/commit/48680ccba3c939076472cd4c2d997d8ec729e8e7))
- **vue:** zero-config discovery of apps, Pinia stores and Vue Router through the hook shim ([3f6c2c9](https://github.com/posva/medula/commit/3f6c2c9e24fda7e27baf26f8f2fe4b4a73c2a807))
- zero-config page script with Vue and React devtools hook shims ([ce70fc4](https://github.com/posva/medula/commit/ce70fc459cd3ee7b0c3b7dfcfc96934abf89be30))

## 0.0.1 (2026-09-14)

### Bug Fixes

- **ci:** avoid Nuxt prepare before library build ([7fc1844](https://github.com/posva/medula/commit/7fc18447572ef248a9bc262e88bd01d82f49ebde))
- **next:** register the instance for devframe connect on the first request ([fd87844](https://github.com/posva/medula/commit/fd87844dea57f0e95942d24c581d048b8fccde87))
- route tool calls to the focused page ([1a41985](https://github.com/posva/medula/commit/1a41985c2fd32dd55023cfa62a6bbfb6e5e17fec))
- **vite:** load connect.js from an inline script so Vite does not warm it up ([4df9a47](https://github.com/posva/medula/commit/4df9a470d38fff633a77c839adadd312def2ca77))

### Features

- headless medula core on devframe ([58fedc1](https://github.com/posva/medula/commit/58fedc1ed5866709dc9f78ff1c954eb0d6a20792)), closes [devframes/devframe#376](https://github.com/devframes/devframe/issues/376)
- **playgrounds:** svelte-vite playground verified over MCP ([aa2eb00](https://github.com/posva/medula/commit/aa2eb00e841bdd93f1093c6a97e552949534e0ef))
- **react:** DevTools hook shim and component tools to edit hook state and props ([d368a0f](https://github.com/posva/medula/commit/d368a0ff2636576bc3ea1443f6e2debaeda62041))
- **react:** hooks and store adapters with Vite and Next.js playgrounds ([a5cd05f](https://github.com/posva/medula/commit/a5cd05f2f3c337c44f5d4c2c6b2c44c9200ec7fa))
- **react:** lazy zero-config component tools from the hook shim, playgrounds without app code ([ac1e909](https://github.com/posva/medula/commit/ac1e909ed4ad3abe2622df7c8dcb64ed1fe830e4))
- **svelte:** exposeStore and exposeRune adapters ([ec2b43b](https://github.com/posva/medula/commit/ec2b43b9a9b3735ba210e78b09155dabcc46f619))
- **svelte:** zero-config Svelte 5 component tools through an instrumented svelte/internal/client ([3c81053](https://github.com/posva/medula/commit/3c8105374ee51854b5ce7119e7f78cc5f888749b))
- **vue:** component tree tools to inspect and edit internal state like Vue DevTools ([797b834](https://github.com/posva/medula/commit/797b834a8787560378595142a7f7c74ac01108e1))
- **vue:** ref, reactive and Pinia adapters with Vite and Nuxt playgrounds ([48680cc](https://github.com/posva/medula/commit/48680ccba3c939076472cd4c2d997d8ec729e8e7))
- **vue:** zero-config discovery of apps, Pinia stores and Vue Router through the hook shim ([3f6c2c9](https://github.com/posva/medula/commit/3f6c2c9e24fda7e27baf26f8f2fe4b4a73c2a807))
- zero-config page script with Vue and React devtools hook shims ([ce70fc4](https://github.com/posva/medula/commit/ce70fc459cd3ee7b0c3b7dfcfc96934abf89be30))
