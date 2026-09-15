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

function isObject(value: unknown): value is Record<string | number, unknown> {
  return typeof value === 'object' && value !== null
}

/** Mutate `target` at `path` (non-empty). Throws when a container on the path is missing. */
export function writeAtPath(target: unknown, path: StatePath, value: unknown): void {
  let parent: unknown = target
  for (const key of path.slice(0, -1)) {
    parent = isObject(parent) ? parent[key] : undefined
  }
  if (!isObject(parent)) throw new Error(`[medula] Path ${JSON.stringify(path)} not found`)
  parent[path[path.length - 1]!] = value
}

/** Replace the contents of an object or array in place, keeping its identity. */
export function replaceContents(target: object, value: unknown): void {
  if (Array.isArray(target)) {
    if (!Array.isArray(value)) throw new Error('[medula] Expected an array value')
    target.length = 0
    target.push(...value)
    return
  }
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error('[medula] Expected an object value')
  }
  const record = target as Record<string, unknown>
  for (const key of Object.keys(record)) if (!(key in value)) delete record[key]
  Object.assign(record, value)
}
