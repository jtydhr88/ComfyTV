import { h, watch } from 'vue'

import MainPromptInput from '@/components/stages/MainPromptInput.vue'
import StagePresetBar from '@/components/stages/StagePresetBar.vue'
import { useStageNode } from '@/composables/stages/useStageNode'
import { t } from '@/i18n'
import { type ComfyNode } from '@/lib/comfyApp'
import CustomParamsV2 from '@/v2/CustomParamsV2.vue'
import FooterSelectsV2, { type FooterExtra } from '@/v2/FooterSelectsV2.vue'
import { createIslandGroup } from '@/v2/islands'
import {
  bindNodeDrag,
  bindProgressRing,
  bindPromptResize,
  bindShellChrome,
  createNodeScope,
  ensureMinSize,
  ICON_GRIP,
  installV2ShellCss,
  RUN_BUTTON_HTML,
} from '@/v2/imageStageV2'
import MediaCornerV2 from '@/v2/MediaCornerV2.vue'
import MediaPreviewV2 from '@/v2/MediaPreviewV2.vue'
import ParamsPanelV2 from '@/v2/ParamsPanelV2.vue'
import RefChipsV2 from '@/v2/RefChipsV2.vue'
import { V2_SHELLS } from '@/v2/registry'
import ServerSelectV2 from '@/v2/ServerSelectV2.vue'
import StageControlsV2, { type ControlSpec } from '@/v2/StageControlsV2.vue'
import type { StageKind, StageVariant } from '@/stores/stageStore'

const KIND_ICONS: Record<string, string> = {
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5.2-5.2 3.4 3.4 3.2-3.2L21 18"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.5l5 2.5-5 2.5z"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 8v8"/></svg>`,
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>`,
  model: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7.5 4.3v8.4L12 20l-7.5-4.3V7.3z"/><path d="M12 3v8.5M4.5 7.3l7.5 4.2 7.5-4.2" opacity=".6"/></svg>`,
}

interface GeneratorConfig {
  preview: 'image' | 'video' | 'audio' | 'text' | 'model'
  linkKind?: string | null
  refTypes?: string[]
  corner?: boolean
  footerExtra?: FooterExtra[]
  controls?: ControlSpec[]
}

const FOOTER_AUTO = ['aspect_ratio', 'resolution', 'batch_size']

function el(tag: string, cls: string, html?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

function makeGeneratorShell(config: GeneratorConfig) {
  return function attach(node: ComfyNode, kind: StageKind, variant: StageVariant) {
    installV2ShellCss()
    const anyNode = node as any
    const icon = KIND_ICONS[config.preview] ?? KIND_ICONS.image
    const title = String((node.constructor as any)?.title ?? node.comfyClass ?? '')

    const card = el('div', 'v2-card')
    const handle = el('div', 'v2-label v2-handle', `${ICON_GRIP}${icon}<span>${title}</span>`)
    card.appendChild(handle)
    bindNodeDrag(node, handle)

    const preview = el('div', 'v2-preview v2-preview--single')
    const mediaAnchor = el('div', 'v2-mp-host')
    mediaAnchor.style.cssText = 'position:absolute;inset:0;'
    const busy = el('div', 'v2-preview__busy',
      `<div class="v2-preview__spinner"></div><div class="v2-preview__busytext"><span></span><small></small></div>`)
    const cornerAnchor = el('div', 'v2-corner-host')
    preview.append(mediaAnchor, busy, cornerAnchor)

    const panel = el('div', 'v2-panel')
    const refsAnchor = el('div', 'v2-panel__refs')
    const promptAnchor = el('div', 'v2-panel__prompthost')
    const presetAnchor = el('div', 'v2-panel__presets')
    const controlsAnchor = el('div', 'v2-panel__controls')
    const customAnchor = el('div', 'v2-panel__custom')
    const paramsAnchor = el('div', 'v2-panel__params')
    const footer = el('div', 'v2-panel__footer')
    const wfAnchor = el('div', 'v2-panel__selects')
    const serverAnchor = el('div', 'v2-panel__server')
    const run = el('button', 'v2-run', RUN_BUTTON_HTML) as HTMLButtonElement
    footer.append(wfAnchor, serverAnchor, run)
    panel.append(refsAnchor, promptAnchor, presetAnchor, controlsAnchor, customAnchor, paramsAnchor, footer)
    card.append(preview, panel)

    node.addDOMWidget('v2_shell', 'v2', card, {
      getMinHeight: () => 420,
      hideOnZoom: false,
      serialize: false,
    })

    ensureMinSize(node, 320, 460)

    const stageApi = useStageNode(node as any, kind, variant)
    const { state: stageState, onRunRequest, onCancelRequest, onAction } = stageApi
    const scope = createNodeScope(node)
    scope.run(() => bindProgressRing(card, stageState))

    const islands = createIslandGroup()
    const mountApps = () => {
      islands.unmountAll()
      const hint = t('v2.generatorHint')
      const promoted = [
        ...FOOTER_AUTO,
        ...(config.footerExtra ?? []).map(x => x.name),
        ...(config.controls ?? []).map(c => c.name),
      ]
      const specs: Array<[unknown, Record<string, unknown> | null, HTMLElement]> = [
        [{
          render: () => h(MediaPreviewV2, {
            kind: config.preview,
            url: config.preview === 'text' ? null : stageState.output,
            text: config.preview === 'text' ? stageState.output : null,
            hint,
          }),
        }, null, mediaAnchor],
        [MainPromptInput, { node }, promptAnchor],
        [StagePresetBar, { node }, presetAnchor],
        [CustomParamsV2, { node, state: stageState }, customAnchor],
        [ParamsPanelV2, { getNode: () => node, exclude: promoted }, paramsAnchor],
        [FooterSelectsV2, {
          getNode: () => node,
          linkKind: config.linkKind ?? null,
          extra: config.footerExtra ?? [],
        }, wfAnchor],
        [ServerSelectV2, { getNode: () => node, state: stageState }, serverAnchor],
      ]
      if (config.controls?.length) {
        specs.push([StageControlsV2, { getNode: () => node, controls: config.controls }, controlsAnchor])
      }
      if (config.refTypes?.length) {
        specs.push([RefChipsV2, { getNode: () => node, types: config.refTypes }, refsAnchor])
      }
      if (config.corner) {
        specs.push([MediaCornerV2, { state: stageState, source: 'batch', onAction }, cornerAnchor])
      }
      for (const [comp, props, anchor] of specs) {
        islands.mount(anchor, comp as any, props ?? {})
      }
    }
    mountApps()

    const prevConfigure = anyNode.onConfigure
    anyNode.onConfigure = function (...args: unknown[]) {
      prevConfigure?.apply(this, args)
      queueMicrotask(mountApps)
    }

    const busyPct = busy.querySelector('.v2-preview__busytext span') as HTMLElement
    const busyLabel = busy.querySelector('.v2-preview__busytext small') as HTMLElement
    scope.run(() => {
      watch(
        () => [stageState.running, stageState.progress?.value, stageState.progress?.max, stageState.progress?.text] as const,
        ([running, v, m, text]) => {
          run.dataset.busy = running ? '1' : ''
          busy.dataset.show = running ? '1' : ''
          const max = Number(m) || 0
          const p = running && max > 0 ? Math.min(1, Math.max(0, (Number(v) || 0) / max)) : 0
          busyPct.textContent = p > 0 ? `${Math.round(p * 100)}%` : ''
          busyLabel.textContent = running && text ? String(text) : ''
        },
        { immediate: true },
      )
    })

    run.addEventListener('pointerdown', (e) => e.stopPropagation())
    run.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (stageState.running) void onCancelRequest()
      else void onRunRequest()
    })

    bindNodeDrag(node, preview)
    bindShellChrome(node, { scope, card, socketAnchor: preview, state: stageState })
    bindPromptResize(node, promptAnchor, scope)

    const prevRemoved = anyNode.onRemoved
    anyNode.onRemoved = function (...args: unknown[]) {
      islands.unmountAll()
      prevRemoved?.apply(this, args)
    }

    return stageApi
  }
}

