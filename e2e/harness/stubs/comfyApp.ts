export const app: any = {
  api: {
    fetchApi: async () => ({ status: 200, json: async () => ({}) }),
  },
  extensionManager: { toast: { add: () => {} } },
  ui: { settings: { getSettingValue: () => 'zh' } },
}

export type LGraphNode = any
export type IBaseWidget = any

export interface DOMWidgetOptions {
  getMinHeight?: () => number
  hideOnZoom?: boolean
  serialize?: boolean
}

export interface ComfyNode {
  comfyClass: string
}
