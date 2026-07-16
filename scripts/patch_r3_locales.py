import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'PIKStage':           ('PIK Keyer', 'PIK 抠像'),
    'KeyerStage':         ('Keyer', '通用键控'),
    'DespillStage':       ('Despill', '去溢色'),
    'ColorSuppressStage': ('Color Suppress', '压色'),
    'KeyMixStage':        ('Key Mix', '遮罩合成'),
    'MatteMonitorStage':  ('Matte Monitor', '遮罩质检'),
    'MatteMorphStage':    ('Matte Morphology', '遮罩形态学'),
    'FrameBlendStage':    ('Frame Blend', '帧混合'),
    'ColorFXStage':       ('Color FX', '调色扩展'),
    'KenBurnsStage':      ('Ken Burns', '静帧推拉'),
    'OldFilmStage':       ('Old Film', '老电影'),
    'AnnotateStage':      ('Annotate', '标注'),
    'AudioReactiveStage': ('Audio Reactive', '音频反应'),
    'AudioMeterStage':    ('Audio Meter Overlay', '电平表叠加'),
}

PRESETS_EN = {
    'pik-keyer':     ('PIK Keyer', 'Image-based greenscreen keying with a clean plate'),
    'keyer':         ('Keyer', 'Luma / color / screen keyer with soft ramps'),
    'despill':       ('Despill', 'Remove green/blue spill from keyed footage'),
    'color-suppress': ('Color Suppress', 'Suppress a color channel or its complement'),
    'key-mix':       ('Key Mix', 'A over B through an external mask'),
    'matte-monitor': ('Matte Monitor', 'Stretch semi-transparent alpha for QC'),
    'matte-morph':   ('Matte Morphology', 'Erode / dilate / open / close a matte'),
    'frame-blend':   ('Frame Blend', 'Blend frame windows or shutter samples'),
    'color-fx':      ('Color FX', 'Selective color, chroma shift, pseudocolor, quantize'),
    'ken-burns':     ('Ken Burns', 'Animated zoom & pan over a still image'),
    'old-film':      ('Old Film', 'Jitter, flicker and scratch lines'),
    'annotate':      ('Annotate', 'Boxes, grids, border fills and scrolling'),
    'audio-reactive': ('Audio Reactive', 'Band energy envelope → keyframe curves'),
    'audio-meter':   ('Audio Meter', 'Burn a live volume meter onto the video'),
}
PRESETS_ZH = {
    'pik-keyer':     ('PIK 抠像', '基于 clean plate 的图像抠像（IBK 思路）'),
    'keyer':         ('通用键控', '亮度/颜色/屏幕三模式 + 软边包络'),
    'despill':       ('去溢色', '清除绿幕/蓝幕反射溢色'),
    'color-suppress': ('压色', '按 R/G/B/C/M/Y 通道压制颜色并可出遮罩'),
    'key-mix':       ('遮罩合成', '用外部遮罩把 A 合到 B 上'),
    'matte-monitor': ('遮罩质检', '把半透明 alpha 拉向 0.5 便于检查'),
    'matte-morph':   ('遮罩形态学', '腐蚀/膨胀/开/闭运算收拾遮罩边缘'),
    'frame-blend':   ('帧混合', '帧窗口混合或快门采样运动模糊'),
    'color-fx':      ('调色扩展', '九区二级调色/色差错位/伪彩/色彩量化'),
    'ken-burns':     ('静帧推拉', '静态图片的动画缩放平移'),
    'old-film':      ('老电影', '竖移抖动 + 亮度闪烁 + 随机划痕'),
    'annotate':      ('标注', '画框/网格/补边/无限滚动'),
    'audio-reactive': ('音频反应', '频段能量包络 → 关键帧曲线'),
    'audio-meter':   ('电平表叠加', '把实时音量表烧录到画面上'),
}


def patch(lang):
    nd_p = ROOT / lang / 'nodeDefs.json'
    nd = json.loads(nd_p.read_text(encoding='utf-8'))
    nested = nd.setdefault('ComfyTV', {})
    for cls, (en, zh) in NODES.items():
        name = en if lang == 'en' else zh
        nested[cls] = {'display_name': name}
        nd[f'ComfyTV_{cls}'] = {'display_name': name}
    nd_p.write_text(json.dumps(nd, ensure_ascii=False, indent=2) + '\n',
                    encoding='utf-8')

    main_p = ROOT / lang / 'main.json'
    main = json.loads(main_p.read_text(encoding='utf-8'))
    vc = main.setdefault('presets', {}).setdefault('videoChange', {})
    for pid, (label, tip) in (PRESETS_EN if lang == 'en' else PRESETS_ZH).items():
        vc[pid] = {'label': label, 'tooltip': tip}
    main_p.write_text(json.dumps(main, ensure_ascii=False, indent=2) + '\n',
                      encoding='utf-8')


patch('en')
patch('zh')
print('r3 locales patched')
