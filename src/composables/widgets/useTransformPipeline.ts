import { ref, watch, type Ref } from 'vue'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { app } from '@/lib/comfyApp'


export interface UseTransformPipelineOptions {
  sourceImageUrl: Ref<string | null>
  state: StageState
  nodeId: string | number
  compute: (img: HTMLImageElement) => HTMLCanvasElement | Promise<HTMLCanvasElement>
  filenamePrefix?: string
  subfolder?: string
  debounceMs?: number
}


export function useTransformPipeline(options: UseTransformPipelineOptions) {
  const {
    sourceImageUrl, state, nodeId, compute,
    filenamePrefix = 'comfytv-transform',
    subfolder = 'transformer',
    debounceMs = 200,
  } = options

  const store = useStageStore()
  const computing = ref(false)

  let timer: number | null = null
  let computeSeq = 0
  let cachedImg: HTMLImageElement | null = null
  let cachedUrl: string | null = null

  function getSourceImage(url: string): Promise<HTMLImageElement> {
    if (cachedImg && cachedUrl === url && cachedImg.complete) {
      return Promise.resolve(cachedImg)
    }
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { cachedImg = img; cachedUrl = url; resolve(img) }
      img.onerror = (e) => reject(e)
      img.src = url
    })
  }

  function requestRecompute() {
    if (timer != null) {
      window.clearTimeout(timer)
      timer = null
    }
    timer = window.setTimeout(() => {
      timer = null
      void run()
    }, debounceMs)
  }

  async function run() {
    const url = sourceImageUrl.value
    if (!url) return

    const mySeq = ++computeSeq
    computing.value = true
    try {
      const img = await getSourceImage(url)
      const canvas = await compute(img)
      if (!canvas || canvas.width <= 0 || canvas.height <= 0) return

      if (mySeq !== computeSeq) return

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      )
      if (!blob) throw new Error('toBlob returned null')
      if (mySeq !== computeSeq) return

      const filename = `${filenamePrefix}-${nodeId}-${Date.now()}.png`
      const body = new FormData()
      body.append('image', blob, filename)
      body.append('subfolder', subfolder)
      body.append('type', 'input')

      const resp = await (app as any).api.fetchApi('/upload/image', {
        method: 'POST', body,
      })
      if (resp.status !== 200) {
        throw new Error(`upload ${resp.status} ${resp.statusText}`)
      }
      const data = await resp.json() as { name?: string }
      if (!data?.name) throw new Error('upload returned no name')

      if (mySeq !== computeSeq) return

      const viewUrl = `/view?filename=${encodeURIComponent(data.name)}`
                    + `&subfolder=${encodeURIComponent(subfolder)}`
                    + `&type=input`
      store.applyExecutedPayload(state, { output: [viewUrl] })
    } catch (e) {
      console.error(`[ComfyTV/transform:${filenamePrefix}] compute failed`, e)
    } finally {
      if (mySeq === computeSeq) computing.value = false
    }
  }

  watch(sourceImageUrl, (url) => {
    if (url !== cachedUrl) {
      cachedImg = null
      cachedUrl = null
    }
  })

  return {
    computing,
    requestRecompute,
  }
}
