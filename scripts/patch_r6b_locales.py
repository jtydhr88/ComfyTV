import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'Card3DStage':           ('Card 3D', '3D 卡片'),
    'RegrainStage':          ('Regrain', '胶片颗粒'),
    'Video360StabilizeStage': ('360 Stabilize', '360 稳定'),
    'ContactSheetStage':     ('Contact Sheet', '审片宫格'),
    'STMapGenStage':         ('STMap Generate', 'STMap 生成'),
}

FX_KEYS = {
    'stab360Hint': (
        'Two-pass: analyzes equirect yaw/pitch motion, smooths the camera '
        'path, then re-renders.',
        '两遍:分析 equirect 的 yaw/pitch 运动,平滑相机路径后重渲染。'),
    'stmapGenHint': (
        '16-bit STMap for the undistort → comp → redistort workflow. '
        'Feed it into the STMap node.',
        '16-bit STMap,用于 undistort→合成→redistort 工作流;接入 STMap '
        '节点使用。'),
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
print('r6b locales patched')
