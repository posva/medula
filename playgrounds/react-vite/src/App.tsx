import { useReducer } from 'react'
import { useExposeState, useExposedState } from 'mcp-devtools/react'
import { settingsStore, useSettings } from './store'

interface Todo {
  id: number
  title: string
  done: boolean
}

function Counter() {
  const [count, setCount] = useExposedState('counter', 0, { description: 'Simple counter' })
  return (
    <section>
      <h2>useExposedState</h2>
      <p>
        Count: <output>{count}</output>
      </p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
      <button onClick={() => setCount(0)}>reset</button>
    </section>
  )
}

type TodoAction =
  | { type: 'add'; title: string }
  | { type: 'toggle'; id: number }
  | { type: 'set'; todos: Todo[] }

function todosReducer(todos: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'add':
      return [...todos, { id: Date.now(), title: action.title, done: false }]
    case 'toggle':
      return todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t))
    case 'set':
      return action.todos
  }
}

function Todos() {
  const [todos, dispatch] = useReducer(todosReducer, [
    { id: 1, title: 'Try the MCP tools', done: false },
  ])
  useExposeState('todos', todos, (value) => dispatch({ type: 'set', todos: value }), {
    description: 'Todo list: { id, title, done }[]',
  })
  return (
    <section>
      <h2>useExposeState + useReducer</h2>
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
      <h2>exposeStore</h2>
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

export function App() {
  return (
    <main>
      <h1>mcp-devtools React playground</h1>
      <p>
        Open <a href="/__mcp-devtools/">/__mcp-devtools/</a> for the MCP config.
      </p>
      <Counter />
      <Todos />
      <Settings />
    </main>
  )
}
