'use client'
import { useReducer, useState } from 'react'
import { Clock, Greeting, Profile } from './profile'

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

export function Playground() {
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
        <h1>medula · Next</h1>
        <p>
          {greeting} · {remaining} remaining
        </p>
        <p className="hint">
          Agents talk to this page at <code>/__devframes/__mcp</code>. Open the medula dock for the
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
                setSettings({ ...settings, theme: event.currentTarget.value as 'light' | 'dark' })
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
        <Profile />
        <Greeting name={user.name} />
        <Clock label="ticks" />
      </details>
    </main>
  )
}
