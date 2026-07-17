import { ref, type Ref } from 'vue'
import { envelopeDb } from '@/utils/audioViz'

export async function decodeEnvelope(url: string, blockMs = 10): Promise<Float32Array | null> {
  try {
    const buf = await (await fetch(url)).arrayBuffer()
    const ac = new AudioContext()
    try {
      const audio = await ac.decodeAudioData(buf)
      const mono = audio.getChannelData(0)
      return envelopeDb(mono, audio.sampleRate, blockMs)
    } finally {
      void ac.close()
    }
  } catch {
    return null
  }
}

export interface EnvelopePair {
  input: Float32Array
  output: Float32Array
}

export interface UseAudioEnvelopeOptions {
  inputUrl: Ref<string | null | undefined>
  outputUrl: Ref<string | null | undefined>
}

export function useAudioEnvelope(opts: UseAudioEnvelopeOptions) {
  const { inputUrl, outputUrl } = opts

  const hasHistory = ref(false)

  async function reload(): Promise<EnvelopePair | null> {
    hasHistory.value = false
    const inUrl = inputUrl.value
    const outUrl = outputUrl.value
    if (!inUrl || !outUrl) return null
    const [input, output] = await Promise.all([
      decodeEnvelope(inUrl),
      decodeEnvelope(outUrl),
    ])
    if (!input || !output) return null
    hasHistory.value = true
    return { input, output }
  }

  return { hasHistory, reload }
}
