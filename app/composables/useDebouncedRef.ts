import { computed, onScopeDispose, shallowRef, watch, type ComputedRef, type Ref } from 'vue'

export interface DebouncedRef<T> {
  /** Trails `source`, updating only after `delayMs` of quiet. Read-only — use `reset` to force a value. */
  debounced: ComputedRef<T>
  /** Cancels any pending update and immediately syncs to `value` (defaults to the current `source.value`). */
  reset: (value?: T) => void
}

export function useDebouncedRef<T>(source: Ref<T>, delayMs: number): DebouncedRef<T> {
  const internal = shallowRef<T>(source.value)
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      internal.value = value
    }, delayMs)
  })

  onScopeDispose(() => clearTimeout(timer))

  function reset(value: T = source.value) {
    clearTimeout(timer)
    timer = undefined
    internal.value = value
  }

  return { debounced: computed(() => internal.value), reset }
}
