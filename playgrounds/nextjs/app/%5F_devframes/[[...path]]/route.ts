import { createMedulaHandler } from 'medula/next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Next reserves `_`-prefixed folders, so `__devframes` is URL-encoded in the folder name.
const handler = createMedulaHandler()

export const GET = handler.fetch
export const POST = handler.fetch
export const DELETE = handler.fetch
