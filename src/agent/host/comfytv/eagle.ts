import { reactive, ref } from 'vue'

import { fetchEagleStatus } from '../../../api/eagle'
import type { Asset } from '../../../api/schemas/asset'
import { EAGLE_DRAG_MIME } from '../../../composables/sidebar/assetCanvasDrop'
import { importEagleAsset } from '../../../composables/sidebar/useEagleImports'
import type { AgentAssetAttachment } from './assets'
import { ATTACHABLE_MEDIA, closeAssetPicker, toAttachment } from './assets'

interface EaglePickerHandlers {
  canPick?: () => boolean
  addedIds: () => number[]
  select: (asset: Asset) => void
  deselect: (asset: Asset) => void
}

const READABLE_MODES = ['api', 'disk']

export const eagleAvailable = ref(false)

let probing: Promise<void> | null = null

export function refreshEagleAvailability(): Promise<void> {
  probing ??= fetchEagleStatus()
    .then((status) => {
      eagleAvailable.value = status.enabled && READABLE_MODES.includes(status.mode)
    })
    .catch(() => {
      eagleAvailable.value = false
    })
    .finally(() => {
      probing = null
    })
  return probing
}

export const eaglePicker = reactive<{ open: boolean; handlers: EaglePickerHandlers | null }>({
  open: false,
  handlers: null,
})

export function openEaglePicker(handlers: EaglePickerHandlers): void {
  closeAssetPicker()
  void refreshEagleAvailability()
  eaglePicker.handlers = handlers
  eaglePicker.open = true
}

export function closeEaglePicker(): void {
  eaglePicker.open = false
  eaglePicker.handlers = null
}

export function isEagleDrag(dataTransfer: DataTransfer | null | undefined): boolean {
  return !!dataTransfer && [...dataTransfer.types].includes(EAGLE_DRAG_MIME)
}

export async function droppedEagleAssets(
  dataTransfer: DataTransfer,
): Promise<AgentAssetAttachment[]> {
  const itemId = dataTransfer.getData(EAGLE_DRAG_MIME)
  if (!itemId) return []
  const asset = await importEagleAsset(itemId)
  if (!ATTACHABLE_MEDIA.includes(asset.media_type)) return []
  return [toAttachment(asset)]
}
