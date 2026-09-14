import { afterEach, describe, expect, it } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, reactive, ref } from 'vue'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { mcpDevtoolsVue } from './index'

// the channel registers agent tools in devframe's global browser-agent registry
const REGISTRY_KEY = Symbol.for('devframe:browser-agent-registry')

function tool(name: string): { invoke: (args: Record<string, unknown>) => Promise<any> } {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> }
  const found = [...state.tools.values()].find((t) => t.id === `mcp-devtools:vue:${name}`)
  if (!found) throw new Error(`missing tool ${name}`)
  return found
}

const useDemoStore = defineStore('demo', { state: () => ({ n: 1 }) })

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

describe('mcpDevtoolsVue', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => cleanups.splice(0).forEach((c) => c()))

  function mount() {
    const el = document.createElement('div')
    document.body.append(el)
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = createApp(Root).use(pinia).use(mcpDevtoolsVue)
    app.mount(el)
    cleanups.push(() => {
      app.unmount()
      el.remove()
    })
    return { app, el }
  }

  it('lists the component tree of mounted apps', async () => {
    const { app } = mount()
    const tree = await tool('list-components').invoke({ arg0: {} })
    expect(tree).toEqual([
      {
        id: expect.any(String),
        name: 'Root',
        children: [{ id: expect.any(String), name: 'Child', children: [] }],
      },
    ])
    // stable ids
    expect(await tool('list-components').invoke({ arg0: {} })).toEqual(tree)
    app.unmount()
    expect(await tool('list-components').invoke({ arg0: {} })).toEqual([])
  })

  it('reads props, setupState (refs unwrapped, functions skipped) and data', async () => {
    mount()
    const [root] = await tool('list-components').invoke({ arg0: {} })
    const child = root.children[0]
    expect(await tool('get-component-state').invoke({ arg0: { id: child.id } })).toEqual({
      id: child.id,
      name: 'Child',
      props: { label: 'hi' },
      // stores are summarized: agents use the Pinia adapter for them
      setupState: {
        count: 1,
        settings: { theme: 'light' },
        double: 2,
        store: { $piniaStore: 'demo' },
      },
      data: {},
      readonly: ['double'],
    })
    expect(await tool('get-component-state').invoke({ arg0: { id: root.id } })).toMatchObject({
      name: 'Root',
      props: {},
      setupState: {},
      data: { title: 'hi' },
    })
    await expect(tool('get-component-state').invoke({ arg0: { id: 'nope' } })).rejects.toThrow(
      /Unknown component/,
    )
  })

  it('writes setupState, data and props and re-renders', async () => {
    const { el } = mount()
    const [root] = await tool('list-components').invoke({ arg0: {} })
    const child = root.children[0]
    const set = (arg0: Record<string, unknown>) => tool('set-component-state').invoke({ arg0 })

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
})
