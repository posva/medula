import { installReactDevtoolsHook } from '../react/hook'
import { installVueDevtoolsHook } from './vue-hook'

/**
 * Inline `<script>` for the top of `<head>`: installs the Vue and React
 * devtools hooks before the frameworks load so the page script can find their
 * apps and renderers. No imports: the functions are inlined as source.
 */
export const BOOTSTRAP_SCRIPT: string = [
  `(${installVueDevtoolsHook.toString()})(globalThis);`,
  `(${installReactDevtoolsHook.toString()})(globalThis);`,
].join('')
