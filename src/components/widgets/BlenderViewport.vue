<template>
  <canvas
    ref="canvasRef"
    tabindex="0"
    data-capture-wheel="true"
    class="ctv:absolute ctv:inset-0 ctv:w-full ctv:h-full ctv:outline-none"
    style="background: #1d1d1d"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ wsUrl: string }>()
const emit = defineEmits<{ status: [text: string] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let ws: WebSocket | null = null
let ctx: CanvasRenderingContext2D | null = null
let decoder: VideoDecoder | null = null
let frameTimestamp = 0
let lastSpsKey = ''
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let resizeDebounce: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null
let frames = 0
let lastFpsAt = Date.now()
let lastKeyframeNudge = 0
let destroyed = false

function send(obj: Record<string, unknown>) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
}

function mods(e: MouseEvent) {
  return { hasMods: true, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey,
           altKey: e.altKey, metaKey: e.metaKey }
}

function sendResize() {
  const canvas = canvasRef.value
  if (!canvas) return
  send({ type: 'resize', width: canvas.clientWidth, height: canvas.clientHeight })
}

function sendResizeDebounced() {
  if (resizeDebounce) clearTimeout(resizeDebounce)
  resizeDebounce = setTimeout(() => { resizeDebounce = null; sendResize() }, 300)
}

function tickFps() {
  frames++
  const now = Date.now()
  if (now - lastFpsAt >= 1000) {
    emit('status', `${frames} fps`)
    frames = 0
    lastFpsAt = now
  }
}

function drawVideoFrame(frame: VideoFrame) {
  const canvas = canvasRef.value
  if (!canvas || !ctx) { frame.close(); return }
  if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
    canvas.width = frame.displayWidth
    canvas.height = frame.displayHeight
  }
  ctx.drawImage(frame, 0, 0)
  frame.close()
  tickFps()
}

function initDecoder(): VideoDecoder | null {
  if (typeof VideoDecoder === 'undefined') { emit('status', 'no WebCodecs — JPEG only'); return null }
  try {
    return new VideoDecoder({
      output: drawVideoFrame,
      error: (e) => emit('status', `decode error: ${e.message}`),
    })
  } catch {
    return null
  }
}

function onFrame(data: ArrayBuffer) {
  if (data.byteLength < 2) return
  const bytes = new Uint8Array(data)
  const type = bytes[0]
  const payload = bytes.subarray(1)

  if (type !== 0x01 && type !== 0x02) {
    const blob = new Blob([payload], { type: 'image/jpeg' })
    void createImageBitmap(blob).then((bmp) => {
      const canvas = canvasRef.value
      if (!canvas || !ctx) { bmp.close(); return }
      if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
        canvas.width = bmp.width
        canvas.height = bmp.height
      }
      ctx.drawImage(bmp, 0, 0)
      bmp.close()
      tickFps()
    })
    return
  }

  const nalus: Uint8Array[] = []
  let sps: Uint8Array | null = null
  let pps: Uint8Array | null = null
  for (let j = 0; j < payload.byteLength - 3; ) {
    let scLen = 0
    if (j + 3 < payload.byteLength &&
        payload[j] === 0 && payload[j + 1] === 0 && payload[j + 2] === 0 && payload[j + 3] === 1) scLen = 4
    else if (payload[j] === 0 && payload[j + 1] === 0 && payload[j + 2] === 1) scLen = 3
    if (scLen === 0) { j++; continue }
    j += scLen
    const nalStart = j
    while (j < payload.byteLength - 3) {
      if ((payload[j] === 0 && payload[j + 1] === 0 && payload[j + 2] === 1) ||
          (payload[j] === 0 && payload[j + 1] === 0 && payload[j + 2] === 0 &&
           j + 3 < payload.byteLength && payload[j + 3] === 1)) break
      j++
    }
    if (j >= payload.byteLength - 3) j = payload.byteLength
    const nal = payload.subarray(nalStart, j)
    nalus.push(nal)
    const nalType = nal[0] & 0x1f
    if (nalType === 7) sps = nal
    if (nalType === 8) pps = nal
  }

  if (!decoder || decoder.state === 'closed') decoder = initDecoder()
  if (!decoder) return

  if (type === 0x01 && sps && pps) {
    const spsKey = Array.from(sps.slice(0, 8)).join(',')
    let needsConfigure = decoder.state === 'unconfigured'
    if (decoder.state === 'configured' && lastSpsKey && spsKey !== lastSpsKey) {
      decoder.reset()
      needsConfigure = true
    }
    lastSpsKey = spsKey
    if (needsConfigure) {
      const desc = new Uint8Array(11 + sps.byteLength + pps.byteLength)
      desc[0] = 1
      desc[1] = sps[1]
      desc[2] = sps[2]
      desc[3] = sps[3]
      desc[4] = 0xff
      desc[5] = 0xe1
      desc[6] = (sps.byteLength >> 8) & 0xff
      desc[7] = sps.byteLength & 0xff
      desc.set(sps, 8)
      const off = 8 + sps.byteLength
      desc[off] = 1
      desc[off + 1] = (pps.byteLength >> 8) & 0xff
      desc[off + 2] = pps.byteLength & 0xff
      desc.set(pps, off + 3)
      const codec = 'avc1.' +
        sps[1].toString(16).padStart(2, '0') +
        sps[2].toString(16).padStart(2, '0') +
        sps[3].toString(16).padStart(2, '0')
      try {
        decoder.configure({
          codec,
          description: desc.buffer as ArrayBuffer,
          hardwareAcceleration: 'prefer-hardware',
          optimizeForLatency: true,
        })
        emit('status', `H264 ${codec}`)
      } catch (e) {
        emit('status', `configure failed: ${(e as Error).message}`)
        return
      }
    }
  }

  if (decoder.state !== 'configured' || nalus.length === 0) {
    if (type === 0x02 && decoder.state !== 'configured' &&
        Date.now() - lastKeyframeNudge > 2000) {
      lastKeyframeNudge = Date.now()
      sendResize()
    }
    return
  }
  let totalLen = 0
  for (const nal of nalus) {
    const nt = nal[0] & 0x1f
    if (nt !== 7 && nt !== 8) totalLen += 4 + nal.byteLength
  }
  const avcc = new Uint8Array(totalLen)
  let pos = 0
  for (const nal of nalus) {
    const nt = nal[0] & 0x1f
    if (nt === 7 || nt === 8) continue
    const len = nal.byteLength
    avcc[pos] = (len >> 24) & 0xff
    avcc[pos + 1] = (len >> 16) & 0xff
    avcc[pos + 2] = (len >> 8) & 0xff
    avcc[pos + 3] = len & 0xff
    avcc.set(nal, pos + 4)
    pos += 4 + len
  }
  try {
    decoder.decode(new EncodedVideoChunk({
      type: type === 0x01 ? 'key' : 'delta',
      timestamp: frameTimestamp,
      data: avcc,
    }))
    frameTimestamp += 16667
  } catch (e) {
    emit('status', `decode failed: ${(e as Error).message}`)
  }
}

