import { exposeState } from 'mcp-devtools/client'

let counter = { count: 1, label: 'fixture' }
const el = document.getElementById('state')!
const render = () => (el.textContent = JSON.stringify(counter))

exposeState('counter', {
  description: 'E2E fixture counter with a numeric count and a text label',
  get: () => counter,
  set: (value) => {
    counter = value
    render()
  },
})
render()
