import type { NextConfig } from 'next'
import { withMcpDevtools } from 'medula/next'

const nextConfig: NextConfig = withMcpDevtools({
  agentRules: false,
})

export default nextConfig
