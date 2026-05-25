import json
import re


_STORYBOARD_FIELDS: list[tuple[str, str]] = [
    ("镜号",         "shot_no"),
    ("时长",         "duration"),
    ("画面描述",     "scene_purpose"),
    ("角色",         "character"),
    ("角色描述",     "character_desc"),
    ("角色图",       "character_img"),
    ("参考",         "reference_img"),
    ("景别",         "shot_size"),
    ("角色动作",     "action"),
    ("情绪",         "emotion"),
    ("场景标签",     "scene_tags"),
    ("光影氛围",     "lighting"),
    ("音效",         "sfx"),
    ("对白",         "dialogue"),
    ("分镜提示词",   "image_prompt"),
    ("视频运动提示词", "motion_prompt"),
]
_STORYBOARD_CN_TO_EN = dict(_STORYBOARD_FIELDS)


def _storyboard_llm_prompt(
    premise: str,
    total_duration_s: int = 30,
    shot_count: int = 6,
    characters: str = '',
) -> str:
    user_premise = (premise or '').strip() or '一段短片'
    chars = (characters or '').strip() or '- (无指定角色)'
    return f"""<|im_start|>system
你是专业的视频分镜脚本师。给定故事大纲和已知角色信息,你必须将其严格拆分为用户指定数量的分镜(不多不少)。每个分镜按以下 16 个字段严格输出。除字段内容外不输出任何解释、标题、Markdown。

【输出格式】每个分镜按以下顺序,每个字段单独一行:

镜号: 1
时长: 4
画面描述: 展示现代打工人的疲惫状态,奠定穿越前的压抑基调。
角色: 沈昭昭_现代
角色描述: [沈昭昭_现代: 28岁女性,面色苍白疲惫,穿着现代职场白衬衫,头发凌乱]
角色图:
参考:
景别: 特写 (Close-up)
角色动作: 机械地敲击键盘,视线呆滞,随后身体微微摇晃。
情绪: 极度疲惫、压抑
场景标签: 深夜办公室, 电脑屏幕前
光影氛围: 冷蓝色屏幕光,背景深邃黑暗,压抑沉闷
音效: 急促的机械键盘敲击声,背景微弱白噪音
对白: 无
分镜提示词: [画面构图:特写,平视机位] + [沈昭昭_现代:28岁女性,面色苍白,伏案] + [主体居中,前景模糊办公桌] + [她眉头紧锁,屏幕蓝光照在脸上] + [深夜办公室,几盏白炽灯] + [冷色调,屏幕蓝光与黑暗对比] + [写实风格,都市压抑感] + [85mm,f/1.8,浅景深]
视频运动提示词: [摄影机缓慢向前推近] + [手指急促敲击逐渐减慢,眼神失去焦点] + [屏幕光在脸上轻微闪烁] + [音效:机械键盘声] + [时长:4.0s]

(下一个分镜空一行后继续)

【字段规则】
- 镜号:从1开始递增的整数
- 时长:纯数字(秒),所有镜头时长之和必须等于用户给定总时长
- 画面描述:1 句话说明此分镜的叙事目的,不是画面内容
- 角色:角色标识符,下划线区分形态变体;无人物填"无"
- 角色描述:[角色标识:详细外貌+服饰+气质],同一角色首次出现必须完整描述,后续重复完整描述以便每个 prompt 独立可用
- 角色图、参考:留空
- 景别:从【特写/近景/中近景/中景/全景/远景/极特写/超大全景/过肩镜头/主观镜头】中选,可附英文
- 角色动作:1-2 句具体动作描述,无人物填"无"
- 情绪:1-3 个情绪词,顿号分隔
- 场景标签:地点关键词,逗号分隔
- 光影氛围:光源类型+色温+氛围
- 音效:具体可听见的声音,逗号分隔
- 对白:原文台词;无台词填"无"

【分镜提示词】拼接式结构(用 " + " 连接),严格按以下 8 段顺序,每段一对方括号:
1. [画面构图:景别,机位角度]
2. [完整角色描述,当前姿态/状态]
3. [主体位置 + 前景元素]
4. [人物表情/局部动作/光在脸上的效果]
5. [背景描述]
6. [色调/光影对比]
7. [风格关键词]
8. [镜头焦段,光圈,景深]

【视频运动提示词】拼接式结构(用 " + " 连接),严格按以下 5 段顺序:
1. [摄影机运动方式]
2. [人物动作展开过程]
3. [环境动态]
4. [音效:本镜核心声音]
5. [时长:x.xs]

【全局规则】
- 镜头数量必须严格等于用户在"分镜数"字段中指定的数字。少一个或多一个都算错误。
- 全部使用中文,禁止整段英文短语(景别后括号内的英文术语除外)
- 严格按时间顺序覆盖完整故事
- 角色一致性:同一角色在不同镜头出现时,描述必须完全一致
- 不输出任何前言、总结、Markdown 符号、代码块
- 第一行直接是"镜号: 1"
<|im_end|>
<|im_start|>user
故事大纲:{user_premise}
总时长:{int(total_duration_s)}秒
分镜数:{int(shot_count)}

已知角色:
{chars}
<|im_end|>
<|im_start|>assistant
"""


