import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'ScoreEditorStage': ('Score Editor', '打谱器'),
}

MUSIC_KEYS = {
    'draw': ('Draw', '画音符'),
    'select': ('Select', '选择'),
    'snap': ('Snap', '对齐'),
    'tempo': ('Tempo', '速度'),
    'timeSig': ('Time Sig', '拍号'),
    'bars': ('Bars', '小节'),
    'part': ('Part', '声部'),
    'addPart': ('Add part', '加声部'),
    'removePart': ('Remove part', '删声部'),
    'importScore': ('Import wired score', '导入上游乐谱'),
    'importFailed': ('Import failed', '导入失败'),
    'clearPart': ('Clear part', '清空声部'),
    'undo': ('Undo', '撤销'),
    'rollHint': (
        'Draw: press and drag out a note · drag moves · right edge '
        'resizes · double-click deletes · Del removes selection · '
        'Ctrl+wheel zooms',
        '画音符:按下拖出时值 · 拖动移动 · 右缘拉长短 · 双击删除 · '
        'Del 删选中 · Ctrl+滚轮缩放'),
    'step': ('Step', '键入'),
    'stepHint': (
        'Step input: A-G enters a note at the cursor (nearest octave) · '
        '7-2 picks duration · . dot · 0/space rest · Backspace steps '
        'back · Up/Down transposes (Shift = octave) · click sets the '
        'cursor',
        '键入模式:A-G 在光标处进音(就近八度) · 7-2 选时值 · . 附点 · '
        '0/空格 休止 · Backspace 回退 · ↑↓ 移调(Shift=八度) · '
        '点击网格定位光标'),
    'skippedPercussion': (
        'Percussion parts were skipped on import',
        '打击乐声部导入时被跳过'),
    'percussion': ('Drum part (GM keys)', '鼓声部(GM 鼓组)'),
    'instrument': ('Instrument', '乐器'),
    'quantize': ('Quantize selection', '量化选中'),
    'renamePart': ('Rename part (double-click)', '重命名声部(双击)'),
    'rollHint2': (
        'Select: drag for marquee · Ctrl+A all · Ctrl+D duplicate · '
        'velocity lane below the grid',
        '选择模式:拖拽框选 · Ctrl+A 全选 · Ctrl+D 复制 · '
        '网格下方是力度条'),
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
    music = main.setdefault('music', {})
    for key, (en, zh) in MUSIC_KEYS.items():
        music[key] = en if lang == 'en' else zh
    main_p.write_text(json.dumps(main, ensure_ascii=False, indent=2) + '\n',
                      encoding='utf-8')


for lang in ('en', 'zh'):
    patch(lang)
print('score editor locales patched')
