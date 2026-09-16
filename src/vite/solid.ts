import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { installSolid2RuntimeHook } from '../solid/hook2'
import { parseAst } from 'vite'
import type { Plugin } from 'vite'
import { installSolidRuntimeHook } from '../solid/hook'

type Wrapped = 'solid-js' | 'solid-js/web' | '@solidjs/web' | '@solidjs/signals'
const WRAPPED: ReadonlySet<string> = new Set<Wrapped>(['solid-js', 'solid-js/web'])
const WRAPPER_PREFIX = '\0medula:'

/**
 * Source of the module served in place of `solid-js` (or `solid-js/web`) to
 * app code: re-exports the real module and installs the recording hook on its
 * `DEV` object. Everything resolves to the same pre-bundled runtime, so the
 * hook sees the roots the app renders.
 */
export function solidWrapperSource(real: Wrapped, major: 1 | 2 = 1): string {
  if (major === 2) {
    const runtime = real === '@solidjs/signals' ? real : 'solid-js'
    return [
      `import * as __solid from '${runtime}'`,
      `export * from '${real}'`,
      `const __medula = (${installSolid2RuntimeHook.toString()})(__solid, globalThis)`,
      ...(real === '@solidjs/web'
        ? []
        : [
            'createSignal',
            'createMemo',
            'createStore',
            'createOptimistic',
            'createOptimisticStore',
            'createProjection',
          ].map((name) => `export const ${name} = __medula.${name}`)),
    ].join('\n')
  }
  return [
    `import * as __solid from 'solid-js'`,
    `import * as __store from 'solid-js/store'`,
    `export * from '${real}'`,
    `;(${installSolidRuntimeHook.toString()})(__solid, __store, globalThis)`,
  ].join('\n')
}

type Named =
  | 'createSignal'
  | 'createMemo'
  | 'createStore'
  | 'createMutable'
  | 'createOptimistic'
  | 'createOptimisticStore'
  | 'createProjection'
/** Position of the `{ name }` options argument. */
const OPTIONS_INDEX: Record<Named, number> = {
  createSignal: 1,
  createMemo: 2,
  createStore: 1,
  createMutable: 1,
  createOptimistic: 1,
  createOptimisticStore: 1,
  createProjection: 2,
}
const SOURCES = new Set(['solid-js', 'solid-js/store', '@solidjs/signals'])
const LANGS: Record<string, 'js' | 'jsx' | 'ts' | 'tsx'> = {
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  jsx: 'jsx',
  ts: 'ts',
  mts: 'ts',
  cts: 'ts',
  tsx: 'tsx',
}

// the AST is only walked structurally; `start`/`end` are all that is read
type Node = Record<string, any> & { type: string; start: number; end: number }

function calleeName(
  callee: Node,
  locals: Map<string, Named>,
  namespaces: Set<string>,
): Named | undefined {
  if (callee.type === 'Identifier') return locals.get(callee.name)
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    namespaces.has(callee.object.name) &&
    callee.property.type === 'Identifier' &&
    callee.property.name in OPTIONS_INDEX
  ) {
    return callee.property.name as Named
  }
  return undefined
}

function declaredName(id: Node, fn: Named): string | undefined {
  if (
    fn === 'createSignal' ||
    fn === 'createStore' ||
    fn === 'createOptimistic' ||
    fn === 'createOptimisticStore'
  ) {
    const first = id.type === 'ArrayPattern' ? id.elements[0] : undefined
    return first?.type === 'Identifier' ? first.name : undefined
  }
  return id.type === 'Identifier' ? id.name : undefined
}

/**
 * `const [count, setCount] = createSignal(0)` ->
 * `createSignal(0, { name: "count" })`, and the same for `createMemo`,
 * `createStore` and `createMutable` imported from `solid-js`/`solid-js/store`
 * (aliases and namespace imports included). Calls that already pass options
 * are left alone. Only inserts text, so line numbers do not move. Returns
 * `undefined` when nothing changes or the file does not parse.
 */
