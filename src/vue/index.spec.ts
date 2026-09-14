import { afterEach, describe, expect, it } from 'vitest'
import { createApp, effectScope, reactive, ref, shallowRef } from 'vue'
import { createPinia, defineStore, disposePinia, setActivePinia } from 'pinia'
import { exposeReactive, exposeRef, exposeStore, piniaMcpDevtools } from './index'
import { getExposedState } from '../client/registry'

describe('vue adapter', () => {
  const disposers: Array<() => void> = []
  afterEach(() => disposers.splice(0).forEach((d) => d()))

  it('exposeRef reads and writes a ref', () => {
    const count = ref(1)
    disposers.push(exposeRef('count', count, { description: 'A counter' }))
    const state = getExposedState('count')!
    expect(state.description).toBe('A counter')
    expect(state.get()).toBe(1)
    state.set(5)
    expect(count.value).toBe(5)
  })

  it('exposeRef works with shallowRef', () => {
    const user = shallowRef({ name: 'Ada' })
    disposers.push(exposeRef('user', user))
    getExposedState('user')!.set({ name: 'Grace' })
    expect(user.value).toEqual({ name: 'Grace' })
  })

  it('exposeReactive replaces the content in place', () => {
    const settings = reactive<Record<string, unknown>>({ theme: 'dark', size: 12 })
    disposers.push(exposeReactive('settings', settings))
    expect(getExposedState('settings')!.get()).toEqual({ theme: 'dark', size: 12 })
    getExposedState('settings')!.set({ theme: 'light', lang: 'en' })
    // same object, keys not present are removed
    expect(settings).toEqual({ theme: 'light', lang: 'en' })
    expect('size' in settings).toBe(false)
  })

  it('exposeStore uses the store id and replaces the state', () => {
    setActivePinia(createPinia())
    const useCart = defineStore('cart', {
      state: () => ({ items: ['a'], coupon: null as string | null }),
    })
    const cart = useCart()
    disposers.push(exposeStore(cart))
    expect(getExposedState('cart')!.get()).toEqual({ items: ['a'], coupon: null })
    getExposedState('cart')!.set({ items: ['b', 'c'], coupon: 'FREE' })
    expect(cart.items).toEqual(['b', 'c'])
    expect(cart.coupon).toBe('FREE')
    disposers.push(exposeStore(cart, { name: 'my-cart', description: 'Cart' }))
    expect(getExposedState('my-cart')!.description).toBe('Cart')
  })

  it('piniaMcpDevtools exposes every store', () => {
    // plugins run only once pinia is installed on an app
    const pinia = createPinia().use(piniaMcpDevtools)
    createApp({}).use(pinia)
    setActivePinia(pinia)
    const useA = defineStore('a', { state: () => ({ n: 1 }) })
    const useB = defineStore('b', () => ({ label: ref('x') }))
    useA()
    const b = useB()
    expect(getExposedState('a')!.get()).toEqual({ n: 1 })
    getExposedState('b')!.set({ label: 'y' })
    expect(b.label).toBe('y')
    // the exposure lives in the store scope
    disposePinia(pinia)
    expect(getExposedState('a')).toBeUndefined()
    expect(getExposedState('b')).toBeUndefined()
  })

  it('disposes with the effect scope', () => {
    const scope = effectScope()
    scope.run(() => {
      exposeRef('scoped', ref(1))
      exposeReactive('scoped-obj', reactive({}))
    })
    expect(getExposedState('scoped')).toBeDefined()
    expect(getExposedState('scoped-obj')).toBeDefined()
    scope.stop()
    expect(getExposedState('scoped')).toBeUndefined()
    expect(getExposedState('scoped-obj')).toBeUndefined()
  })
})
