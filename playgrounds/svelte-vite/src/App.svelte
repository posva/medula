<script lang="ts">
  import { onDestroy } from 'svelte'
  import { exposeRune } from 'mcp-devtools/svelte'
  import { settings, summary } from './settings'

  let count = $state(0)
  let todos = $state([
    { id: 1, text: 'Open the page', done: true },
    { id: 2, text: 'Call mcp-devtools_list-states', done: false },
  ])
  let remaining = $derived(todos.filter((t) => !t.done).length)

  // $state cannot be passed by reference: expose accessors
  onDestroy(exposeRune('count', { get: () => count, set: (v) => (count = v) }, { description: 'Click counter' }))
  onDestroy(
    exposeRune(
      'todos',
      { get: () => $state.snapshot(todos), set: (v) => (todos = v) },
      { description: 'Todo list: { id, text, done }[]' },
    ),
  )
</script>

<main class={$settings.theme} style:font-size="{$settings.fontSize}px">
  <header>
    <h1>mcp-devtools · Svelte</h1>
    <p>{remaining} remaining · <code>{$summary}</code></p>
    <p class="hint">
      Agents talk to this page at <code>/__mcp-devtools/__mcp</code>. Config page:
      <a href="/__mcp-devtools/" target="_blank">/__mcp-devtools/</a>
    </p>
  </header>

  <section>
    <button onclick={() => count++}>count is {count}</button>
  </section>

  <ul>
    {#each todos as todo (todo.id)}
      <li class:done={todo.done}>
        <label><input type="checkbox" bind:checked={todo.done} /> {todo.text}</label>
      </li>
    {/each}
  </ul>

  <section class="settings">
    <label>
      Theme
      <select bind:value={$settings.theme}>
        <option value="light">light</option>
        <option value="dark">dark</option>
      </select>
    </label>
    <label>
      Font size
      <input type="range" min="12" max="24" bind:value={$settings.fontSize} />
    </label>
  </section>
</main>
