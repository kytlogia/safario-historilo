import { onScopeDispose, ref, watch, type Ref } from 'vue'

/** Returns a ref that trails `source`, updating only after `delayMs` of quiet. */
export function useDebouncedRef<T>(source: Ref<T>, delayMs: number): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(source, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = value
    }, delayMs)
  })

  onScopeDispose(() => clearTimeout(timer))

  return debounced
}
