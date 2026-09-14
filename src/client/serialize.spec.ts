import { describe, expect, it } from 'vitest'
import { previewJson, toJsonValue } from './serialize'

describe('toJsonValue', () => {
  it('converts rich values', () => {
    const cyclic: Record<string, unknown> = { n: 1 }
    cyclic.self = cyclic
    expect(
      toJsonValue({
        map: new Map([['a', 1]]),
        set: new Set([1, 2]),
        date: new Date('2026-01-01T00:00:00.000Z'),
        big: 10n,
        fn: () => {},
        und: undefined,
        nan: Number.NaN,
        cyclic,
      }),
    ).toEqual({
      map: { a: 1 },
      set: [1, 2],
      date: '2026-01-01T00:00:00.000Z',
      big: '10',
      fn: null,
      und: null,
      nan: null,
      cyclic: { n: 1, self: '[Circular]' },
    })
  })

  it('previews long values', () => {
    expect(previewJson({ a: 'x'.repeat(300) }, 20)).toHaveLength(20)
  })
})
