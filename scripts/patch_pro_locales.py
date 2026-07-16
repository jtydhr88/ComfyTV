import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

NODES = {
    'VideoCompositeStage': ('Video Composite', '视频合成'),
    'VideoTransformStage': ('Video Transform', '视频变换'),
    'CornerPinStage':      ('Corner Pin', '四角定位'),
    'RotoMaskStage':       ('Roto Mask', 'Roto 遮罩'),
    'MotionTrackStage':    ('Motion Track', '运动跟踪'),
    'TitleStage':          ('Title', '标题'),
    'SubtitleStage':       ('Subtitles', '字幕烧录'),
}

FX_EXTRA_EN = {
    "operator": "Blend mode", "opacity": "Opacity",
    "position": "Position", "scale": "Scale", "rotation": "Rotation",
    "skew": "Skew", "motionBlur": "Motion blur",
    "keyframes": "Keyframes", "addKey": "Add key", "delKey": "Delete key",
    "clearKeys": "Clear",
    "dragHint": "Drag the frame to move · wheel to scale",
    "cornerHint": "Drag the four corner handles",
    "rotoHint": "Click adds a point · drag moves · double-click a point removes it",
    "trackHint": "Click the frame to set the track point",
    "needsBgFg": "Wire background and foreground videos",
    "foreground": "Foreground", "background": "Background",
    "text": "Text", "fontLbl": "Font", "fontSize": "Size",
    "colorLbl": "Color", "strokeLbl": "Stroke", "anchor": "Anchor",
    "tStart": "Start (s)", "tEnd": "End (s)", "tEndAuto": "-1 = to the end",
    "fade": "Fade (s)",
    "subsPlaceholder": "Paste SRT / WebVTT cues here…",
    "cues": "cues",
    "trackPoint": "Track point", "pattern": "Pattern", "searchR": "Search",
    "feather": "Feather", "invert": "Invert",
}

FX_EXTRA_ZH = {
    "operator": "混合模式", "opacity": "不透明度",
    "position": "位置", "scale": "缩放", "rotation": "旋转",
    "skew": "斜切", "motionBlur": "运动模糊",
    "keyframes": "关键帧", "addKey": "打帧", "delKey": "删帧",
    "clearKeys": "清空",
    "dragHint": "拖动画面移动 · 滚轮缩放",
    "cornerHint": "拖动四个角点",
    "rotoHint": "单击加点 · 拖动移动 · 双击点删除",
    "trackHint": "在画面上单击设置跟踪点",
    "needsBgFg": "需要接入背景和前景视频",
    "foreground": "前景", "background": "背景",
    "text": "文本", "fontLbl": "字体", "fontSize": "字号",
    "colorLbl": "颜色", "strokeLbl": "描边", "anchor": "锚点",
    "tStart": "开始 (s)", "tEnd": "结束 (s)", "tEndAuto": "-1 = 到结尾",
    "fade": "淡入淡出 (s)",
    "subsPlaceholder": "在此粘贴 SRT / WebVTT 字幕…",
    "cues": "条字幕",
    "trackPoint": "跟踪点", "pattern": "模板半径", "searchR": "搜索半径",
    "feather": "羽化", "invert": "反转",
}


def patch(lang, extra):
    main_p = ROOT / lang / 'main.json'
    main = json.loads(main_p.read_text(encoding='utf-8'))
    main.setdefault('fx', {}).update(extra)
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


patch('en', FX_EXTRA_EN)
patch('zh', FX_EXTRA_ZH)
print('pro locales patched')
