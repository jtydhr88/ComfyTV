import hashlib
import json
from typing import Any


def _seed(*parts: Any) -> int:
    blob = '|'.join(repr(p) for p in parts).encode('utf-8', errors='replace')
    h = hashlib.md5(blob).hexdigest()
    return int(h[:8], 16)


def _autogrow_values(group: Any) -> list:
    if group is None:
        return []
    try:
        return [v for v in group.values() if v is not None]
    except AttributeError:
        return list(group) if isinstance(group, (list, tuple)) else [group]


_VIDEO_SAMPLES = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
]

_AUDIO_SAMPLES = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
]

_SHOT_PROMPTS = [
    'Wide establishing shot, golden hour lighting',
    'Medium close-up, dialogue beat, soft key light',
    'Over-the-shoulder, reaction shot',
    'Tracking shot following the protagonist',
    'Insert: hands on object, shallow depth',
    'High angle, character isolated in frame',
    'Low angle, dramatic perspective',
]


def _fake_text(main_prompt: str, *extras: Any) -> str:
    return (main_prompt or '').strip()


def _fake_image(*seed_parts: Any, w: int = 512, h: int = 512) -> str:
    s = _seed(*seed_parts) % 100000
    return f"https://picsum.photos/seed/{s}/{w}/{h}"


def _fake_video(*seed_parts: Any) -> str:
    s = _seed(*seed_parts) % len(_VIDEO_SAMPLES)
    return _VIDEO_SAMPLES[s]


def _fake_audio(*seed_parts: Any) -> str:
    s = _seed(*seed_parts) % len(_AUDIO_SAMPLES)
    return _AUDIO_SAMPLES[s]


_SHOT_PURPOSES = [
    'Establish the setting and mood.',
    'Introduce the protagonist.',
    'Raise the central tension.',
    'A quiet character beat.',
    'Turn the scene toward its climax.',
    'Resolve the moment.',
]
_SHOT_SIZES = ['特写 (Close-up)', '中近景 (Medium close-up)', '中景 (Medium)',
               '全景 (Wide)', '远景 (Long shot)', '过肩镜头 (OTS)']
_SHOT_EMOTIONS = ['紧张、专注', '平静、温柔', '兴奋、期待', '疲惫、压抑', '坚定、果敢']
_SHOT_LIGHTING = ['冷蓝色屏幕光，压抑沉闷', '金色黄昏侧光，温暖', '顶光，硬阴影，戏剧化',
                  '柔和散射光，均匀通透', '逆光剪影，氛围感强']
_SHOT_ACTIONS = ['缓缓转身望向镜头。', '低头沉思，手指轻敲桌面。', '快步走入画面，停在中心。',
                 '抬手遮挡刺眼的光。', '无']
_SHOT_SFX = ['环境白噪音，远处脚步声', '风声，衣物摩擦声', '机械运转声，金属碰撞',
             '雨声，雷鸣', '无']
_SHOT_DIALOGUE = ['无', '"该走了。"', '"你确定吗？"', '"就是现在。"']
_SHOT_CHARACTERS = ['主角_现代', '主角_过去', '配角_甲', '无']


def _fake_storyboard(*seed_parts: Any) -> str:
    s = _seed(*seed_parts)
    shot_count = 4 + (s % 4)  # 4..7 shots

    def pick(arr: list, i: int):
        return arr[(s + i) % len(arr)]

    shots = []
    for i in range(shot_count):
        prompt = pick(_SHOT_PROMPTS, i)
        char = pick(_SHOT_CHARACTERS, i)
        shots.append({
            "shot_no": str(i + 1),
            "duration": f"{2 + ((s + i) % 4)}s",
            "scene_purpose": pick(_SHOT_PURPOSES, i),
            "character": char,
            "character_desc": (
                "" if char == "无"
                else f"[{char}: 28岁，五官立体，神态自然，服装贴合场景设定]"
            ),
            "shot_size": pick(_SHOT_SIZES, i),
            "action": pick(_SHOT_ACTIONS, i),
            "emotion": pick(_SHOT_EMOTIONS, i),
            "scene_tags": "室内, 桌前" if i % 2 == 0 else "室外, 街道",
            "lighting": pick(_SHOT_LIGHTING, i),
            "sfx": pick(_SHOT_SFX, i),
            "dialogue": pick(_SHOT_DIALOGUE, i),
            "prompt": prompt,
            "image_prompt": (
                f"[画面构图：{pick(_SHOT_SIZES, i)}，平视机位] + [{prompt}] + "
                "[主体居中，前景虚化] + [写实风格] + [85mm, f/1.8, 浅景深]"
            ),
            "motion_prompt": (
                "[摄影机缓慢推近] + [主体动作自然展开] + [环境光影轻微变化] + "
                f"[音效：{pick(_SHOT_SFX, i)}] + [时长: {2 + ((s + i) % 4)}.0s]"
            ),
            "image_url": None,
        })
    return json.dumps({"shots": shots})


def _fake_image_batch_from_storyboard(storyboard: Any, *seed_parts: Any) -> str:
    shots: list[dict] = []
    if storyboard:
        try:
            data = json.loads(storyboard) if isinstance(storyboard, str) else storyboard
            if isinstance(data, dict) and isinstance(data.get("shots"), list):
                shots = data["shots"]
        except (ValueError, TypeError):
            pass
    s = _seed(*seed_parts)
    images = [
        {
            "index": shot.get("shot_no", str(i + 1)),
            "label": f"Shot {shot.get('shot_no', i + 1)}",
            "prompt": shot.get("prompt", ""),
            "image_url": f"https://picsum.photos/seed/{s}-{i}/320/180",
        }
        for i, shot in enumerate(shots)
    ]
    return json.dumps({"images": images})


_PANORAMA_VIEW_LABELS_4 = ["Front", "Right", "Back", "Left"]


def _fake_image_variations(source: Any, count: int, *seed_parts: Any) -> str:
    n = max(1, int(count or 1))
    s = _seed(*seed_parts)
    images = [
        {
            "index": str(i + 1),
            "label": f"#{i + 1}",
            "image_url": f"https://picsum.photos/seed/{s}-var-{i}/320/180",
        }
        for i in range(n)
    ]
    return json.dumps({"images": images})


def _fake_panorama_views(panorama: Any, view_count: int, *seed_parts: Any) -> str:
    count = max(1, int(view_count or 1))
    s = _seed(*seed_parts)
    labels = (
        _PANORAMA_VIEW_LABELS_4 if count == 4
        else [f"View {i + 1}" for i in range(count)]
    )
    images = [
        {
            "index": str(i + 1),
            "label": labels[i] if i < len(labels) else f"View {i + 1}",
            "image_url": f"https://picsum.photos/seed/{s}-pano-{i}/320/180",
        }
        for i in range(count)
    ]
    return json.dumps({"images": images})
