import { apiFetch, apiSend } from './index'
import { BlenderCamerasSchema, BlenderStatusSchema } from './schemas/blender'
import type { BlenderCameras, BlenderStatus } from './schemas/blender'
import { z } from 'zod'

const AnySchema = z.object({}).passthrough()

export function fetchBlenderStatus(fresh = false): Promise<BlenderStatus> {
  return apiFetch(`/comfytv/blender/status${fresh ? '?fresh=1' : ''}`, BlenderStatusSchema)
}

export function fetchBlenderCameras(): Promise<BlenderCameras> {
  return apiFetch('/comfytv/blender/cameras', BlenderCamerasSchema)
}

export function addModelToScene(payloadUrl: string): Promise<Record<string, unknown>> {
  return apiSend('/comfytv/blender/scene/add', 'POST', AnySchema, { payload_url: payloadUrl })
}
