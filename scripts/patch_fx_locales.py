import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'VideoColorStage':       ('Video Color', '视频调色'),
    'VideoCurvesStage':      ('Video Curves', '视频曲线'),
    'VideoLUTStage':         ('Video LUT', '视频 LUT'),
    'VideoBlurSharpenStage': ('Blur / Sharpen', '模糊/锐化'),
    'VideoDenoiseStage':     ('Video Denoise', '视频降噪'),
    'VideoChromaKeyStage':   ('Chroma Key', '色度抠像'),
    'VideoTransitionStage':  ('Video Transition', '视频转场'),
    'VideoStabilizeStage':   ('Video Stabilize', '视频防抖'),
    'SceneDetectStage':      ('Scene Detect', '场景检测'),
    'VideoInterpolateStage': ('Frame Interpolate', '光流补帧'),
    'VideoDeinterlaceStage': ('Deinterlace', '去隔行'),
    'VideoStylizeStage':     ('Video Stylize', '视频风格化'),
    'VideoScopesStage':      ('Video Scopes', '视频示波器'),
    'AudioDynamicsStage':    ('Audio Dynamics', '音频动态'),
    'AudioEQStage':          ('Audio EQ', '音频均衡器'),
    'AudioLoudnessStage':    ('Audio Loudness', '音频响度'),
    'AudioDenoiseStage':     ('Audio Denoise', '音频降噪'),
}

FX_EN = {
    "processing": "Processing…",
    "done": "Done — ready for downstream",
    "adjustThenRun": "Adjust parameters, then Run",
    "needsTwoInputs": "Wire two videos into A and B",
    "needsAudioOrVideo": "Wire an audio or video input",
    "previewNote": "Preview is approximate — Run renders precisely",
    "mode": "Mode", "method": "Method", "effect": "Effect",
    "scope": "Scope", "preset": "Preset", "transition": "Transition",
    "amount": "Amount", "size": "Size", "strength": "Strength",
    "edgePreserve": "Edge keep",
    "exposure": "Exposure", "black": "Black", "temperature": "Temp (K)",
    "tempMix": "Temp mix", "hue": "Hue", "saturation": "Saturation",
    "vibrance": "Vibrance",
    "shadows": "Shadows", "midtones": "Midtones", "highlights": "Highlights",
    "preserveLightness": "Preserve lightness", "resetWheels": "Reset wheels",
    "master": "Master", "red": "Red", "green": "Green", "blue": "Blue",
    "resetCurve": "Reset curve",
    "curveHint": "Click to add · drag to move · right-click deletes",
    "keyColor": "Key color", "pickFromVideo": "Pick from frame",
    "similarity": "Similarity", "blend": "Blend",
    "despill": "Despill", "despillExpand": "Despill expand",
    "outAlpha": "Alpha (WebM)", "outMatte": "B/W matte",
    "duration": "Duration", "offset": "Offset", "offsetAuto": "0 = auto (end of A)",
    "rangeX": "Range X", "rangeY": "Range Y", "edgeMode": "Edge fill",
    "threshold": "Threshold", "minGap": "Min gap",
    "detectHint": "Run scans for hard cuts and outputs one thumbnail per scene",
    "targetFps": "Target fps", "slowFactor": "Slow ×", "miMode": "Interp mode",
    "rateFrame": "Same rate", "rateField": "Double rate",
    "block": "Block",
    "atSeconds": "At (s)", "middle": "middle",
    "thresholdDb": "Threshold", "ratio": "Ratio", "attack": "Attack",
    "release": "Release", "makeup": "Makeup", "knee": "Knee",
    "intensity": "Intensity",
    "eqHint": "Double-click adds a band · drag moves · wheel = Q · double-click a dot removes",
    "targetI": "Target LUFS", "targetTp": "True peak", "targetLra": "LRA",
    "frameLen": "Frame (ms)", "gaussWin": "Gauss win",
    "silenceDb": "Silence (dB)", "minSilence": "Min silence (s)",
    "lutFile": "LUT file", "upload": "Upload", "interp": "Interp",
    "noLuts": "No LUTs yet — upload a .cube file", "refresh": "Refresh",
}

