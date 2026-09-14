import { defineStore } from 'pinia'

export interface CartItem {
  sku: string
  name: string
  qty: number
  price: number
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [
      { sku: 'vue', name: 'Vue sticker', qty: 2, price: 3 },
      { sku: 'pinia', name: 'Pinia pineapple', qty: 1, price: 12 },
    ] as CartItem[],
    coupon: null as string | null,
  }),
  getters: {
    total: (state) =>
      state.items.reduce((sum, i) => sum + i.qty * i.price, 0) * (state.coupon ? 0.9 : 1),
  },
  actions: {
    add(sku: string) {
      const item = this.items.find((i) => i.sku === sku)
      if (item) item.qty++
    },
    remove(sku: string) {
      this.items = this.items.filter((i) => i.sku !== sku)
    },
  },
})
