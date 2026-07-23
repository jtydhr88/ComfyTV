import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'SlitScanStage':      ('Slit Scan', '狭缝扫描'),
    'FeedbackFXStage':    ('Feedback FX', '反馈特效'),
    'StrobeStage':        ('Strobe', '闪帧'),
    'ExpressionStage':    ('Expression', '表达式'),
    'Select0rStage':      ('Select0r', '高级选色'),
    'ArtFXStage':         ('Art FX', '艺术滤镜'),
    'GlitchFXStage':      ('Glitch FX', '数字故障'),
    'KaleidoscopeStage':  ('Kaleidoscope', '万花筒'),
    'WaveWarpStage':      ('Wave Warp', '波浪扭曲'),
    'WaterStage':         ('Water', '水面'),
    'LightGraffitiStage': ('Light Graffiti', '光绘'),
}

FX_KEYS = {
    'echoHint': (
        'Layered frame echoes with feedback trails.',
        '多帧残影叠加,带反馈拖尾。'),
    'needsRetimeMap': (
        'Map mode needs a grayscale retime image',
        'Map 模式需要接入灰度重定时图'),
    'expressionHint': (
        'Vars: t, frame, duration, fps. Fns: noise, fbm, turbulence, '
        'smoothstep, remap, mix, hash, random, sin/cos…',
        '变量:t、frame、duration、fps;函数:noise、fbm、turbulence、'
        'smoothstep、remap、mix、hash、random、sin/cos…'),
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
    fx = main.setdefault('fx', {})
    for key, (en, zh) in FX_KEYS.items():
        fx[key] = en if lang == 'en' else zh
    main_p.write_text(json.dumps(main, ensure_ascii=False, indent=2) + '\n',
                      encoding='utf-8')


patch('en')
patch('zh')
print('r6 locales patched')
