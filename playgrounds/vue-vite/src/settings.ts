import { reactive } from 'vue'
import { exposeReactive } from 'mcp-devtools/vue'

export const settings = reactive({
  theme: 'light' as 'light' | 'dark',
  fontSize: 16,
  showCompleted: true,
})

// module level: lives as long as the page
exposeReactive('settings', settings, {
  description: 'UI settings: theme (light|dark), fontSize (px), showCompleted',
})
