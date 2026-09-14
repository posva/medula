<script setup lang="ts">
import { useCartStore } from '~/stores/cart'

// nothing from medula here: the module injects the page script
const cart = useCartStore()
// component state: agents reach it through mcp-devtools_vue_set-component-state
const greeting = ref('Hello')
// shared SSR-friendly state, also in setupState
const visitor = useState('visitor', () => ({ name: 'Anonymous', vip: false }))
</script>

<template>
  <main :class="{ vip: visitor.vip }">
    <h1>medula · Nuxt</h1>
    <p>
      {{ greeting }} <strong>{{ visitor.name }}</strong>
      <span v-if="visitor.vip" class="badge">VIP</span>
    </p>
    <p class="hint">
      Agents talk to this page at <code>/__medula/__mcp</code>. Config page:
      <a href="/__medula/" target="_blank">/__medula/</a>
    </p>

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
    <label>
      Visitor name
      <input v-model="visitor.name" />
    </label>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
main {
  min-height: 100vh;
  padding: 2rem;
  box-sizing: border-box;
  background: #fafafa;
  color: #222;
}
main.vip {
  background: #fff7e0;
}
.badge {
  background: goldenrod;
  color: white;
  border-radius: 999px;
  padding: 0 0.5em;
  font-size: 0.8em;
}
.hint {
  opacity: 0.7;
  font-size: 0.85em;
}
code {
  background: rgba(127, 127, 127, 0.2);
  padding: 0 0.3em;
  border-radius: 3px;
}
ul {
  list-style: none;
  padding: 0;
  max-width: 24rem;
}
li {
  display: flex;
  justify-content: space-between;
  padding: 0.4em 0;
  border-bottom: 1px solid rgba(127, 127, 127, 0.3);
}
button {
  font: inherit;
  cursor: pointer;
  margin-left: 0.25rem;
}
input {
  font: inherit;
  padding: 0.3em;
}
</style>
