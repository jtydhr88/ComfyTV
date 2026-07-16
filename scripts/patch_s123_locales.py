import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'STMapStage':        ('UV Remap', 'UV 重映射'),
    'MaskPropagateStage': ('Mask Propagate', '遮罩传播'),
    'SubtitleGenStage':  ('Subtitles · Speech-to-Text', '语音转字幕'),
    'HueCorrectStage':   ('Hue Correct', '色相校正'),
    'GlowStage':         ('Glow', '辉光'),
    'GodRaysStage':      ('God Rays', '光芒'),
    'PatternStage':      ('Pattern', '图形生成'),
}

PRESETS_EN = {
    'uv-remap':       ('UV Remap', 'STMap/IDistort displacement via a UV map'),
    'mask-propagate': ('Mask Propagate', 'Track a first-frame mask through the clip'),
    'speech-to-text': ('Auto Subtitles', 'Speech-to-text workflow → SRT for the Subtitles stage'),
    'hue-correct':    ('Hue Correct', 'Hue-domain curves: sat/lum/RGB gains and suppression'),
    'glow':           ('Glow', 'Isolate highlights + multi-level bloom'),
    'god-rays':       ('God Rays', 'Radial transform-stack light rays'),
    'motion-track-solve': ('Track & Solve', 'Multi-point track solved to Transform / Corner Pin'),
}
PRESETS_ZH = {
    'uv-remap':       ('UV 重映射', '用 UV 贴图做 STMap/IDistort 置换'),
    'mask-propagate': ('遮罩传播', '把首帧遮罩沿视频跟踪传播成遮罩视频'),
    'speech-to-text': ('自动字幕', '语音识别工作流 → SRT，接字幕烧录节点'),
    'hue-correct':    ('色相校正', 'hue 域曲线：饱和/亮度/RGB 增益与溢色抑制'),
    'glow':           ('辉光', '亮部隔离 + 多级 bloom'),
    'god-rays':       ('光芒', '径向变换叠加的体积光'),
    'motion-track-solve': ('跟踪求解', '多点跟踪解算 变换/四角定位'),
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
print('s123 locales patched')
