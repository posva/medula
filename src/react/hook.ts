/**
 * Minimal React DevTools global hook. React only injects its internals
 * (`overrideHookState`, `overrideProps`...) when
 * `__REACT_DEVTOOLS_GLOBAL_HOOK__` exists BEFORE react-dom evaluates, so this
 * must run first: inline it in `<head>` (see {@link REACT_DEVTOOLS_HOOK_SCRIPT}).
 *
 * Self-contained on purpose: it is stringified. No imports, no outer names.
 */
export function installReactDevtoolsHook(target: typeof globalThis = globalThis): void {
  const g = target as unknown as Record<string, any>
  const existing = g.__REACT_DEVTOOLS_GLOBAL_HOOK__
  // the real DevTools already track renderers and roots
  if (existing && typeof existing.getFiberRoots === 'function') return
  const fiberRoots: Record<number, Set<unknown>> = {}
  const getFiberRoots = (id: number) => (fiberRoots[id] ??= new Set())
  const track = (id: number, root: any) => {
    const roots = getFiberRoots(id)
    const state = root.current.memoizedState
    if (state == null || state.element == null) roots.delete(root)
    else roots.add(root)
  }
  if (existing) {
    // hook from another tool (for example Fast Refresh): piggyback on it
    existing.renderers ??= new Map()
    const inject = existing.inject
    const onCommitFiberRoot = existing.onCommitFiberRoot
    existing.inject = function (renderer: unknown) {
      const id = inject.apply(this, arguments)
      existing.renderers.set(id, renderer)
      return id
    }
    existing.onCommitFiberRoot = function (id: number, root: unknown) {
      track(id, root)
      return onCommitFiberRoot?.apply(this, arguments)
    }
    existing.getFiberRoots = getFiberRoots
    return
  }
  const listeners: Record<string, Array<(data: unknown) => void>> = {}
  let uid = 0
  const hook = {
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
      return id
    },
    on(event: string, fn: (data: unknown) => void) {
      ;(listeners[event] ??= []).push(fn)
    },
    off(event: string, fn: (data: unknown) => void) {
      const fns = listeners[event]
      if (fns) listeners[event] = fns.filter((f) => f !== fn)
    },
    sub(event: string, fn: (data: unknown) => void) {
      hook.on(event, fn)
      return () => hook.off(event, fn)
    },
    emit(event: string, data: unknown) {
      for (const fn of listeners[event] ?? []) fn(data)
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
