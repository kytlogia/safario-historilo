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
      if (value.length === 0) return []
      const filtered = value.filter(
        (item): item is T =>
          typeof item === 'string' && (allowed as readonly string[]).includes(item)
      )
      // An intentionally-persisted empty array is valid (handled above); but if
      // every entry in a *non-empty* stored array fails validation, that's not
      // "the user disabled everything" — it's corrupted/foreign data. Fail
      // closed like every other codec here rather than silently restoring [].
      return filtered.length === 0 ? undefined : filtered
    }
  }
}

// Restored freeform arrays (see freeformStringArrayCodec below) feed
// directly into network request fan-out (one /status and one download
// request per entry — see useUnifiedHistorySource.ts's queriedProfileIds).
// Cap how many entries a single restore can produce so a hand-edited or
// foreign localStorage value can't blow that fan-out up.
const FREEFORM_STRING_ARRAY_MAX_LENGTH = 50

/**
 * Like stringArrayCodec, but for arrays whose valid values aren't known
 * ahead of time (e.g. profile ids, which come from whatever profiles exist
 * on the machine rather than a fixed literal union) — accepts any array of
 * strings instead of checking membership in an `allowed` list.
 */
export const freeformStringArrayCodec: FilterPersistenceCodec<string[]> = {
  toStorage: (value) => value,
  fromStorage: (value) => {
    if (!Array.isArray(value)) return undefined
    if (value.length === 0) return []
    const filtered = [
      ...new Set(
        value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      )
    ].slice(0, FREEFORM_STRING_ARRAY_MAX_LENGTH)
    // Same fail-closed rule as stringArrayCodec: a non-empty stored array
    // that yields zero valid strings is corrupted/foreign data, not "the
    // user cleared their selection".
    return filtered.length === 0 ? undefined : filtered
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
    },
    // Some fields (e.g. enabledSources) hold an array/object ref that a
    // consumer can mutate in place (push/splice) rather than always
    // reassigning .value — a shallow watch misses those, so this needs to
    // traverse into the current values to catch them too.
    { deep: true }
  )
}
