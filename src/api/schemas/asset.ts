import { z } from 'zod'

export const AssetCategorySchema = z.object({
  id:         z.number(),
  name:       z.string(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})
export type AssetCategory = z.infer<typeof AssetCategorySchema>
export const ListAssetCategoriesSchema = z.object({
  categories: z.array(AssetCategorySchema),
})
export const MutateAssetCategorySchema = z.object({
  ok: z.literal(true),
  category: AssetCategorySchema,
})
export const AssetSchema = z.object({
  id:          z.number(),
  category_ids: z.array(z.number()).default([]),
  name:        z.string(),
  media_type:  z.string(),
  payload_url: z.string(),
  mime_type:   z.string().nullable().optional(),
  width:       z.number().nullable().optional(),
  height:      z.number().nullable().optional(),
  size_bytes:  z.number().nullable().optional(),
  source:      z.string().nullable().optional(),
  metadata:    z.record(z.string(), z.unknown()).default({}),
  created_at:  z.string().nullable().optional(),
  updated_at:  z.string().nullable().optional(),
  file_missing: z.boolean().optional(),
})
export type Asset = z.infer<typeof AssetSchema>
export const ListAssetsSchema = z.object({
  assets: z.array(AssetSchema),
})
export const MutateAssetSchema = z.object({
  ok: z.literal(true),
  asset: AssetSchema,
})
export const DeleteAssetSchema = z.object({
  ok: z.literal(true),
})
export const AdoptAssetsSchema = z.object({
  ok: z.boolean(),
  adopted: z.number(),
  dir: z.string(),
})
export type AdoptAssetsResult = z.infer<typeof AdoptAssetsSchema>
