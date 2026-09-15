// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { solidAutoname, solidInstrumentation } from './solid'

const source = `
import { createSignal, createMemo as memo } from 'solid-js'
import * as S from 'solid-js/store'
import { other } from 'other'
const [count, setCount] = createSignal(0)
const [maybe] = createSignal<number>()
const [named] = createSignal(1, { name: 'x' })
const double = memo(() => count() * 2)
const withInit = memo(() => 1, 0)
const [todos, setTodos] = S.createStore({ list: [] })
const m = S.createMutable({ a: 1 })
const [spread] = createSignal(...args)
const [o] = other(1)
`

describe('solidAutoname', () => {
  it('names signals, memos and stores after their variable', () => {
    const out = solidAutoname(source, '/app/src/App.tsx')!
    expect(out).toContain(`createSignal(0, { name: "count" })`)
    expect(out).toContain(`createSignal<number>(undefined, { name: "maybe" })`)
    expect(out).toContain(`createSignal(1, { name: 'x' })`)
    expect(out).toContain(`memo(() => count() * 2, undefined, { name: "double" })`)
    expect(out).toContain(`memo(() => 1, 0, { name: "withInit" })`)
    expect(out).toContain(`S.createStore({ list: [] }, { name: "todos" })`)
    expect(out).toContain(`S.createMutable({ a: 1 }, { name: "m" })`)
    expect(out).toContain(`createSignal(...args)\n`)
    expect(out).toContain(`other(1)\n`)
    // only inserts, so line numbers are unchanged
    expect(out.split('\n').length).toBe(source.split('\n').length)
  })

  it('leaves files alone when nothing comes from solid-js or nothing changes', () => {
    expect(solidAutoname(`const [a] = createSignal(0)`, '/app/a.ts')).toBeUndefined()
    expect(
      solidAutoname(`import { createSignal } from 'solid-js'\nconsole.log(1)`, '/app/a.ts'),
    ).toBeUndefined()
    expect(solidAutoname(`import { x } from 'solid-js'\nconst = )`, '/app/a.ts')).toBeUndefined()
  })
})

describe('solidInstrumentation', () => {
  const plugin = solidInstrumentation()
  const resolveId = plugin.resolveId as (id: string, importer?: string, options?: any) => unknown
  const load = plugin.load as (id: string) => unknown
  const transform = plugin.transform as (code: string, id: string) => unknown

  it('serves the wrappers to app code only', () => {
    expect(resolveId('solid-js', '/app/src/App.tsx')).toBe('\0medula:solid-js')
    expect(resolveId('solid-js/web', '/app/src/main.tsx')).toBe('\0medula:solid-js/web')
    expect(resolveId('solid-js/store', '/app/src/main.tsx')).toBeUndefined()
    expect(resolveId('solid-js', '\0medula:solid-js')).toBeUndefined()
    expect(resolveId('solid-js', undefined)).toBeUndefined()
    expect(resolveId('solid-js', '/app/src/App.tsx', { ssr: true })).toBeUndefined()
    expect(load('\0medula:solid-js/web')).toContain(`export * from 'solid-js/web'`)
    expect(load('/app/src/App.tsx')).toBeUndefined()
  })

  it('renames only app sources', () => {
    const code = `import { createSignal } from 'solid-js'\nconst [a] = createSignal(0)`
    expect(transform(code, '/app/src/a.ts')).toEqual({
      code: `import { createSignal } from 'solid-js'\nconst [a] = createSignal(0, { name: "a" })`,
      map: null,
    })
    expect(transform(code, '/app/node_modules/lib/a.js')).toBeUndefined()
    expect(transform(code, '/app/src/a.css')).toBeUndefined()
    expect(solidInstrumentation({ autoname: false }).transform).toBeUndefined()
  })
})
