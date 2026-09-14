<script lang="ts">
  import Item from './Item.svelte'
  import { settings } from './settings.svelte'

  // primitive $state: a signal
  let count = $state(0)
  // object $state that is reassigned: a signal holding a proxy
  let todos = $state([
    { id: 1, text: 'Open the page', done: true },
    { id: 2, text: 'Call medula_svelte_list-components', done: false },
  ])
  // object $state never reassigned: only the proxy exists
  let user = $state({ name: 'Ada', address: { city: 'Paris' } })
  let remaining = $derived(todos.filter((t) => !t.done).length)
  let greeting = $derived(`Hello ${user.name} from ${user.address.city}`)

  function addTodo() {
    todos = [...todos, { id: Date.now(), text: `Todo ${todos.length + 1}`, done: false }]
  }
</script>

<main class={settings.theme} style:font-size="{settings.fontSize}px">
  <header>
    <h1>medula · Svelte</h1>
    <p>{greeting} · {remaining} remaining</p>
    <p class="hint">
      No app code: agents talk to this page at <code>/__medula/__mcp</code>. Config page:
      <a href="/__medula/" target="_blank">/__medula/</a>
    </p>
  </header>

  <section>
    <button onclick={() => count++}>count is {count}</button>
    <button onclick={addTodo}>add todo</button>
  </section>

  <ul>
    {#each todos as todo (todo.id)}
      <Item label={todo.text} bind:done={todo.done} />
    {/each}
  </ul>

  {#if settings.showSettings}
    <section class="settings">
      <label>
        Theme
        <select bind:value={settings.theme}>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </label>
      <label>
        Font size
        <input type="range" min="12" max="24" bind:value={settings.fontSize} />
      </label>
    </section>
  {/if}
</main>
