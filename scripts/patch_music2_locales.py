import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'ChordAccompStage': ('Chord Accompaniment', '和弦伴奏'),
    'MuseReverbStage':  ('Muse Reverb (FDN)', 'Muse 混响 (FDN)'),
}

AFX_KEYS = {
    'reverbTime': ('Reverb Time', '混响时长'),
    'roomScale': ('Room Scale', '房间尺度'),
    'predelay': ('Pre-delay', '预延迟'),
    'dry': ('Dry', '干声'),
    'late': ('Late', '晚期混响'),
    'early': ('Early Refl.', '早反射'),
    'timeLow': ('Low Decay', '低频衰减'),
    'timeHigh': ('High Decay', '高频衰减'),
    'modulation': ('Modulation', '调制'),
    'stereoSpread': ('Stereo Spread', '立体声宽度'),
}

MUSIC_KEYS = {
    'octave': ('Octave', '八度'),
    'velocity': ('Velocity', '力度'),
    'repeats': ('Repeats', '循环次数'),
    'chordHint': (
        'Bars split by |, chords per bar split evenly. Slash bass (C/E), '
        'qualities: m, 7, maj7, m7, dim, aug, sus4, 6, 9, m7b5…',
        '小节用 | 分隔,小节内和弦均分拍。支持转位(C/E)与 m/7/maj7/m7/'
        'dim/aug/sus4/6/9/m7b5 等。'),
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
    afx = main.setdefault('afx', {})
    for key, (en, zh) in AFX_KEYS.items():
        afx[key] = en if lang == 'en' else zh
    music = main.setdefault('music', {})
    for key, (en, zh) in MUSIC_KEYS.items():
        music[key] = en if lang == 'en' else zh
    main_p.write_text(json.dumps(main, ensure_ascii=False, indent=2) + '\n',
                      encoding='utf-8')


patch('en')
patch('zh')
print('music2 locales patched')
