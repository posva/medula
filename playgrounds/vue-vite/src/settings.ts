import { reactive } from 'vue'

export const settings = reactive({
  theme: 'light' as 'light' | 'dark',
  fontSize: 16,
  showCompleted: true,
})
