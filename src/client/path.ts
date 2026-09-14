export type StatePath = Array<string | number>

/**
 * Return a copy of `root` with `value` set at `path`. Missing containers are
 * created (arrays for numeric keys). An empty path returns `value`.
 */
export function setAtPath(root: unknown, path: StatePath, value: unknown): unknown {
  if (path.length === 0) return value
  const [key, ...rest] = path as [string | number, ...StatePath]
  const container =
    root != null && typeof root === 'object'
      ? Array.isArray(root)
        ? [...root]
        : { ...(root as Record<string, unknown>) }
      : typeof key === 'number'
        ? []
        : {}
  const current = (container as Record<string | number, unknown>)[key]
  ;(container as Record<string | number, unknown>)[key] = setAtPath(current, rest, value)
  return container
}

export function getAtPath(root: unknown, path: StatePath): unknown {
  let current = root
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string | number, unknown>)[key]
  }
  return current
}
