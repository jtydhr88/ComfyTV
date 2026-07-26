import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'MidiEditorStage': ('MIDI Editor', 'MIDI 编辑器'),
}

MUSIC_KEYS = {
    'channel': ('Channel', '通道'),
    'addChannel': ('Add channel', '加通道'),
    'removeChannel': ('Remove channel', '删通道'),
    'clearChannel': ('Clear channel', '清空通道'),
    'importMidi': ('Import wired MIDI', '导入上游 MIDI'),
    'notMidi': ('Wired input is not a MIDI payload', '上游输入不是 MIDI'),
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
print('midi editor locales patched')
