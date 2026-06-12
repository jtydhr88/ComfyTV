import type { ComfyApp, ComfyExtension } from '@comfyorg/comfyui-frontend-types'

// @ts-ignore - ComfyUI external module, not in node_modules
import { app as _rawApp } from '../../../scripts/app.js'

export const app = _rawApp as ComfyApp

export type LGraphNode = Parameters<NonNullable<ComfyExtension['nodeCreated']>>[0]
export type IBaseWidget = NonNullable<LGraphNode['widgets']>[number]

export interface DOMWidgetOptions {
  getMinHeight?: () => number
  hideOnZoom?: boolean
  serialize?: boolean
}

export interface ComfyNode extends LGraphNode {
  comfyClass: string
  onExecuted?: (msg: unknown) => void
  addDOMWidget(name: string, type: string, element: HTMLElement, options?: DOMWidgetOptions): IBaseWidget
}
