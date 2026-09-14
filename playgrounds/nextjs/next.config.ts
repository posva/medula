import type { NextConfig } from 'next'
import { withDevframe } from '@devframes/next/single'

// `withDevframe` applies the settings a devframe host requires (currently
// `skipTrailingSlashRedirect: true`, so the mounted dock pages' relative
// assets under `/__devframes/<id>/` resolve).
const nextConfig: NextConfig = withDevframe({
  agentRules: false,
})

export default nextConfig