FX_ZH = {
    "processing": "处理中…",
    "done": "完成 — 可供下游使用",
    "adjustThenRun": "调整参数后点击 Run",
    "needsTwoInputs": "需要接入两个视频（A 和 B）",
    "needsAudioOrVideo": "需要接入音频或视频",
    "previewNote": "预览为近似效果 — Run 后精确渲染",
    "mode": "模式", "method": "方法", "effect": "效果",
    "scope": "示波器", "preset": "预设", "transition": "转场",
    "amount": "强度", "size": "尺寸", "strength": "力度",
    "edgePreserve": "保边",
    "exposure": "曝光", "black": "黑位", "temperature": "色温 (K)",
    "tempMix": "色温混合", "hue": "色相", "saturation": "饱和度",
    "vibrance": "自然饱和",
    "shadows": "阴影", "midtones": "中间调", "highlights": "高光",
    "preserveLightness": "保持明度", "resetWheels": "重置色轮",
    "master": "主通道", "red": "红", "green": "绿", "blue": "蓝",
    "resetCurve": "重置曲线",
    "curveHint": "单击添加 · 拖动移动 · 右键删除",
    "keyColor": "键色", "pickFromVideo": "从画面取色",
    "similarity": "相似度", "blend": "边缘融合",
    "despill": "去溢色", "despillExpand": "溢色扩展",
    "outAlpha": "透明通道 (WebM)", "outMatte": "黑白遮罩",
    "duration": "时长", "offset": "起始位置", "offsetAuto": "0 = 自动（A 末尾）",
    "rangeX": "水平搜索", "rangeY": "垂直搜索", "edgeMode": "边缘填充",
    "threshold": "阈值", "minGap": "最小间隔",
    "detectHint": "Run 扫描硬切点，每个场景输出一张缩略图",
    "targetFps": "目标帧率", "slowFactor": "慢放倍数", "miMode": "补偿模式",
    "rateFrame": "同帧率", "rateField": "倍帧率",
    "block": "块大小",
    "atSeconds": "取帧时间 (s)", "middle": "中点",
    "thresholdDb": "阈值", "ratio": "压缩比", "attack": "启动",
    "release": "释放", "makeup": "增益补偿", "knee": "拐点",
    "intensity": "强度",
    "eqHint": "双击空白添加频段 · 拖动调节 · 滚轮调 Q · 双击圆点删除",
    "targetI": "目标响度 LUFS", "targetTp": "真峰值", "targetLra": "响度范围",
    "frameLen": "帧长 (ms)", "gaussWin": "高斯窗",
    "silenceDb": "静音阈值 (dB)", "minSilence": "最短静音 (s)",
    "lutFile": "LUT 文件", "upload": "上传", "interp": "插值",
    "noLuts": "暂无 LUT — 请上传 .cube 文件", "refresh": "刷新",
}


def patch(lang: str, fx: dict):
    main_p = ROOT / lang / 'main.json'
    main = json.loads(main_p.read_text(encoding='utf-8'))
    main['fx'] = fx
    main_p.write_text(json.dumps(main, ensure_ascii=False, indent=2) + '\n',
                      encoding='utf-8')

    nd_p = ROOT / lang / 'nodeDefs.json'
    nd = json.loads(nd_p.read_text(encoding='utf-8'))
    nested = nd.setdefault('ComfyTV', {})
    for cls, (en_name, zh_name) in NODES.items():
        name = en_name if lang == 'en' else zh_name
        nested[cls] = {'display_name': name}
        nd[f'ComfyTV_{cls}'] = {'display_name': name}
    nd_p.write_text(json.dumps(nd, ensure_ascii=False, indent=2) + '\n',
                    encoding='utf-8')


patch('en', FX_EN)
patch('zh', FX_ZH)
print('locales patched')
