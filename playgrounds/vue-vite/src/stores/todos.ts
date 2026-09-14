import { defineStore } from 'pinia'

export interface Todo {
  id: number
  text: string
  done: boolean
}

export const useTodosStore = defineStore('todos', {
  state: () => ({
    items: [
      { id: 1, text: 'Open the page', done: true },
      { id: 2, text: 'List states through MCP', done: false },
      { id: 3, text: 'Patch a todo', done: false },
    ] as Todo[],
    filter: 'all' as 'all' | 'active' | 'done',
  }),
  getters: {
    visible: (state) =>
      state.items.filter((t) =>
        state.filter === 'all' ? true : state.filter === 'done' ? t.done : !t.done,
      ),
    remaining: (state) => state.items.filter((t) => !t.done).length,
  },
  actions: {
    add(text: string) {
      const id = Math.max(0, ...this.items.map((t) => t.id)) + 1
      this.items.push({ id, text, done: false })
    },
    toggle(id: number) {
      const todo = this.items.find((t) => t.id === id)
      if (todo) todo.done = !todo.done
    },
    remove(id: number) {
      this.items = this.items.filter((t) => t.id !== id)
    },
  },
})
