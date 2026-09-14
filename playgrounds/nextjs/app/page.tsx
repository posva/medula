import { Clock, Greeting, Profile } from './profile'

export default function Page() {
  return (
    <main>
      <h1>medula Next playground</h1>
      <p>
        No devtools code in this app. Open <a href="/__medula/">/__medula/</a> for the MCP config.
      </p>
      <Profile />
      <Greeting name="world" />
      <Clock label="ticks" />
    </main>
  )
}
