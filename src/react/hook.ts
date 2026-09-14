/** Shared record of injected renderers, for tools that load later. */
export interface ReactHookStore {
  renderers: Map<number, unknown>
  listeners: Set<(id: number, renderer: unknown) => void>
}

/** `globalThis` key of the {@link ReactHookStore}. */
export const REACT_HOOK_STORE_KEY: unique symbol = Symbol.for('medula:react-hook')

/**
 * Minimal React DevTools global hook. React only injects its internals
 * (`overrideHookState`, `overrideProps`...) when
 * `__REACT_DEVTOOLS_GLOBAL_HOOK__` exists BEFORE react-dom evaluates, so this
 * must run first: inline it in `<head>` (see {@link REACT_DEVTOOLS_HOOK_SCRIPT}).
 * Every injected renderer is recorded on `globalThis[Symbol.for('medula:react-hook')]`
 * and announced to its listeners, also when another hook (React DevTools,
 * Fast Refresh) owns the global.
 *
 * Self-contained on purpose: it is stringified. No imports, no outer names.
 */
export function installReactDevtoolsHook(target: typeof globalThis = globalThis): void {
  const g = target as unknown as Record<string | symbol, any>
  const STORE = Symbol.for('medula:react-hook')
  const store = (g[STORE] ??= { renderers: new Map(), listeners: new Set() })
  const announce = (id: number, renderer: unknown) => {
    store.renderers.set(id, renderer)
    for (const listener of store.listeners) listener(id, renderer)
  }
  const fiberRoots: Record<number, Set<unknown>> = {}
  const getFiberRoots = (id: number) => (fiberRoots[id] ??= new Set())
  const track = (id: number, root: any) => {
    const roots = getFiberRoots(id)
    const state = root.current.memoizedState
    if (state == null || state.element == null) roots.delete(root)
    else roots.add(root)
  }
  const existing = g.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (existing) {
    if (existing[STORE]) return
    existing[STORE] = true
    // hook from another tool (React DevTools, Fast Refresh): piggyback on it
    existing.renderers ??= new Map()
    const inject = existing.inject
    existing.inject = function (renderer: unknown) {
      const id = inject.apply(this, arguments)
      existing.renderers.set(id, renderer)
      announce(id, renderer)
      return id
    }
    for (const [id, renderer] of existing.renderers) announce(id, renderer)
    if (typeof existing.getFiberRoots !== 'function') {
      const onCommitFiberRoot = existing.onCommitFiberRoot
      existing.onCommitFiberRoot = function (id: number, root: unknown) {
        track(id, root)
        return onCommitFiberRoot?.apply(this, arguments)
      }
      existing.getFiberRoots = getFiberRoots
    }
    return
  }
  const events: Record<string, Array<(data: unknown) => void>> = {}
  let uid = 0
  const hook = {
    [STORE]: true,
    renderers: new Map<number, unknown>(),
    rendererInterfaces: new Map<number, unknown>(),
    supportsFiber: true,
    supportsFlight: false,
    // marks this as a devtools hook; also silences the "download DevTools" log
    checkDCE() {},
    inject(renderer: unknown) {
      const id = ++uid
      hook.renderers.set(id, renderer)
      hook.emit('renderer', { id, renderer })
      announce(id, renderer)
      return id
    },
    on(event: string, fn: (data: unknown) => void) {
      ;(events[event] ??= []).push(fn)
    },
    off(event: string, fn: (data: unknown) => void) {
      const fns = events[event]
      if (fns) events[event] = fns.filter((f) => f !== fn)
    },
    sub(event: string, fn: (data: unknown) => void) {
      hook.on(event, fn)
      return () => hook.off(event, fn)
    },
    emit(event: string, data: unknown) {
      for (const fn of events[event] ?? []) fn(data)
    },
    getFiberRoots,
    onCommitFiberRoot: track,
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    setStrictMode() {},
  }
  g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook
}

/**
 * {@link installReactDevtoolsHook} as an inline classic script. Hosts put it
 * in `<head>` before any bundle so React registers its internals with it.
 */
export const REACT_DEVTOOLS_HOOK_SCRIPT: string = `(${installReactDevtoolsHook.toString()})(globalThis)`