def _shot_to_block(shot: dict) -> str:
    lines = []
    for cn, en in _STORYBOARD_FIELDS:
        v = (shot or {}).get(en)
        if v is None or v == '':
            lines.append(f"{cn}: ")
        else:
            s = str(v).replace('\r\n', '\n').replace('\n', ' / ').strip()
            lines.append(f"{cn}: {s}")
    return "\n".join(lines)


def _storyboard_regenerate_shot_prompt(
    premise: str,
    shots: list[dict],
    target_no: int,
    user_hint: str = '',
    characters: str = '',
) -> str:
    user_premise = (premise or '').strip() or '一段短片'
    chars = (characters or '').strip() or '- (无指定角色)'
    target_idx = max(1, int(target_no))

    blocks = []
    for s in shots or []:
        try:
            sno = int(str(s.get('shot_no', '')).strip() or 0)
        except (ValueError, TypeError):
            sno = 0
        marker = "← 需要重写的镜头" if sno == target_idx else ""
        blocks.append(f"{_shot_to_block(s)}{('  ' + marker) if marker else ''}")
    existing_blocks = "\n\n".join(blocks) if blocks else "(无)"
    hint_line = (user_hint or '').strip()
    return f"""<|im_start|>system
你是专业的视频分镜脚本师。用户已有完整分镜,现在要求你**只重写其中一个镜头**(标记为"需要重写的镜头"的那一个)。

输出规则:
- **只输出一个镜头**,严格按 16 字段格式。
- 字段名、顺序、格式与现有分镜保持完全一致。
- 镜号保持不变(还是 {target_idx})。
- 时长保持不变,除非用户明确要求改长度。
- 与上下文中相邻镜头的叙事连贯,角色描述保持一致。
- 除字段内容外不输出任何解释。第一行直接是 "镜号: {target_idx}"。
<|im_end|>
<|im_start|>user
故事大纲:{user_premise}

已知角色:
{chars}

现有分镜列表(参考上下文):

{existing_blocks}

{('修改方向:' + hint_line) if hint_line else '请重写指定镜头,在保持叙事连贯的前提下给出新的画面 / 表演 / 镜头语言。'}
<|im_end|>
<|im_start|>assistant
"""


def _parse_shotlist_text(text: str) -> list[dict]:
    if not text:
        return []
    s = str(text).replace('\r\n', '\n')
    for marker in ('</think>', '</thinking>'):
        idx = s.lower().find(marker)
        if idx >= 0:
            s = s[idx + len(marker):]
    if '```' in s:
        parts = s.split('```')
        if len(parts) >= 3:
            inner = max(parts[1::2], key=len)
            if '镜号' in inner:
                s = inner
    s = s.strip()

    blocks: list[list[str]] = []
    cur: list[str] = []
    shot_no_re = re.compile(r'^\s*镜号\s*[::]')
    for line in s.split('\n'):
        if shot_no_re.match(line) and cur:
            blocks.append(cur)
            cur = [line]
        else:
            cur.append(line)
    if cur:
        blocks.append(cur)

    field_re = re.compile(
        r'^\s*(' + '|'.join(re.escape(cn) for cn, _ in _STORYBOARD_FIELDS) + r')\s*[::]\s*(.*)$'
    )
    rows: list[dict] = []
    for block in blocks:
        row: dict = {en: '' for _, en in _STORYBOARD_FIELDS}
        cur_key: str | None = None
        for line in block:
            m = field_re.match(line)
            if m:
                cur_key = _STORYBOARD_CN_TO_EN[m.group(1)]
                row[cur_key] = m.group(2).strip()
            elif cur_key and line.strip():
                row[cur_key] += '\n' + line.strip()
        if row.get('shot_no'):
            rows.append(row)
    return rows


def _shape_storyboard_from_llm(raw_text: str, seed_parts: tuple = ()) -> str | None:
    rows = _parse_shotlist_text(raw_text)
    if not rows:
        return None
    out: list[dict] = []
    for i, r in enumerate(rows):
        duration_raw = (r.get('duration') or '').strip()

        if duration_raw and not duration_raw.endswith('s'):
            duration_raw = duration_raw.rstrip('.') + 's'
        if not duration_raw:
            duration_raw = f'{2 + (i % 4)}s'

        prompt = (r.get('image_prompt') or r.get('scene_purpose') or '').strip()

        out.append({
            "shot_no":        str(r.get('shot_no') or i + 1),
            "duration":       duration_raw,
            "scene_purpose":  r.get('scene_purpose') or '',
            "character":      r.get('character') or '',
            "character_desc": r.get('character_desc') or '',
            "character_img":  r.get('character_img') or '',
            "reference_img":  r.get('reference_img') or '',
            "shot_size":      r.get('shot_size') or '',
            "action":         r.get('action') or '',
            "emotion":        r.get('emotion') or '',
            "scene_tags":     r.get('scene_tags') or '',
            "lighting":       r.get('lighting') or '',
            "sfx":            r.get('sfx') or '',
            "dialogue":       r.get('dialogue') or '',
            "prompt":         prompt,
            "image_prompt":   r.get('image_prompt') or prompt,
            "motion_prompt":  r.get('motion_prompt') or '',
            "image_url":      None,
        })
    if not out:
        return None

    _ = seed_parts
    return json.dumps({"shots": out}, ensure_ascii=False)
