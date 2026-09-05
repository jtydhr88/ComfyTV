import { z } from 'zod'

export const FxClipPreviewSchema = z.object({
  url: z.string(),
  t0: z.number(),
  t1: z.number(),
})
export type FxClipPreviewResult = z.infer<typeof FxClipPreviewSchema>
export const ExpressionEvalSchema = z.object({
  samples: z.array(z.tuple([z.number(), z.number()])),
})
export type ExpressionEvalResult = z.infer<typeof ExpressionEvalSchema>
export const ScoreEditorImportSchema = z.object({
  tempo: z.number(),
  beats_per_bar: z.number(),
  beat_type: z.number(),
  parts: z.array(z.object({
    name: z.string(),
    percussion: z.boolean().optional(),
    program: z.string().optional(),
    notes: z.array(z.object({
      midi: z.number(), start: z.number(), dur: z.number(),
      vel: z.number().optional(),
    })),
  })),
  skipped_percussion: z.number().optional(),
})
export type ScoreEditorImport = z.infer<typeof ScoreEditorImportSchema>
export const ProxyEnsureSchema = z.object({
  status: z.enum(['original', 'candidate', 'pending', 'running', 'ready', 'failed']),
  proxy_url: z.string().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  pct: z.number().optional(),
  error: z.string().optional(),
})
export type ProxyEnsureResult = z.infer<typeof ProxyEnsureSchema>
export const MidiEnsureSchema = z.object({
  status: z.enum(['original', 'ready']),
  url: z.string().optional(),
})
export type MidiEnsureResult = z.infer<typeof MidiEnsureSchema>
export const MidiNoteSchema = z.object({
  t: z.number(),
  dur: z.number(),
  midi: z.number(),
  vel: z.number(),
  ch: z.number(),
})
export type MidiNote = z.infer<typeof MidiNoteSchema>
export const MidiEventsSchema = z.object({
  status: z.enum(['original', 'ready']),
  events: z.array(MidiNoteSchema).optional(),
  programs: z.record(z.string(), z.number()).optional(),
  tempo_map: z.array(z.record(z.string(), z.number())).optional(),
  duration: z.number().optional(),
})
export type MidiEventsResult = z.infer<typeof MidiEventsSchema>
export const MediaInfoSchema = z.object({
  kind: z.enum(['image', 'video', 'audio', 'model', 'other']),
  format: z.string(),
  size_bytes: z.number(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  duration_s: z.number().nullable().optional(),
  fps: z.number().nullable().optional(),
  has_audio: z.boolean().nullable().optional(),
  sample_rate: z.number().nullable().optional(),
  channels: z.number().nullable().optional(),
  codec: z.string().nullable().optional(),
  frames: z.number().nullable().optional(),
})
export type MediaInfo = z.infer<typeof MediaInfoSchema>
