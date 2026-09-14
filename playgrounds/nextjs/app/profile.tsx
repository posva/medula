'use client'
import { useState } from 'react'
import { useExposedState } from 'mcp-devtools/react'

interface Profile {
  name: string
  age: number
  tags: string[]
}

export function Profile() {
  const [profile, setProfile] = useExposedState<Profile>(
    'profile',
    { name: 'Ada', age: 36, tags: ['math'] },
    { description: 'User profile: { name, age, tags }' },
  )
  return (
    <section>
      <h2>useExposedState</h2>
      <p>
        <output>{profile.name}</output>, <output>{profile.age}</output> years, tags:{' '}
        <output>{profile.tags.join(', ')}</output>
      </p>
      <button onClick={() => setProfile((p) => ({ ...p, age: p.age + 1 }))}>birthday</button>
      <button
        onClick={() => setProfile((p) => ({ ...p, tags: [...p.tags, `tag${p.tags.length + 1}`] }))}
      >
        add tag
      </button>
    </section>
  )
}

// internal state, not exposed: reachable through the mcp-devtools_react_* tools
export function Greeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState('Hello')
  return (
    <section>
      <h2>internal state (React DevTools tools)</h2>
      <p>
        <output>{greeting}</output>, <output>{name}</output>!
      </p>
      <button onClick={() => setGreeting(greeting === 'Hello' ? 'Hi' : 'Hello')}>
        toggle greeting
      </button>
    </section>
  )
}
