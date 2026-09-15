import { describe, expect, it } from 'vitest'
import {
  registerState,
  getExposedState,
  listExposedStates,
  onExposedStatesChange,
} from './registry'

describe('registry', () => {
  it('exposes, replaces and disposes states', () => {
    let calls = 0
    const stop = onExposedStatesChange(() => calls++)
    const dispose = registerState('a', { get: () => 1, set: () => {} })
    expect(getExposedState('a')?.get()).toBe(1)
    // replacing keeps one entry and disposing the old one is a no-op
    registerState('a', { get: () => 2, set: () => {} })
    dispose()
    expect(listExposedStates().map((s) => s.name)).toContain('a')
    expect(getExposedState('a')?.get()).toBe(2)
    expect(calls).toBe(2)
    stop()
  })
})
