export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/**
 * Turn any value into JSON-safe data: Map -> object, Set -> array, Date ->
 * ISO string, BigInt -> string, functions/symbols/undefined -> null, cycles ->
 * "[Circular]".
 */
export function toJsonValue(value: unknown, seen: WeakSet<object> = new WeakSet()): JsonValue {
  return convert(value, seen) as JsonValue
}

function convert(value: unknown, seen: WeakSet<object>): unknown {
  if (value == null) return null
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value
    case 'number':
      return Number.isFinite(value) ? value : null
    case 'bigint':
      return value.toString()
    case 'function':
    case 'symbol':
    case 'undefined':
      return null
  }
  if (typeof value !== 'object') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => convert(item, seen))
    if (value instanceof Map) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of value) out[String(k)] = convert(v, seen)
      return out
    }
    if (value instanceof Set) return [...value].map((item) => convert(item, seen))
    if ('toJSON' in value && typeof value.toJSON === 'function') {
      return convert(value.toJSON(), seen)
    }
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
      out[key] = convert((value as Record<string, unknown>)[key], seen)
    }
    return out
  } finally {
    seen.delete(value)
  }
}

/** Short JSON preview for listings. */
export function previewJson(value: unknown, max = 200): string {
  const text = JSON.stringify(value) ?? 'null'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
