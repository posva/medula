/** Where the hook shim records Vue apps for the page script. */
export const VUE_HOOK_KEY: unique symbol = Symbol.for('medula:vue-hook') as never

export interface VueHookCapture {
  apps: Set<unknown>
  listeners: Set<(app: unknown) => void>
}

/**
 * Installs `__VUE_DEVTOOLS_GLOBAL_HOOK__` (the contract Vue DevTools use) so
 * every Vue app announces itself through `app:init`. Self-contained: it is
 * inlined as a string in `<head>` and must run before Vue loads. When the
 * real Vue DevTools hook is present, it subscribes to it instead.
 */
export function installVueDevtoolsHook(target: any): void {
  const KEY = Symbol.for('medula:vue-hook')
  const capture = (target[KEY] ??= { apps: new Set(), listeners: new Set() })
  const announce = (app: unknown) => {
    if (!app || capture.apps.has(app)) return
    capture.apps.add(app)
    for (const listener of capture.listeners) listener(app)
  }
  const forget = (app: unknown) => capture.apps.delete(app)

  const existing = target.__VUE_DEVTOOLS_GLOBAL_HOOK__
  if (existing) {
    existing.on?.('app:init', announce)
    existing.on?.('app:unmount', forget)
    for (const app of existing.apps ?? []) announce(app)
    return
  }

  const events = new Map<string, Array<(...args: unknown[]) => void>>()
  const hook = {
    id: 'medula',
    devtoolsVersion: '7.0',
    enabled: false,
    apps: [] as unknown[],
    appRecords: [] as unknown[],
    events,
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!events.has(event)) events.set(event, [])
      events.get(event)!.push(fn)
      return () => hook.off(event, fn)
    },
    once(event: string, fn: (...args: unknown[]) => void) {
      const onceFn = (...args: unknown[]) => {
        hook.off(event, onceFn)
        fn(...args)
      }
      hook.on(event, onceFn)
    },
    off(event: string, fn: (...args: unknown[]) => void) {
      const list = events.get(event)
      const index = list ? list.indexOf(fn) : -1
      if (list && index !== -1) list.splice(index, 1)
    },
    emit(event: string, ...args: unknown[]) {
      if (event === 'app:init') {
        hook.apps.push(args[0])
        announce(args[0])
      } else if (event === 'app:unmount') {
        hook.apps = hook.apps.filter((app) => app !== args[0])
        forget(args[0])
      }
      for (const fn of events.get(event) ?? []) fn(...args)
    },
  }
  target.__VUE_DEVTOOLS_GLOBAL_HOOK__ = hook

  // Vue loaded first and waits up to 3s for a late devtools
  const replay = target.__VUE_DEVTOOLS_HOOK_REPLAY__
  if (Array.isArray(replay)) {
    target.__VUE_DEVTOOLS_HOOK_REPLAY__ = null
    for (const fn of replay) fn(hook)
  }
}

/** Run `callback` for every Vue app already announced and every future one. */
export function onVueApp(callback: (app: unknown) => void): () => void {
  const capture = (globalThis as any)[VUE_HOOK_KEY] as VueHookCapture | undefined
  if (!capture) return () => {}
  for (const app of capture.apps) callback(app)
  capture.listeners.add(callback)
  return () => {
    capture.listeners.delete(callback)
  }
}
