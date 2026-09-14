import type { NextConfig } from 'next'
import { withMedula } from 'medula/next'

const nextConfig: NextConfig = withMedula({
  agentRules: false,
})

export default nextConfig
