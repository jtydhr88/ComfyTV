export function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

export function playDrum(
  ctx: AudioContext,
  dest: AudioNode,
  midi: number,
  when: number,
  amp: number,
  noise: AudioBuffer,
): void {
  if (midi === 35 || midi === 36) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.setValueAtTime(120, when)
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12)
    g.gain.setValueAtTime(0.5 * amp, when)
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.15)
    osc.connect(g).connect(dest)
    osc.start(when)
    osc.stop(when + 0.16)
    return
  }
  const len = midi === 42 || midi === 44 ? 0.05
    : midi === 46 ? 0.25
    : midi === 49 || midi === 52 || midi === 55 || midi === 57 ? 0.6
    : midi === 51 || midi === 53 || midi === 59 ? 0.35
    : 0.12
  const src = ctx.createBufferSource()
  src.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value =
    midi === 38 || midi === 39 || midi === 40 ? 1200 : 4000
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.3 * amp, when)
  g.gain.exponentialRampToValueAtTime(0.001, when + len)
  src.connect(filter).connect(g).connect(dest)
  src.start(when)
  src.stop(when + len + 0.02)
}

export function playTone(
  ctx: AudioContext,
  dest: AudioNode,
  midi: number,
  on: number,
  off: number,
  amp: number,
  wave: OscillatorType,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = wave
  osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
  gain.gain.setValueAtTime(0.0001, on)
  gain.gain.exponentialRampToValueAtTime(amp, on + 0.01)
  gain.gain.setValueAtTime(amp, Math.max(on + 0.01, off - 0.04))
  gain.gain.exponentialRampToValueAtTime(0.0001, off)
  osc.connect(gain).connect(dest)
  osc.start(on)
  osc.stop(off + 0.02)
}
