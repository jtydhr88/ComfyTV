import { ref } from 'vue'

export function wrapIndex(current: number, count: number, delta: number): number {
  if (count <= 0) return 0
  return ((current + delta) % count + count) % count
}

export function useListKeyboardNav(count: () => number) {
  const activeIndex = ref(0)

  function moveUp() {
    activeIndex.value = wrapIndex(activeIndex.value, count(), -1)
  }

  function moveDown() {
    activeIndex.value = wrapIndex(activeIndex.value, count(), 1)
  }

  function reset() {
    activeIndex.value = 0
  }

  function onKeyDown(event: KeyboardEvent, onSelect: (index: number) => void): boolean {
    switch (event.key) {
      case 'ArrowUp':   moveUp();   return true
      case 'ArrowDown': moveDown(); return true
      case 'Enter':
      case 'Tab':       onSelect(activeIndex.value); return true
      case 'Escape':    return true
      default:          return false
    }
  }

  return { activeIndex, moveUp, moveDown, reset, onKeyDown }
}
