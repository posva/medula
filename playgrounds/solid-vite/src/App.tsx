import { For, Show, createMemo, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import Item from './Item'
import { setSettings, setTheme, settings, theme } from './settings'

export default function App() {
  // primitive signal
  const [count, setCount] = createSignal(0)
  // signal holding an object: nested writes produce a new object
  const [user, setUser] = createSignal({ name: 'Ada', address: { city: 'Paris' } })
  // store: nested writes go through the store setter
  const [todos, setTodos] = createStore([
    { id: 1, text: 'Open the page', done: true },
    { id: 2, text: 'Call medula_solid_list-components', done: false },
  ])
  const remaining = createMemo(() => todos.filter((t) => !t.done).length)
  const greeting = createMemo(() => `Hello ${user().name} from ${user().address.city}`)

  function addTodo() {
    setTodos(todos.length, { id: Date.now(), text: `Todo ${todos.length + 1}`, done: false })
  }

  return (
    <main class={theme()} style={{ 'font-size': `${settings.fontSize}px` }}>
      <header>
        <h1>medula · Solid</h1>
        <p>
          {greeting()} · {remaining()} remaining
        </p>
        <p class="hint">
          No app code: agents talk to this page at <code>/__devtools/__mcp</code>. Config page:{' '}
          <a href="/__medula/" target="_blank">
            /__medula/
          </a>
        </p>
      </header>

      <section>
        <button onClick={() => setCount(count() + 1)}>count is {count()}</button>
        <button onClick={addTodo}>add todo</button>
        <button onClick={() => setUser({ ...user(), name: user().name === 'Ada' ? 'Bob' : 'Ada' })}>
          toggle user
        </button>
      </section>

      <ul>
        <For each={todos}>
          {(todo, i) => (
            <Item
              label={todo.text}
              done={todo.done}
              onToggle={() => setTodos(i(), 'done', (done) => !done)}
            />
          )}
        </For>
      </ul>

      <Show when={settings.showSettings}>
        <section class="settings">
          <label>
            Theme
            <select
              value={theme()}
              onChange={(e) => setTheme(e.currentTarget.value as 'light' | 'dark')}
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
              onInput={(e) => setSettings('fontSize', Number(e.currentTarget.value))}
            />
          </label>
        </section>
      </Show>
    </main>
  )
}
