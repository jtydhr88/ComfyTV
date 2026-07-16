import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'TimeRemapStage':        ('Time Remap', '时间重映射'),
    'SequenceStage':         ('Sequence', '序列编排'),
    'VideoStabilizeV2Stage': ('Stabilize Pro', '专业防抖'),
    'PaintStrokeStage':      ('Paint Strokes', '笔刷修补'),
}

PRESETS_EN = {
    "time-remap":   ("Time Remap", "Keyframed speed ramps (slow-mo ↔ fast) on one curve"),
    "sequence":     ("Sequence", "Order clips with per-segment trim and transitions"),
    "stabilize-pro": ("Stabilize Pro", "Two-pass vid.stab-grade stabilization"),
    "paint":        ("Paint", "Clone / blur / color brush repair strokes"),
}
PRESETS_ZH = {
    "time-remap":   ("时间重映射", "一条曲线上的关键帧变速（慢放↔快进）"),
    "sequence":     ("序列编排", "多段排序 + 每段修剪 + 段间转场"),
    "stabilize-pro": ("专业防抖", "vid.stab 级两阶段防抖"),
    "paint":        ("笔刷修补", "克隆/模糊/涂色笔刷修补"),
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
print('p2 locales patched')
