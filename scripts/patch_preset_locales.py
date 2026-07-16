import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'locales'

EN = {
    "color":        ("Color", "Grade: exposure, temperature, hue/sat and 3-way color wheels"),
    "curves":       ("Curves", "Master/R/G/B tone curves"),
    "lut":          ("LUT", "Apply a .cube 3D LUT"),
    "blur-sharpen": ("Blur / Sharpen", "Gaussian/box/bilateral blur or unsharp-mask sharpen"),
    "denoise":      ("Denoise", "Spatio-temporal denoise / deband"),
    "chroma-key":   ("Chroma Key", "Green/blue-screen key → alpha WebM or b/w matte"),
    "transition":   ("Transition", "Cross-transition two clips (55 xfade patterns)"),
    "stabilize":    ("Stabilize", "Remove camera shake (deshake)"),
    "scene-detect": ("Scene Detect", "Find hard cuts, one thumbnail per scene"),
    "interpolate":  ("Interpolate", "Optical-flow retime to higher fps or smooth slow-mo"),
    "stylize":      ("Stylize", "Vignette / grain / pixelize / sepia / old film"),
    "scopes":       ("Scopes", "Waveform / vectorscope / histogram of a frame"),
    "transform":    ("Transform", "Keyframable move/scale/rotate with motion blur"),
    "composite":    ("Composite", "Layer another clip on top — 39 blend modes"),
    "corner-pin":   ("Corner Pin", "Perspective-pin the frame by its four corners"),
    "roto-mask":    ("Roto Mask", "Draw a Bezier shape → feathered matte video"),
    "motion-track": ("Motion Track", "Track a point; feed the track into Transform/Composite"),
    "title":        ("Title", "Burn a styled title with fades"),
    "subtitles":    ("Subtitles", "Burn SRT/VTT subtitles into the clip"),
}

ZH = {
    "color":        ("调色", "曝光、色温、色相/饱和 + 三路色轮"),
    "curves":       ("曲线", "主通道/R/G/B 色调曲线"),
    "lut":          ("LUT", "套用 .cube 3D LUT"),
    "blur-sharpen": ("模糊/锐化", "高斯/盒式/双边模糊或 USM 锐化"),
    "denoise":      ("降噪", "时空降噪 / 去色带"),
    "chroma-key":   ("抠像", "绿幕/蓝幕抠像 → 透明 WebM 或黑白遮罩"),
    "transition":   ("转场", "两段视频交叉转场（55 种 xfade）"),
    "stabilize":    ("防抖", "去除相机抖动（deshake）"),
    "scene-detect": ("场景检测", "找出硬切点，每个场景一张缩略图"),
    "interpolate":  ("补帧", "光流升帧率或丝滑慢动作"),
    "stylize":      ("风格化", "晕影 / 颗粒 / 像素化 / 老电影"),
    "scopes":       ("示波器", "波形 / 矢量示波器 / 直方图"),
    "transform":    ("变换", "可打关键帧的移动/缩放/旋转 + 运动模糊"),
    "composite":    ("合成", "叠加另一段视频 — 39 种混合模式"),
    "corner-pin":   ("四角定位", "拖四角做透视贴合"),
    "roto-mask":    ("Roto 遮罩", "画 Bezier 形状 → 羽化遮罩视频"),
    "motion-track": ("运动跟踪", "跟踪一个点，喂给变换/合成节点"),
    "title":        ("标题", "烧录带淡入淡出的样式标题"),
    "subtitles":    ("字幕", "把 SRT/VTT 字幕烧进画面"),
}


def patch(lang, data):
    p = ROOT / lang / 'main.json'
    d = json.loads(p.read_text(encoding='utf-8'))
    vc = d.setdefault('presets', {}).setdefault('videoChange', {})
    for pid, (label, tip) in data.items():
        vc[pid] = {'label': label, 'tooltip': tip}
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n',
                 encoding='utf-8')


patch('en', EN)
patch('zh', ZH)
print('preset locales patched')
