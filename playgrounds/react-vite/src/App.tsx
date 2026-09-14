import { Component, useReducer, useState } from 'react'
import { settingsStore, useSettings } from './store'

interface Todo {
  id: number
  title: string
  done: boolean
}

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <section>
      <h2>useState</h2>
      <p>
        Count: <output>{count}</output>
      </p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
      <button onClick={() => setCount(0)}>reset</button>
    </section>
  )
}

type TodoAction = { type: 'add'; title: string } | { type: 'toggle'; id: number }

function todosReducer(todos: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'add':
      return [...todos, { id: Date.now(), title: action.title, done: false }]
    case 'toggle':
      return todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t))
  }
}

function Todos() {
  const [todos, dispatch] = useReducer(todosReducer, [
    { id: 1, title: 'Try the MCP tools', done: false },
  ])
  return (
    <section>
      <h2>useReducer</h2>
      <ul>
        {todos.map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            <label>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => dispatch({ type: 'toggle', id: t.id })}
              />
              {t.title}
            </label>
          </li>
        ))}
      </ul>
      <button onClick={() => dispatch({ type: 'add', title: `Todo ${todos.length + 1}` })}>
        add
      </button>
    </section>
  )
}

function Settings() {
  const settings = useSettings()
  return (
    <section style={{ fontSize: settings.fontSize }}>
      <h2>useSyncExternalStore</h2>
      <p>
        Theme: <output>{settings.theme}</output>, font size: <output>{settings.fontSize}</output>
      </p>
      <button
        onClick={() =>
          settingsStore.setState({
            ...settings,
            theme: settings.theme === 'light' ? 'dark' : 'light',
          })
        }
      >
        toggle theme
      </button>
    </section>
  )
}

function Greeting({ name }: { name: string }) {
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

class Clock extends Component<{ label: string }, { ticks: number }> {
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

export function App() {
  return (
    <main>
      <h1>medula React playground</h1>
      <p>
        No devtools code in this app. Open <a href="/__medula/">/__medula/</a> for the MCP config.
      </p>
      <Counter />
      <Todos />
      <Settings />
      <Greeting name="world" />
      <Clock label="ticks" />
    </main>
  )
}
