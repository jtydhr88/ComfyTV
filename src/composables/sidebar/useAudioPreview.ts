import { ref } from 'vue'

const playingUrl = ref<string | null>(null)
let player: HTMLAudioElement | null = null

function ensurePlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio()
    player.addEventListener('ended', () => { playingUrl.value = null })
    player.addEventListener('error', () => { playingUrl.value = null })
  }
  return player
}

export function useAudioPreview() {
  function toggle(url: string): void {
    if (!url) return
    const a = ensurePlayer()
    if (playingUrl.value === url) {
      a.pause()
      playingUrl.value = null
      return
    }
    a.src = url
    playingUrl.value = url
    void a.play().catch(() => {
      if (playingUrl.value === url) playingUrl.value = null
    })
  }

  function stop(): void {
    if (!player) return
    player.pause()
    playingUrl.value = null
  }

  return { playingUrl, toggle, stop }
}
