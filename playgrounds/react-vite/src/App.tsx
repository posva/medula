import { Component, useReducer, useState } from 'react'

interface Todo {
  id: number
  text: string
  done: boolean
}

type TodoAction = { type: 'add' } | { type: 'toggle'; id: number }

function todosReducer(todos: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'add':
      return [
        ...todos,
        {
          id: Math.max(0, ...todos.map((todo) => todo.id)) + 1,
          text: `Todo ${todos.length + 1}`,
          done: false,
        },
      ]
    case 'toggle':
      return todos.map((todo) => (todo.id === action.id ? { ...todo, done: !todo.done } : todo))
  }
}

function Item({ label, done, onToggle }: { label: string; done: boolean; onToggle: () => void }) {
  const [highlighted, setHighlighted] = useState(false)
  return (
    <li
      className={[done && 'done', highlighted && 'highlighted'].filter(Boolean).join(' ')}
      onPointerEnter={() => setHighlighted(true)}
      onPointerLeave={() => setHighlighted(false)}
    >
      <label>
        <input type="checkbox" checked={done} onChange={onToggle} /> {label}
      </label>
    </li>
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
  const [count, setCount] = useState(0)
  const [user, setUser] = useState({ name: 'Ada', address: { city: 'Paris' } })
  const [todos, dispatch] = useReducer(todosReducer, [
    { id: 1, text: 'Open the page', done: true },
    { id: 2, text: 'Try the MCP tools', done: false },
  ])
  const [settings, setSettings] = useState({
    theme: 'light' as 'light' | 'dark',
    fontSize: 16,
    showSettings: true,
  })
  const remaining = todos.filter((todo) => !todo.done).length
  const greeting = `Hello ${user.name} from ${user.address.city}`

  return (
    <main className={settings.theme} style={{ fontSize: settings.fontSize }}>
      <header>
        <h1>medula · React</h1>
        <p>
          {greeting} · {remaining} remaining
        </p>
        <p className="hint">
          Agents talk to this page at <code>/__devtools/__mcp</code>. Open the medula dock for the
          MCP config.
        </p>
      </header>
      <section>
        <button onClick={() => setCount((value) => value + 1)}>count is {count}</button>
        <button onClick={() => dispatch({ type: 'add' })}>add todo</button>
        <button
          onClick={() =>
            setUser((value) => ({ ...value, name: value.name === 'Ada' ? 'Bob' : 'Ada' }))
          }
        >
          toggle user
        </button>
      </section>
      <ul>
        {todos.map((todo) => (
          <Item
            key={todo.id}
            label={todo.text}
            done={todo.done}
            onToggle={() => dispatch({ type: 'toggle', id: todo.id })}
          />
        ))}
      </ul>
      <label>
        <input
          type="checkbox"
          checked={settings.showSettings}
          onChange={(event) =>
            setSettings({ ...settings, showSettings: event.currentTarget.checked })
          }
        />
        Show settings
      </label>
      {settings.showSettings && (
        <section className="settings">
          <label>
            Theme
            <select
              value={settings.theme}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  theme: event.currentTarget.value as 'light' | 'dark',
                })
              }
            >
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
          </label>
          <label>
            Font size
            <input
              type="range"
              min="12"
              max="24"
              value={settings.fontSize}
              onChange={(event) =>
                setSettings({ ...settings, fontSize: Number(event.currentTarget.value) })
              }
            />
          </label>
        </section>
      )}
      <details>
        <summary>More state examples</summary>
        <Greeting name={user.name} />
        <Clock label="ticks" />
      </details>
    </main>
  )
}
