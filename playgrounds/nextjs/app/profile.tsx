'use client'
import { Component, useState } from 'react'

interface Profile {
  name: string
  age: number
  tags: string[]
}

export function Profile() {
  const [profile, setProfile] = useState<Profile>({ name: 'Ada', age: 36, tags: ['math'] })
  return (
    <section>
      <h2>useState</h2>
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

export function Greeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState('Hello')
  return (
    <section>
      <h2>props</h2>
      <p>
        <output>{greeting}</output>, <output>{name}</output>!
      </p>
      <button onClick={() => setGreeting(greeting === 'Hello' ? 'Hi' : 'Hello')}>
        toggle greeting
      </button>
    </section>
  )
}

export class Clock extends Component<{ label: string }, { ticks: number }> {
  state = { ticks: 0 }
  render() {
    return (
      <section>
        <h2>class component</h2>
        <p>
          <output>{this.props.label}</output>: <output>{this.state.ticks}</output>
        </p>
        <button onClick={() => this.setState({ ticks: this.state.ticks + 1 })}>tick</button>
      </section>
    )
  }
}
