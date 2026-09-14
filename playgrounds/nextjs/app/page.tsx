import { Clock, Greeting, Profile } from './profile'

export default function Page() {
  return (
    <main>
      <h1>medula Next playground</h1>
      <p>
        No devtools code in this app. Open the medula dock (bottom of the page) or
        <a href="/__devframes/medula/">/__devframes/medula/</a> for the MCP config.
      </p>
      <Profile />
      <Greeting name="world" />
      <Clock label="ticks" />
    </main>
  )
}
