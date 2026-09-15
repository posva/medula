<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useTodosStore } from './stores/todos'
import { settings } from './settings'
import TodoList from './components/TodoList.vue'

const todos = useTodosStore()
// component state: agents reach it through medula_vue_set-component-state
const title = ref('medula · Vue')
const count = ref(0)
const user = reactive({ name: 'Ada', address: { city: 'Paris' } })
const greeting = computed(() => `Hello ${user.name} from ${user.address.city}`)
const style = computed(() => ({ fontSize: `${settings.fontSize}px` }))
</script>

<template>
  <main :class="settings.theme" :style="style">
    <header>
      <h1>{{ title }}</h1>
      <p>{{ greeting }} · {{ todos.remaining }} remaining</p>
      <p class="hint">
        Agents talk to this page at <code>/__devtools/__mcp</code>. Open the medula dock for the MCP
        config.
      </p>
    </header>
    <section>
      <button @click="count++">count is {{ count }}</button>
      <button @click="todos.add(`Todo ${todos.items.length + 1}`)">add todo</button>
      <button @click="user.name = user.name === 'Ada' ? 'Bob' : 'Ada'">toggle user</button>
    </section>
    <TodoList />
    <label>
      <input v-model="settings.showSettings" type="checkbox" />
      Show settings
    </label>
    <section v-if="settings.showSettings" class="settings">
      <label>
        Theme
        <select v-model="settings.theme">
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </label>
      <label>
        Font size
        <input v-model.number="settings.fontSize" type="range" min="12" max="24" />
      </label>
      <label>
        <input v-model="settings.showCompleted" type="checkbox" />
        Show completed
      </label>
    </section>
  </main>
</template>
