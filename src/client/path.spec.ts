import { describe, expect, it } from 'vitest'
import { getAtPath, setAtPath } from './path'

describe('setAtPath', () => {
  it('copies along the path', () => {
    const root = { a: { b: [1, 2] }, c: 1 }
    const next = setAtPath(root, ['a', 'b', 1], 3) as typeof root
    expect(next).toEqual({ a: { b: [1, 3] }, c: 1 })
    expect(next).not.toBe(root)
    expect(next.a).not.toBe(root.a)
    expect(root.a.b).toEqual([1, 2])
  })

  it('creates missing containers and replaces the root', () => {
    expect(setAtPath(undefined, ['x', 0], 'v')).toEqual({ x: ['v'] })
    expect(setAtPath({ a: 1 }, [], 5)).toBe(5)
    expect(getAtPath({ a: [{ b: 2 }] }, ['a', 0, 'b'])).toBe(2)
    expect(getAtPath({ a: 1 }, ['a', 'b'])).toBeUndefined()
  })
})
