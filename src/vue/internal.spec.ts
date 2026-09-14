import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, reactive, ref } from 'vue'
import type { App } from 'vue'
import { createPinia, defineStore } from 'pinia'
import { installVueDevtoolsHook } from '../page/vue-hook'
import { installVueInternals } from './internal'
import { getExposedState, listExposedStates } from '../client/registry'

// the channel registers agent tools in devframe's global browser-agent registry
const REGISTRY_KEY = Symbol.for('devframe:browser-agent-registry')

function tool(name: string): { invoke: (args: Record<string, unknown>) => Promise<any> } {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> }
  const found = [...state.tools.values()].find((t) => t.id === `medula:${name}`)
  if (!found) throw new Error(`missing tool ${name}`)
  return found
}

const useDemoStore = defineStore('demo', { state: () => ({ n: 1 }) })
const useLateStore = defineStore('late', { state: () => ({ ok: false }) })

const Child = defineComponent({
  name: 'Child',
  props: { label: { type: String, default: '' } },
  setup() {
    const count = ref(1)
    const settings = reactive({ theme: 'light' })
    const double = computed(() => count.value * 2)
    const format = () => 'skipped'
    const store = useDemoStore()
    return { count, settings, double, format, store }
  },
  render() {
    return h('p', `${this.label} ${this.count} ${this.settings.theme}`)
  },
})

const Root = defineComponent({
  name: 'Root',
  data: () => ({ title: 'hi' }),
  render() {
    return h('div', [h(Child, { label: this.title })])
  },
})

describe('zero-config Vue internals', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => cleanups.splice(0).forEach((c) => c()))

  beforeAll(() => {
    // vue loaded first: the shim replays its pending hook registration
    installVueDevtoolsHook(globalThis)
    installVueInternals()
  })

  // no `app.use()` of anything from medula
  function mount(setup: (app: App) => void = () => {}) {
    const el = document.createElement('div')
    document.body.append(el)
    const app = createApp(Root).use(createPinia())
    setup(app)
    app.mount(el)
    cleanups.push(() => {
      app.unmount()
      el.remove()
    })
    return { app, el }
  }

  it('lists the component tree of mounted apps', async () => {
    const { app } = mount()
    const tree = await tool('vue:list-components').invoke({ arg0: {} })
    expect(tree).toEqual([
      {
        id: expect.any(String),
        name: 'Root',
        children: [{ id: expect.any(String), name: 'Child', children: [] }],
      },
    ])
    // stable ids
    expect(await tool('vue:list-components').invoke({ arg0: {} })).toEqual(tree)
    app.unmount()
    expect(await tool('vue:list-components').invoke({ arg0: {} })).toEqual([])
  })

  it('reads props, setupState (refs unwrapped, functions skipped) and data', async () => {
    mount()
    const [root] = await tool('vue:list-components').invoke({ arg0: {} })
    const child = root.children[0]
    expect(await tool('vue:get-component-state').invoke({ arg0: { id: child.id } })).toEqual({
      id: child.id,
      name: 'Child',
      props: { label: 'hi' },
      // stores are summarized: agents use the pinia:* states for them
      setupState: {
        count: 1,
        settings: { theme: 'light' },
        double: 2,
        store: { $piniaStore: 'demo' },
      },
      data: {},
      readonly: ['double'],
    })
    expect(await tool('vue:get-component-state').invoke({ arg0: { id: root.id } })).toMatchObject({
      name: 'Root',
      props: {},
      setupState: {},
      data: { title: 'hi' },
    })
    await expect(tool('vue:get-component-state').invoke({ arg0: { id: 'nope' } })).rejects.toThrow(
      /Unknown component/,
    )
  })

  it('writes setupState, data and props and re-renders', async () => {
    const { el } = mount()
    const [root] = await tool('vue:list-components').invoke({ arg0: {} })
    const child = root.children[0]
    const set = (arg0: Record<string, unknown>) => tool('vue:set-component-state').invoke({ arg0 })

    expect(await set({ id: child.id, section: 'setupState', path: ['count'], value: 5 })).toEqual({
      id: child.id,
      section: 'setupState',
      value: { count: 5, settings: { theme: 'light' }, double: 10, store: { $piniaStore: 'demo' } },
    })
    await set({ id: child.id, section: 'setupState', path: ['settings', 'theme'], value: 'dark' })
    await nextTick()
    expect(el.textContent).toBe('hi 5 dark')

    await set({ id: root.id, section: 'data', path: ['title'], value: 'yo' })
    await nextTick()
    expect(el.textContent).toBe('yo 5 dark')

    await set({ id: child.id, section: 'props', path: ['label'], value: 'forced' })
    await nextTick()
    expect(el.textContent).toBe('forced 5 dark')

    await expect(
      set({ id: child.id, section: 'setupState', path: ['double'], value: 1 }),
    ).rejects.toThrow(/read-only/)
    await expect(
      set({ id: child.id, section: 'setupState', path: ['missing', 'x'], value: 1 }),
    ).rejects.toThrow(/not found/)
  })

  it('exposes every Pinia store as pinia:<id>, including late ones', async () => {
    const { app } = mount()
    expect(listExposedStates().map((s) => s.name)).toContain('pinia:demo')
    const demo = getExposedState('pinia:demo')!
    expect(demo.get()).toEqual({ n: 1 })
    demo.set({ n: 7 })
    await nextTick()
    expect(getExposedState('pinia:demo')!.get()).toEqual({ n: 7 })

    // store created after discovery
    const late = useLateStore(app.config.globalProperties.$pinia)
    expect(getExposedState('pinia:late')!.get()).toEqual({ ok: false })
    getExposedState('pinia:late')!.set({ ok: true })
    expect(late.ok).toBe(true)
  })

  it('registers router tools when the app has $router', async () => {
    // duck-typed router: vue-router is not a dependency of this repo
    const routes = [
      { name: 'home', path: '/', meta: {} },
      { name: 'user', path: '/users/:id', meta: { auth: true } },
    ]
    const current = ref({
      fullPath: '/',
      path: '/',
      name: 'home',
      params: {},
      query: {},
      hash: '',
      meta: {},
      matched: [routes[0]],
    })
    const router = {
      currentRoute: current,
      getRoutes: () => routes,
      push: async (to: any) => {
        current.value = {
          fullPath: `/users/${to.params.id}?tab=${to.query.tab}`,
          path: `/users/${to.params.id}`,
          name: 'user',
          params: to.params,
          query: to.query,
          hash: '',
          meta: { auth: true },
          matched: [routes[1]],
        }
      },
    }
    mount((app) => {
      ;(app.config.globalProperties as any).$router = router
    })
    expect(await tool('router:get-route').invoke({ arg0: {} })).toEqual({
      fullPath: '/',
      path: '/',
      name: 'home',
      params: {},
      query: {},
      hash: '',
      meta: {},
      matched: ['home'],
    })
    expect(await tool('router:list-routes').invoke({ arg0: {} })).toEqual([
      { name: 'home', path: '/', meta: {} },
      { name: 'user', path: '/users/:id', meta: { auth: true } },
    ])
    const after = await tool('router:navigate').invoke({
      arg0: { to: { name: 'user', params: { id: '3' }, query: { tab: 'x' } } },
    })
    expect(after).toMatchObject({ name: 'user', fullPath: '/users/3?tab=x', matched: ['user'] })
  })
})
