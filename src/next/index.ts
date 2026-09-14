import { createElement } from 'react'
import type { ReactElement } from 'react'
import { BOOTSTRAP_SCRIPT } from '../page/bootstrap'

/** Hook shims to inline at the top of `<head>` (see {@link Medula}). */
export const bootstrapScript: string = BOOTSTRAP_SCRIPT

/**
 * Server component for the root layout `<head>`: in development it inlines
 * the hook shims, so components and state are discovered like the official
 * devtools do. The hub itself is a plain `@devframes/next/hub` setup (see the
 * README): a catch-all route with `nextDevframeHub({ devframes:
 * [medulaHubEntry()] })` and the hub UI script `<base>embedded.js` in the
 * layout, which loads the medula page script.
 *
 * @example
 * <head><Medula /></head>
 */
export function Medula(): ReactElement | null {
  if (process.env.NODE_ENV !== 'development') return null
  return createElement('script', { dangerouslySetInnerHTML: { __html: BOOTSTRAP_SCRIPT } })
}
