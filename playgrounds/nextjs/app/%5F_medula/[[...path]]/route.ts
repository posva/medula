import { createMcpDevtoolsHandler } from 'medula/next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Next reserves `_`-prefixed folders, so `__medula` is URL-encoded in the folder name.
const handler = createMcpDevtoolsHandler()

export const GET = handler.fetch
export const POST = handler.fetch
export const DELETE = handler.fetch