const GENERATORS: Record<string, GeneratorConfig> = {
  'ComfyTV.TextStage':             { preview: 'text',  linkKind: 'text' },
  'ComfyTV.SubtitleGenStage':      { preview: 'text',  linkKind: 'speech-to-text' },
  'ComfyTV.UpscaleStage':          {
    preview: 'image', linkKind: 'upscale', corner: true,
    footerExtra: [{ name: 'scale' }],
  },
  'ComfyTV.ImageEditStage':        { preview: 'image', linkKind: 'image-edit', corner: true },
  'ComfyTV.CutoutStage':           { preview: 'image', linkKind: 'cutout', corner: true },
  'ComfyTV.VideoStage':            {
    preview: 'video', linkKind: 'video', refTypes: ['image', 'video', 'audio'],
    controls: [
      { name: 'duration_s', control: 'slider', labelKey: 'v2.ctl.duration' },
      { name: 'generate_audio', control: 'toggle', labelKey: 'v2.ctl.generateAudio' },
    ],
  },
  'ComfyTV.VideoUpscaleStage':     {
    preview: 'video', linkKind: 'upscale',
    footerExtra: [{ name: 'scale' }],
  },
  'ComfyTV.AudioStage':            {
    preview: 'audio', linkKind: 'audio',
    controls: [
      { name: 'lyrics', control: 'textarea', labelKey: 'v2.ctl.lyrics', wide: true },
      { name: 'duration_s', control: 'slider', labelKey: 'v2.ctl.duration' },
      { name: 'bpm', control: 'number', labelKey: 'v2.ctl.bpm' },
      { name: 'timesignature', control: 'select', labelKey: 'v2.ctl.timeSignature' },
      { name: 'keyscale', control: 'select', labelKey: 'v2.ctl.keyScale' },
      { name: 'language', control: 'select', labelKey: 'v2.ctl.language' },
    ],
  },
  'ComfyTV.SpeechStage':           {
    preview: 'audio', linkKind: 'speech',
    controls: [
      { name: 'voice', control: 'text', labelKey: 'v2.ctl.voice' },
      { name: 'language', control: 'select', labelKey: 'v2.ctl.language' },
      { name: 'speed', control: 'slider', labelKey: 'v2.ctl.speed', wide: true },
      { name: 'reference_text', control: 'textarea', labelKey: 'v2.ctl.referenceText', wide: true },
    ],
  },
  'ComfyTV.AudioExtractVocalStage': { preview: 'audio', linkKind: 'audio-vocal' },
  'ComfyTV.AudioExtractBgStage':   { preview: 'audio', linkKind: 'audio-bg' },
  'ComfyTV.Model3DStage':          { preview: 'model', linkKind: 'model' },
  'ComfyTV.TimelineVideoStage':    { preview: 'video', linkKind: 'timeline' },
}

for (const [cls, config] of Object.entries(GENERATORS)) {
  V2_SHELLS[cls] = makeGeneratorShell(config)
}
