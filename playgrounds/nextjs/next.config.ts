import type { NextConfig } from 'next'
import { withMcpDevtools } from 'mcp-devtools/next'

const nextConfig: NextConfig = withMcpDevtools({
  agentRules: false,
})

export default nextConfig
