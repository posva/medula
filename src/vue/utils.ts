import type { VNode } from 'vue'

// Duck-typed Vue reactivity flags (like devtools-kit's stub-vue): this code
// runs in the page script, outside the app bundle, so it must not import Vue.

export function isRef(value: unknown): value is { value: unknown } {
  return !!value && (value as any).__v_isRef === true
}

export function isReactive(value: unknown): boolean {
  return !!value && !!(value as any).__v_isReactive
}

export function isReadonly(value: unknown): boolean {
  return !!value && !!(value as any).__v_isReadonly
}

export function isVNode(value: unknown): value is VNode {
  return !!value && (value as any).__v_isVNode === true
}

/** Mutate `target` so it has the same content as `value`, keeping the reference. */
export function replaceInPlace(
  target: Record<string, unknown>,
  value: Record<string, unknown>,
): void {
  for (const key of Object.keys(target)) {
    if (!(key in value)) delete target[key]
  }
  Object.assign(target, value)
}
