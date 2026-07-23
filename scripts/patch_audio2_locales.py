import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'AudioStemSplitStage':      ('Audio Stem Split', '音源分轨'),
    'AudioNoiseReductionStage': ('Noise Reduction (Spectral)', '谱门控降噪'),
    'AudioMIRStage':            ('Audio Beats & Notes', '节拍与音符分析'),
}

AFX_KEYS = {
    'pitchHq': ('Pitch HQ', '变调 HQ'),
    'stretchHq': ('Stretch HQ', '变速 HQ'),
    'hqNote': (
        'Phase-locked vocoder (StaffPad algorithm) — slower but much '
        'cleaner than the standard modes.',
        '相位锁定声码器(StaffPad 算法)——更慢,但音质远超普通模式。'),
    'stemSplitHint': (
        'Hybrid Demucs 4-stem separation. First run downloads the model '
        '(~319 MB). Vocals / accompaniment cover karaoke workflows.',
        'Hybrid Demucs 四轨分离;首次运行自动下载模型(~319MB)。'
        '人声/伴奏两路输出即卡拉OK工作流。'),
    'reduction': ('Reduction', '降噪量'),
    'sensitivity': ('Sensitivity', '灵敏度'),
    'freqSmoothing': ('Freq Smoothing', '频率平滑'),
    'nrProfileWired': (
        'Noise profile: from the wired noise sample.',
        '噪声样本:来自接入的 noise_sample 输入。'),
    'nrProfileAuto': (
        'Noise profile: auto (quietest 10% of frames). Wire a noise-only '
        'clip into noise_sample for best results.',
        '噪声样本:自动(取最安静的 10% 帧)。接入纯噪声片段到 '
        'noise_sample 效果最佳。'),
    'beats': ('Beats', '节拍'),
    'onsets': ('Onsets', '瞬态'),
    'notes': ('Notes', '音符'),
    'threshold': ('Threshold', '阈值'),
    'minGap': ('Min Gap', '最小间隔'),
    'mirHint': (
        'Outputs keyframe pulses (wire into Transform/Composite track) '
        'and labels JSON with times.',
        '输出关键帧脉冲(接 Transform/Composite 的 track 输入)和带时间的 '
        'labels JSON。'),
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
        afx.setdefault(key, en if lang == 'en' else zh)
        afx[key] = en if lang == 'en' else zh
    main_p.write_text(json.dumps(main, ensure_ascii=False, indent=2) + '\n',
                      encoding='utf-8')


patch('en')
patch('zh')
print('audio2 locales patched')
