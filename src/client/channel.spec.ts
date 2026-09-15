import { afterEach, describe, expect, it } from 'vitest'
import { ensureChannel } from './channel'
import { listExposedStates, registerState } from './registry'

// the channel registers agent tools in devframe's global browser-agent registry
const REGISTRY_KEY = Symbol.for('devframe:browser-agent-registry')

function agentTools(): Array<{ id: string; invoke: (args: Record<string, unknown>) => unknown }> {
  const state = (globalThis as any)[REGISTRY_KEY] as { tools: Map<symbol, any> } | undefined
  return state ? [...state.tools.values()] : []
}

describe('channel agent tools', () => {
  const disposers: Array<() => void> = []
  afterEach(() => disposers.splice(0).forEach((d) => d()))

  it('lists, reads, sets and patches exposed states', async () => {
    ensureChannel()
    let user = { name: 'Ada', tags: ['a'] }
    disposers.push(
      registerState('user', {
        description: 'Current user',
        get: () => user,
        set: (v) => (user = v),
      }),
    )
    const tool = (name: string) => agentTools().find((t) => t.id === `medula:${name}`)!
    expect(tool('list-states')).toBeDefined()
    expect(await tool('list-states').invoke({ arg0: {} })).toEqual([
      { name: 'user', description: 'Current user', preview: JSON.stringify(user) },
    ])
    expect(await tool('get-state').invoke({ arg0: { name: 'user' } })).toEqual({
      name: 'user',
      value: { name: 'Ada', tags: ['a'] },
    })
    await tool('patch-state').invoke({ arg0: { name: 'user', path: ['tags', 1], value: 'b' } })
    expect(user.tags).toEqual(['a', 'b'])
    await tool('set-state').invoke({ arg0: { name: 'user', value: { name: 'Bob', tags: [] } } })
    expect(user).toEqual({ name: 'Bob', tags: [] })
    await expect(tool('get-state').invoke({ arg0: { name: 'nope' } })).rejects.toThrow(
      /Unknown state "nope"/,
    )
    expect(listExposedStates()).toHaveLength(1)
  })
})
