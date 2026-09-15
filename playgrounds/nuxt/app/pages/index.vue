<script setup lang="ts">
import { useCartStore } from '~/stores/cart'
import { useTodosStore } from '~/stores/todos'

const cart = useCartStore()
const count = ref(0)
const user = useState('user', () => ({ name: 'Ada', address: { city: 'Paris' } }))
const settings = useState('settings', () => ({
  theme: 'light' as 'light' | 'dark',
  fontSize: 16,
  showSettings: true,
}))
const todos = useTodosStore()
const greeting = computed(() => `Hello ${user.value.name} from ${user.value.address.city}`)
</script>

<template>
  <main :class="settings.theme" :style="{ fontSize: `${settings.fontSize}px` }">
    <header>
      <h1>medula · Nuxt</h1>
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
    <ul>
      <TodoItem
        v-for="todo in todos.items"
        :key="todo.id"
        :label="todo.text"
        v-model:done="todo.done"
      />
    </ul>
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
    </section>
    <details>
      <summary>More state examples</summary>
      <h2>Cart · total {{ cart.total.toFixed(2) }}</h2>
      <p v-if="cart.coupon">
        Coupon <code>{{ cart.coupon }}</code> applied (-10%)
      </p>
      <ul>
        <li v-for="item in cart.items" :key="item.sku">
          <span>{{ item.name }} × {{ item.qty }}</span>
          <span>
            <button @click="cart.add(item.sku)">+1</button>
            <button :aria-label="`Remove ${item.name}`" @click="cart.remove(item.sku)">×</button>
          </span>
        </li>
      </ul>
      <NuxtLink to="/about">About</NuxtLink>
    </details>
  </main>
</template>
