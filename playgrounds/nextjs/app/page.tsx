import { Greeting, Profile } from './profile'

export default function Page() {
  return (
    <main>
      <h1>mcp-devtools Next playground</h1>
      <p>
        Open <a href="/__mcp-devtools/">/__mcp-devtools/</a> for the MCP config.
      </p>
      <Profile />
      <Greeting name="world" />
    </main>
  )
}