export function solidAutoname(code: string, id: string, major: 1 | 2 = 1): string | undefined {
  if (!/\bcreate(?:Signal|Memo|Store|Mutable|Optimistic|OptimisticStore|Projection)\b/.test(code)) {
    return
  }
  const lang =
    LANGS[
      id
        .replace(/[?#].*$/, '')
        .split('.')
        .pop() ?? ''
    ]
  if (!lang) return
  let program: Node
  try {
    program = parseAst(code, { lang, sourceType: 'module' }, id) as unknown as Node
  } catch {
    return
  }
  const locals = new Map<string, Named>()
  const namespaces = new Set<string>()
  for (const statement of program.body as Node[]) {
    if (statement.type !== 'ImportDeclaration' || !SOURCES.has(statement.source.value)) continue
    for (const spec of statement.specifiers as Node[]) {
      if (spec.type === 'ImportNamespaceSpecifier') {
        namespaces.add(spec.local.name)
      } else if (spec.type === 'ImportSpecifier') {
        const imported: string =
          spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value
        if (imported in OPTIONS_INDEX) locals.set(spec.local.name, imported as Named)
      }
    }
  }
  if (!locals.size && !namespaces.size) return

  const edits: Array<[pos: number, text: string]> = []
  const nameDeclarator = (node: Node) => {
    const init: Node | null = node.init
    if (!init || init.type !== 'CallExpression') return
    const fn = calleeName(init.callee, locals, namespaces)
    if (!fn) return
    const name = declaredName(node.id, fn)
    if (!name) return
    const args: Node[] = init.arguments
    let index = OPTIONS_INDEX[fn]
    if (major === 2) {
      if (fn === 'createMutable') return
      if (fn === 'createMemo') index = 1
      if ((fn === 'createStore' || fn === 'createOptimisticStore') && args.length >= 2) {
        const first = args[0]!
        if (first.type === 'ArrowFunctionExpression' || first.type === 'FunctionExpression') {
          index = 2
        } else if (first.type !== 'ObjectExpression' && first.type !== 'ArrayExpression') return
      }
    } else if (
      fn === 'createOptimistic' ||
      fn === 'createOptimisticStore' ||
      fn === 'createProjection'
    ) {
      return
    }
    if (args.length > index || args.some((arg) => arg.type === 'SpreadElement')) return
    const option = `{ name: ${JSON.stringify(name)} }`
    if (args.length === 0) {
      const generics: Node | undefined = init.typeArguments ?? init.typeParameters
      const open = code.indexOf('(', (generics ?? init.callee).end)
      edits.push([open + 1, `${'undefined, '.repeat(index)}${option}`])
      return
    }
    edits.push([
      args[args.length - 1]!.end,
      `, ${'undefined, '.repeat(index - args.length)}${option}`,
    ])
  }
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    const n = node as Node
    if (n.type === 'VariableDeclarator') nameDeclarator(n)
    for (const key of Object.keys(n)) {
      const value = n[key]
      if (value && typeof value === 'object') visit(value)
    }
  }
  visit(program.body)
  if (!edits.length) return
  let out = code
  for (const [pos, text] of edits.sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, pos) + text + out.slice(pos)
  }
  return out
}

export interface SolidInstrumentationOptions {
  /** Name signals, memos and stores after their variable. @default true */
  autoname?: boolean
}

/**
 * Serve-only plugin: app imports of `solid-js` and `solid-js/web` get a
 * wrapper that installs the recording hook on the `DEV` object of the
 * development build, so agents can list components and read/write their
 * signals and stores with no app code. Also names signals after their
 * variable (like `solid-devtools`' autoname) so the labels are readable.
 * Harmless for non-Solid apps: nothing imports those specifiers.
 */
export function solidInstrumentation(options: SolidInstrumentationOptions = {}): Plugin {
  let major: 1 | 2 = 1
  let wrapped = WRAPPED
  const plugin: Plugin = {
    name: 'medula:solid',
    apply: 'serve',
    configResolved(config) {
      try {
        const require = createRequire(resolve(config.root, 'package.json'))
        const pkg = JSON.parse(readFileSync(require.resolve('solid-js/package.json'), 'utf8'))
        major = Number.parseInt(pkg.version, 10) === 2 ? 2 : 1
      } catch {
        // Non-Solid apps have no runtime to instrument.
      }
      wrapped = major === 2 ? new Set(['solid-js', '@solidjs/web', '@solidjs/signals']) : WRAPPED
    },
    // must run before vite:resolve, which maps the specifier to the pre-bundled dep
    enforce: 'pre',
    resolveId(id, importer, options) {
      if (!wrapped.has(id) || options?.ssr || !importer) return
      if (importer.startsWith('\0')) return
      return WRAPPER_PREFIX + id
    },
    load(id) {
      if (!id.startsWith(WRAPPER_PREFIX)) return
      const real = id.slice(WRAPPER_PREFIX.length) as Wrapped
      if (wrapped.has(real)) return solidWrapperSource(real, major)
    },
  }
  if (options.autoname !== false) {
    plugin.transform = (code, id) => {
      if (id.startsWith('\0') || id.includes('/node_modules/')) return
      const out = solidAutoname(code, id, major)
      // inserts only: the previous map stays valid line by line
      return out === undefined ? undefined : { code: out, map: null }
    }
  }
  return plugin
}
