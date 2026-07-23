import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'ScoreStage':       ('Score', '乐谱'),
    'ScoreToMidiStage': ('Score Performer', '演奏引擎'),
    'SF2SynthStage':    ('Score Synth', '乐谱合成'),
    'ClickTrackStage':  ('Click Track', '节拍器轨'),
}

MUSIC_KEYS = {
    'scorePlaceholder': (
        'Paste MusicXML here (score-partwise)…',
        '在此粘贴 MusicXML(score-partwise)…'),
    'scoreFromInput': (
        'Score comes from the wired text input.',
        '乐谱来自接入的 text 输入。'),
    'scoreHint': (
        'MusicXML from an LLM, MuseScore export, or by hand. Run '
        'validates and passes it downstream.',
        '可来自 LLM、MuseScore 导出或手写。Run 校验后传给下游。'),
    'needsScore': ('Wire a Score stage', '请接入乐谱节点'),
    'needsPerformance': ('Wire Score Performer (or Click Track)',
                         '请接入演奏引擎(或节拍器轨)'),
    'swing': ('Swing', '摇摆'),
    'humanize': ('Humanize', '人性化'),
    'downloadMidi': ('Download .mid', '下载 .mid'),
    'soundfont': ('Soundfont', '音色库'),
    'builtinSynth': ('Built-in synth (no soundfont)', '内置合成(无音色库)'),
    'instrument': ('Instrument', '乐器'),
    'gain': ('Gain', '增益'),
    'sfHint': (
        'Rendering with the SF2/SF3 engine (own port, no fluidsynth).',
        '使用自研 SF2/SF3 引擎渲染(非 fluidsynth)。'),
    'builtinHint': (
        'No soundfont selected — using the additive fallback synth. Drop '
        'an .sf2/.sf3 (e.g. FluidR3Mono_GM) into the Resources panel for '
        'real instruments.',
        '未选音色库——使用内置加法合成兜底。把 .sf2/.sf3(如 '
        'FluidR3Mono_GM)拖进资源面板即可获得真实乐器音色。'),
    'beatsPerBar': ('Beats / bar', '每小节拍数'),
    'bars': ('Bars', '小节数'),
    'clickFromLabels': (
        'Clicks follow the wired labels (e.g. Audio Beats & Notes).',
        '打点跟随接入的 labels(如节拍分析输出)。'),
    'clickHint': (
        'Strong beat = GM woodblock high, weak = low. Wire beat labels to '
        'click along real music.',
        '强拍=GM 高音梆子,弱拍=低音。接节拍分析的 labels 可跟真实音乐打点。'),
    'engraving': ('engraving…', '刻谱中…'),
    'noScoreYet': ('Paste or wire MusicXML to see the engraved score',
                   '粘贴或接入 MusicXML 即可看到刻谱'),
    'following': ('following playback', '跟随播放中'),
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
    res = main.setdefault('resources', {}).setdefault('kind', {})
    res['soundfont'] = 'Soundfonts' if lang == 'en' else '音色库'
    main_p.write_text(json.dumps(main, ensure_ascii=False, indent=2) + '\n',
                      encoding='utf-8')


patch('en')
patch('zh')
print('music locales patched')
