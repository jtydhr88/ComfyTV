export interface CanvasPreset {
  id: string
  label: string
  width: number
  height: number
}

export interface CanvasPresetGroup {
  id: string
  labelKey: string
  presets: CanvasPreset[]
}

const preset = (id: string, label: string, width: number, height: number): CanvasPreset =>
  ({ id, label, width, height })

export const CANVAS_PRESET_GROUPS: CanvasPresetGroup[] = [
  {
    id: 'paper',
    labelKey: 'layerEditor.presetGroupPaper',
    presets: [
      preset('a4', 'A4 (300 ppi) · 2480×3508', 2480, 3508),
      preset('a5', 'A5 (300 ppi) · 1748×2480', 1748, 2480),
      preset('a6', 'A6 (300 ppi) · 1240×1748', 1240, 1748),
      preset('a7', 'A7 (300 ppi) · 874×1240', 874, 1240),
      preset('b5', 'B5 (300 ppi) · 2079×2953', 2079, 2953),
      preset('b5-japan', 'B5-Japan (300 ppi) · 2150×3035', 2150, 3035),
      preset('us-letter', 'US Letter (300 ppi) · 2550×3300', 2550, 3300),
    ],
  },
  {
    id: 'business-card',
    labelKey: 'layerEditor.presetGroupBusinessCard',
    presets: [
      preset('card-us', '88.9×50.8 US · 1050×600', 1050, 600),
      preset('card-we', '85×55 Western Europe · 1004×650', 1004, 650),
      preset('card-ee', '90×50 Eastern Europe · 1063×591', 1063, 591),
      preset('card-au', '90×55 AU / IN · 1063×650', 1063, 650),
    ],
  },
  {
    id: 'web',
    labelKey: 'layerEditor.presetGroupWeb',
    presets: [
      preset('web-avatar', 'Avatar / icon · 512×512', 512, 512),
      preset('web-leaderboard', 'Banner leaderboard · 728×90', 728, 90),
      preset('web-half-page', 'Banner half page · 300×600', 300, 600),
      preset('web-rectangle', 'Banner medium rectangle · 300×250', 300, 250),
      preset('web-skyscraper', 'Banner wide skyscraper · 160×600', 160, 600),
    ],
  },
  {
    id: 'display',
    labelKey: 'layerEditor.presetGroupDisplay',
    presets: [
      preset('xga', '4:3 · 1024×768 (XGA)', 1024, 768),
      preset('xga-plus', '4:3 · 1152×864 (XGA+)', 1152, 864),
      preset('uxga', '4:3 · 1600×1200 (UXGA)', 1600, 1200),
      preset('qxga', '4:3 · 2048×1536 (QXGA)', 2048, 1536),
      preset('wsxga-plus', '16:10 · 1680×1050 (WSXGA+)', 1680, 1050),
      preset('wuxga', '16:10 · 1920×1200 (WUXGA)', 1920, 1200),
      preset('wqxga', '16:10 · 2560×1600 (WQXGA)', 2560, 1600),
      preset('wquxga', '16:10 · 3840×2400 (WQUXGA)', 3840, 2400),
      preset('hd-720', '16:9 · 1280×720 (HD 720p)', 1280, 720),
      preset('full-hd', '16:9 · 1920×1080 (Full HD)', 1920, 1080),
      preset('uhd-4k', '16:9 · 3840×2160 (4K UHD)', 3840, 2160),
      preset('dci-2k', '17:9 · 2048×1080 (DCI 2K)', 2048, 1080),
      preset('dci-4k', '17:9 · 4096×2160 (DCI 4K)', 4096, 2160),
    ],
  },
  {
    id: 'phone',
    labelKey: 'layerEditor.presetGroupPhone',
    presets: [
      preset('phone-18-5-9', '18.5:9 · 1440×2960', 1440, 2960),
      preset('phone-19-9', '19:9 · 1440×3040', 1440, 3040),
      preset('phone-19-5-9', '19.5:9 · 1440×3120', 1440, 3120),
      preset('phone-20-9', '20:9 · 1440×3200', 1440, 3200),
    ],
  },
  {
    id: 'misc',
    labelKey: 'layerEditor.presetGroupMisc',
    presets: [
      preset('cd-cover', 'CD cover (300 ppi) · 1417×1417', 1417, 1417),
      preset('toilet-paper', 'Toilet paper (US) · 1350×1350', 1350, 1350),
    ],
  },
]

export function findCanvasPreset(id: string): CanvasPreset | null {
  for (const group of CANVAS_PRESET_GROUPS) {
    const hit = group.presets.find((p) => p.id === id)
    if (hit) return hit
  }
  return null
}
