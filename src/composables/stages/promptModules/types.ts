export type ModuleKind =
  | 'tag'
  | 'snippet'
  | 'template'
  | 'builder'

export type ApplyMode =
  | 'toggle'
  | 'wrap'
  | 'append'
  | 'prepend'
  | 'insert'
  | 'replace'

export type ResolveAt =
  | 'edit'
  | 'run'

export type ModuleSurface =
  | 'mention'
  | 'panel'
  | 'builder'

export interface ModuleParamOption {
  labelKey?: string
  label?: string
  value: string
}

export interface ModuleParam {
  id: string
  labelKey?: string
  label?: string
  options: ModuleParamOption[]
}

export interface PromptModule {
  id: string
  source: 'builtin' | 'user'
  kind: ModuleKind
  labelKey?: string
  label?: string
  body: string
  apply: ApplyMode
  resolveAt: ResolveAt
  surfaces: ModuleSurface[]
  group?: string
  separator?: string
  params?: ModuleParam[]
  order?: number
}
