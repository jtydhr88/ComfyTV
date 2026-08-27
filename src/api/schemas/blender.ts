import { z } from 'zod'

export const BlenderStatusSchema = z
  .object({
    online: z.boolean(),
    blender_version: z.string().optional(),
    bridge_version: z.string().optional(),
    web_port: z.number().optional(),
  })
  .passthrough()

export type BlenderStatus = z.infer<typeof BlenderStatusSchema>

export const BlenderSceneTruthSchema = z
  .object({
    resolution_x: z.number(),
    resolution_y: z.number(),
    frame_start: z.number(),
    frame_end: z.number(),
    fps: z.number(),
    engine: z.string(),
    samples: z.number().nullable().optional(),
    active_camera: z.string().nullable().optional(),
  })
  .passthrough()

export const BlenderCamerasSchema = z
  .object({
    cameras: z.array(
      z.object({
        name: z.string(),
        active: z.boolean(),
        lens: z.number(),
      }).passthrough(),
    ),
    scene: BlenderSceneTruthSchema,
  })
  .passthrough()

export type BlenderCameras = z.infer<typeof BlenderCamerasSchema>
