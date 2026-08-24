import { watch, type Ref } from 'vue'

export interface FilterPersistenceCodec<T> {
  toStorage: (value: T) => unknown
  fromStorage: (value: unknown) => T | undefined
}

export const stringCodec: FilterPersistenceCodec<string> = {
  toStorage: (value) => value,
  fromStorage: (value) => (typeof value === 'string' ? value : undefined)
}

export const nullableStringCodec: FilterPersistenceCodec<string | null> = {
  toStorage: (value) => value,
  fromStorage: (value) => (typeof value === 'string' || value === null ? value : undefined)
}

export const booleanCodec: FilterPersistenceCodec<boolean> = {
  toStorage: (value) => value,
  fromStorage: (value) => (typeof value === 'boolean' ? value : undefined)
}

export const nullableDateCodec: FilterPersistenceCodec<Date | null> = {
  toStorage: (value) => (value === null ? null : value.toISOString()),
  fromStorage: (value) => {
    if (value === null) return null
    if (typeof value !== 'string') return undefined
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
}

export function stringArrayCodec<T extends string>(
  allowed: readonly T[]
): FilterPersistenceCodec<T[]> {
  return {
    toStorage: (value) => value,
    fromStorage: (value) => {
      if (!Array.isArray(value)) return undefined
      return value.filter(
        (item): item is T =>
          typeof item === 'string' && (allowed as readonly string[]).includes(item)
      )
    }
  }
}

interface FilterPersistenceField {
  get: () => unknown
  set: (value: unknown) => void
  toStorage: (value: unknown) => unknown
  fromStorage: (value: unknown) => unknown
}

/**
 * Pairs a ref with its codec into the type-erased shape useFilterPersistence
 * works with internally. The `as T` casts below are safe: T is fixed by the
 * `ref`/`codec` arguments at the call site, so `get`/`set` only ever move
 * values of that same T through the erased `unknown` boundary — this is what
 * lets a single Record<string, FilterPersistenceField> hold fields of
 * different, mutually-incompatible T without resorting to `any`.
 */
export function filterField<T>(
  ref: Ref<T>,
  codec: FilterPersistenceCodec<T>
): FilterPersistenceField {
  return {
    get: () => ref.value,
    set: (value) => {
      ref.value = value as T
    },
    toStorage: (value) => codec.toStorage(value as T),
    fromStorage: (value) => codec.fromStorage(value)
  }
}

/**
 * Restores `fields` from localStorage under `storageKey` (if present and
 * valid) and keeps them persisted from then on. Each field fails closed:
 * a missing key, corrupted JSON, or a value that doesn't pass its codec's
 * runtime check leaves that ref at its caller-supplied default instead of
 * throwing or applying a mismatched value — same tolerance useAppTheme.ts
 * applies to its own localStorage read/write.
 *
 * Must be called synchronously during a component's setup (its `watch` call
 * relies on the surrounding effect scope for cleanup on unmount) and before
 * any derived state — e.g. useDebouncedRef(search, ...) — reads the
 * restored ref's initial value, or that derived state will briefly lag
 * behind the restored value.
 */
export function useFilterPersistence(
  storageKey: string,
  fields: Record<string, FilterPersistenceField>
) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        for (const [key, field] of Object.entries(fields)) {
          if (!(key in parsed)) continue
          const value = field.fromStorage((parsed as Record<string, unknown>)[key])
          if (value !== undefined) field.set(value)
        }
      }
    }
  } catch {
    // Ignore corrupted/inaccessible storage (private mode, quota, hand-edited
    // JSON) — filters simply start from their defaults.
  }

  watch(
    Object.values(fields).map((field) => () => field.get()),
    () => {
      try {
        const out: Record<string, unknown> = {}
        for (const [key, field] of Object.entries(fields)) {
          out[key] = field.toStorage(field.get())
        }
        localStorage.setItem(storageKey, JSON.stringify(out))
      } catch {
        // Ignore write failures — filters still apply for this session, just
        // aren't persisted.
      }
    }
  )
}