function connect() {
  if (destroyed) return
  if (ws) { try { ws.close() } catch {} }
  try {
    ws = new WebSocket(props.wsUrl)
  } catch {
    scheduleReconnect()
    return
  }
  ws.binaryType = 'arraybuffer'
  ws.onopen = () => {
    emit('status', 'connected')
    frameTimestamp = 0
    lastSpsKey = ''
    decoder = initDecoder()
    sendResize()
    send({ type: 'mousemove', x: 1, y: 1 })
  }
  ws.onclose = () => {
    emit('status', 'disconnected — reconnecting')
    if (decoder) { try { decoder.close() } catch {} decoder = null }
    scheduleReconnect()
  }
  ws.onerror = () => { try { ws?.close() } catch {} }
  ws.onmessage = (evt) => {
    if (evt.data instanceof ArrayBuffer) onFrame(evt.data)
  }
}

function scheduleReconnect() {
  if (reconnectTimer || destroyed) return
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect() }, 2000)
}

function bindInput(canvas: HTMLCanvasElement) {
  const stop = (e: Event) => { e.preventDefault(); e.stopPropagation() }

  canvas.addEventListener('mousemove', (e) => {
    send({ type: 'mousemove', x: e.offsetX, y: e.offsetY, ...mods(e) })
  }, true)
  canvas.addEventListener('mousedown', (e) => {
    stop(e)
    canvas.focus()
    send({ type: 'mousedown', button: e.button, x: e.offsetX, y: e.offsetY, ...mods(e) })
  }, true)
  canvas.addEventListener('mouseup', (e) => {
    stop(e)
    send({ type: 'mouseup', button: e.button, x: e.offsetX, y: e.offsetY, ...mods(e) })
  }, true)
  canvas.addEventListener('contextmenu', (e) => stop(e), true)

  canvas.addEventListener('pointerdown', (e) => {
    e.stopPropagation()
    canvas.setPointerCapture(e.pointerId)
  }, true)
  canvas.addEventListener('pointermove', (e) => e.stopPropagation(), true)
  canvas.addEventListener('pointerup', (e) => {
    e.stopPropagation()
    canvas.releasePointerCapture(e.pointerId)
  }, true)

  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || e.key === 'Escape') return
    stop(e)
    send({ type: 'keydown', key: e.key, code: e.code, repeat: e.repeat,
           shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey })
  })
  canvas.addEventListener('keyup', (e) => {
    stop(e)
    send({ type: 'keyup', key: e.key, code: e.code, repeat: false,
           shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey })
  })
}

function onWindowPointer(e: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas || e.target !== canvas) return
  const middle = e.type === 'pointermove' ? (e.buttons & 4) !== 0 : e.button === 1
  if (!middle) return
  e.stopPropagation()
  if (e.type === 'pointerdown') canvas.setPointerCapture(e.pointerId)
  if (e.type === 'pointerup') {
    try { canvas.releasePointerCapture(e.pointerId) } catch {}
  }
}

function onWindowWheel(e: WheelEvent) {
  const canvas = canvasRef.value
  if (!canvas || e.target !== canvas) return
  e.preventDefault()
  e.stopPropagation()
  const r = canvas.getBoundingClientRect()
  const x = Math.round((e.clientX - r.x) * (canvas.clientWidth / r.width))
  const y = Math.round((e.clientY - r.y) * (canvas.clientHeight / r.height))
  send({ type: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY, x, y, ...mods(e) })
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  bindInput(canvas)
  for (const type of ['pointerdown', 'pointermove', 'pointerup'] as const) {
    window.addEventListener(type, onWindowPointer, true)
  }
  window.addEventListener('wheel', onWindowWheel, { capture: true, passive: false })
  resizeObserver = new ResizeObserver(() => sendResizeDebounced())
  resizeObserver.observe(canvas)
  connect()
})

onBeforeUnmount(() => {
  destroyed = true
  for (const type of ['pointerdown', 'pointermove', 'pointerup'] as const) {
    window.removeEventListener(type, onWindowPointer, true)
  }
  window.removeEventListener('wheel', onWindowWheel, true)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (resizeDebounce) clearTimeout(resizeDebounce)
  resizeObserver?.disconnect()
  if (decoder) { try { decoder.close() } catch {} }
  if (ws) { try { ws.close() } catch {} }
})

watch(() => props.wsUrl, () => connect())
</script>
