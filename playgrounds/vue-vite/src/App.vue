<script setup lang="ts">
import { computed } from 'vue'
import { useTodosStore } from './stores/todos'
import { settings } from './settings'
import TodoList from './components/TodoList.vue'

const todos = useTodosStore()
const style = computed(() => ({ fontSize: `${settings.fontSize}px` }))
</script>

<template>
  <main :class="settings.theme" :style="style">
    <header>
      <h1>mcp-devtools · Vue</h1>
      <p>
        {{ todos.remaining }} remaining · theme <code>{{ settings.theme }}</code> · font
        <code>{{ settings.fontSize }}px</code>
      </p>
      <p class="hint">
        Agents talk to this page at <code>/__mcp-devtools/__mcp</code>. Config page:
        <a href="/__mcp-devtools/" target="_blank">/__mcp-devtools/</a>
      </p>
    </header>
    <TodoList />
    <section class="settings">
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
