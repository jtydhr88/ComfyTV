import {
  APERTURES,
  CAMERAS,
  FOCAL_LENGTHS,
  LENSES,
  composeCamera,
} from '../cameraControlCatalog'
import type { ModuleParamOption, PromptModule } from './types'

const NONE: ModuleParamOption = { label: '—', value: '' }

export const CAMERA_BUILDER: PromptModule = {
  id: 'builder:camera',
  source: 'builtin',
  kind: 'builder',
  labelKey: 'cameraPrompt.open',
  body: '',
  apply: 'append',
  resolveAt: 'edit',
  surfaces: ['builder'],
  params: [
    { id: 'camera', labelKey: 'cameraPrompt.camera', options: [NONE, ...CAMERAS.map(c => ({ label: c.label, value: c.label }))] },
    { id: 'lens', labelKey: 'cameraPrompt.lens', options: [NONE, ...LENSES.map(l => ({ label: l.label, value: l.label }))] },
    { id: 'focal', labelKey: 'cameraPrompt.focal', options: [NONE, ...FOCAL_LENGTHS.map(f => ({ label: f.label, value: String(f.mm) }))] },
    { id: 'aperture', labelKey: 'cameraPrompt.aperture', options: [NONE, ...APERTURES.map(a => ({ label: a.label, value: a.f }))] },
  ],
}

export const BUILDER_COMPOSERS: Record<string, (params: Record<string, string>) => string> = {
  [CAMERA_BUILDER.id]: params => composeCamera(params),
}
