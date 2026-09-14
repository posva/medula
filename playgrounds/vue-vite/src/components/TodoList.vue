<script setup lang="ts">
import { ref } from 'vue'
import { exposeRef } from 'mcp-devtools/vue'
import { useTodosStore } from '../stores/todos'
import { settings } from '../settings'

const todos = useTodosStore()
const draft = ref('')
// component local state: disposed with the component
exposeRef('todo-draft', draft, { description: 'Text typed in the "new todo" input' })

function submit() {
  const text = draft.value.trim()
  if (!text) return
  todos.add(text)
  draft.value = ''
}
</script>

<template>
  <section class="todos">
    <form @submit.prevent="submit">
      <input v-model="draft" placeholder="New todo" aria-label="New todo" />
      <button type="submit">Add</button>
    </form>
    <div class="filters">
      <button
        v-for="f in ['all', 'active', 'done'] as const"
        :key="f"
        :class="{ active: todos.filter === f }"
        @click="todos.filter = f"
      >
        {{ f }}
      </button>
    </div>
    <ul>
      <li
        v-for="todo in todos.visible"
        v-show="settings.showCompleted || !todo.done"
        :key="todo.id"
        :class="{ done: todo.done }"
      >
        <label>
          <input type="checkbox" :checked="todo.done" @change="todos.toggle(todo.id)" />
          {{ todo.text }}
        </label>
        <button class="remove" :aria-label="`Remove ${todo.text}`" @click="todos.remove(todo.id)">
          ×
        </button>
      </li>
    </ul>
  </section>
</template>
