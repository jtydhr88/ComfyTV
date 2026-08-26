import logging

from ._common import *  # noqa: F401, F403

_log = logging.getLogger(__name__)

_TAG_KINDS = (
    ('images', 'Picture'),
    ('videos', 'Video'),
    ('audio', 'Audio'),
)

_CHAIN_MODES = ('off', 'prepend', 'replace')


def _parse_director_timeline(timeline_data: str) -> dict:
    try:
        data = json.loads(timeline_data) if timeline_data else {}
    except (ValueError, TypeError):
        raise RuntimeError(
            "Director timeline is corrupt — re-open the node and edit a clip "
            "to rewrite it."
        )
    if not isinstance(data, dict):
        data = {}
    clips = data.get('clips')
    data['clips'] = [c for c in clips if isinstance(c, dict)] if isinstance(clips, list) else []
    settings = data.get('settings')
    data['settings'] = settings if isinstance(settings, dict) else {}
    return data


def _chain_mode(settings: dict) -> str:
    mode = str(settings.get('chain') or '')
    if mode in _CHAIN_MODES:
        return mode
    return 'prepend' if settings.get('chain_last_frame') else 'off'


def _clip_refs(clip: dict) -> dict:
    out = {}
    for key in ('images', 'videos', 'audio'):
        vals = clip.get(key)
        out[key] = [str(v) for v in vals if v] if isinstance(vals, list) else []
    return out


def _clip_transition(clip: dict) -> tuple[str, float]:
    from ...runners.media_filter import XFADE_TRANSITIONS
    tr = str(clip.get('transition') or 'cut')
    if tr not in XFADE_TRANSITIONS:
        tr = 'cut'
    try:
        dur = float(clip.get('transition_s') or 1.0)
    except (TypeError, ValueError):
        dur = 1.0
    return tr, max(0.1, min(5.0, dur))


def _director_clip_hash(clip: dict, *, workflow: str, global_prompt: str,
                        options: dict, merged_refs: dict,
                        chain_mode: str = 'off') -> str:
    basis = {
        'workflow': workflow,
        'global_prompt': (global_prompt or '').strip(),
        'prompt': str(clip.get('prompt') or '').strip(),
        'duration_s': int(clip.get('duration_s') or 0),
        'seed': clip.get('seed'),
        'refs': merged_refs,
        'chained_frame': clip.get('_chained_frame') or '',
        'options': {k: options.get(k) for k in sorted(options) if k != '__server'},
    }
    if clip.get('_chained_frame'):
        basis['chain_mode'] = chain_mode
    return hashlib.sha256(
        json.dumps(basis, sort_keys=True).encode('utf-8')
    ).hexdigest()[:32]


def _mention_style_for(label: str) -> str:
    try:
        from ...runners import workflow_db
        cfg = workflow_db.get_workflow_config('video', label)
        return str(((cfg or {}).get('meta') or {}).get('mention_style') or '')
    except Exception:
        return ''


_ANY_TAG_RE = None


def _has_reference_tags(prompt: str) -> bool:
    global _ANY_TAG_RE
    if _ANY_TAG_RE is None:
        import re
        _ANY_TAG_RE = re.compile(r'<(?:Picture|Video|Audio)\s+\d+>')
    return bool(_ANY_TAG_RE.search(prompt))


def _reinforce_prompt(prompt: str, refs: dict, style: str) -> str:
    if style != 'minimax_tags':
        return prompt
    if _has_reference_tags(prompt):
        return prompt
    audio_offset = len(refs.get('videos') or [])
    tags = []
    for key, word in _TAG_KINDS:
        offset = audio_offset if key == 'audio' else 0
        for i in range(1, len(refs.get(key) or []) + 1):
            tags.append(f"<{word} {i + offset}>")
    if not tags:
        return prompt
    return " ".join(tags) + (" " + prompt if prompt else "")


def _cached_clip_url(project_id: str, clip_hash: str) -> str:
    try:
        row = storage.find_output_by_param(
            project_id or 'default', 'DirectorStage', 'director_clip_hash',
            clip_hash, output_type='video',
        )
    except Exception as e:
        _log.warning("[ComfyTV/director] cache lookup failed: %s", e)
        return ''
    url = str((row or {}).get('payload_url') or '')
    if not url:
        return ''
    try:
        from ...runners._media_paths import localize
        if not localize(url).exists():
            return ''
    except Exception:
        return ''
    return url


def _clip_images(refs: dict, chained_frame: str, chain_mode: str) -> list:
    if chained_frame and chain_mode == 'replace':
        return [chained_frame]
    frame = [chained_frame] if chained_frame and chain_mode != 'off' else []
    return frame + list(refs['images'])


def _assemble_with_transitions(urls: list, boundaries: list, progress=None) -> str:
    from ...runners.media import concat_videos
    from ...runners.media_filter import xfade_videos

    if len(urls) == 1:
        return urls[0]
    groups = [[urls[0]]]
    joins = []
    for i in range(1, len(urls)):
        tr, dur = boundaries[i - 1]
        if tr == 'cut':
            groups[-1].append(urls[i])
        else:
            joins.append((tr, dur))
            groups.append([urls[i]])

    def _render_group(g):
        if len(g) == 1:
            return g[0]
        return concat_videos(g, progress=progress)

    result = _render_group(groups[0])
    for gi in range(1, len(groups)):
        tr, dur = joins[gi - 1]
        nxt = _render_group(groups[gi])
        result = xfade_videos(result, nxt, transition=tr, duration=dur,
                              progress=progress)
    return result


class DirectorStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.DirectorStage",
            display_name="Director",
            category="ComfyTV/Generate",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('video') or [""],
                               default=default_for('video'),
                               tooltip="Default video workflow for clips. Each "
                                       "clip may override it in the timeline."),
                io.Combo.Input("resolution", options=RESOLUTIONS, default="720P",
                               tooltip="Output resolution tier shared by every clip."),
                io.Combo.Input("aspect_ratio", options=ASPECT_RATIOS, default="16:9",
                               tooltip="Output aspect ratio shared by every clip."),
                io.Boolean.Input("generate_audio", default=True,
                                 tooltip="Whether clip workflows should generate audio."),
                _main_prompt_input(tooltip="Global prompt — prefixed to every "
                                           "clip's own prompt."),
                io.String.Input("timeline_data", default="", socketless=True,
                                extra_dict={"hidden": True}, multiline=True,
                                tooltip="Serialized director timeline JSON — "
                                        "driven by the Vue panel."),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def _generate_clip(cls, *, index, total, clip, label, prompt, images,
                             refs, options, custom_params, project_id,
                             clip_hash):
        try:
            url = await invoke_runner(
                kind='video', label=label,
                main_prompt=prompt,
                upstream={
                    'texts': [],
                    'images': images,
                    'videos': refs['videos'],
                    'audio': refs['audio'],
                },
                options=options,
                custom_params=custom_params,
            )
        except Exception as e:
            raise RuntimeError(
                f"Director clip {index + 1}/{total} "
                f"({label!r}) failed: {e}. Fix the clip and Run again — "
                f"finished clips are cached and won't regenerate."
            ) from e
        _persist(
            cls=cls, project_id=project_id, output_type='video',
            payload_url=url,
            params={'director_clip_hash': clip_hash,
                    'clip_id': str(clip.get('id') or ''),
                    'workflow': label,
                    'prompt': str(prompt or '')},
        )
        return url

    @classmethod
    def _clip_spec(cls, *, index, total, clip, default_workflow, main_prompt,
                   base_options, chain_mode, chained_frame=''):
        if chained_frame:
            clip = {**clip, '_chained_frame': chained_frame}
        label = str(clip.get('workflow') or '').strip() or default_workflow
        own = _clip_refs(clip)
        images = _clip_images(own, chained_frame, chain_mode)
        refs = {
            'images': images,
            'videos': own['videos'],
            'audio': own['audio'],
        }
        options = {**base_options, 'duration_s': int(clip.get('duration_s') or 5)}
        seed = clip.get('seed')
        if seed is not None:
            options['seed'] = int(seed)
        clip_hash = _director_clip_hash(
            clip, workflow=label, global_prompt=main_prompt, options=options,
            merged_refs=refs, chain_mode=chain_mode)
        prompt = _combine_prompt(main_prompt, [str(clip.get('prompt') or '')],
                                 sep="\n")
        prompt = _reinforce_prompt(prompt, refs, _mention_style_for(label))
        return {
            'index': index, 'total': total, 'clip': clip, 'label': label,
            'refs': refs, 'options': options, 'images': images,
            'prompt': prompt, 'hash': clip_hash,
        }

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", resolution="", aspect_ratio="",
                      generate_audio=True, main_prompt="",
                      timeline_data="", custom_params="{}"):
        import comfy.model_management as mm

        plan = _parse_director_timeline(timeline_data)
        settings = plan['settings']
        clips = [c for c in plan['clips'] if c.get('enabled', True)]
        if not clips:
            raise RuntimeError(
                "Director timeline has no clips — add at least one clip in "
                "the timeline panel."
            )
        chain_mode = _chain_mode(settings)

        base_options = {
            'resolution': resolution,
            'aspect_ratio': aspect_ratio,
            'generate_audio': bool(generate_audio),
        }
        total = len(clips)

        def _progress(value, tot, text=""):
            mm.throw_exception_if_processing_interrupted()
            _emit_progress(cls, value, tot, text)

        from ...runners.media import extract_frame

        results: dict = {}
        cached_idx: set = set()
        all_specs: list = []
        chained_frame = ''
        for i, clip in enumerate(clips):
            _progress(i, total, f"clip {i + 1}/{total}")
            spec = cls._clip_spec(
                index=i, total=total, clip=clip, default_workflow=workflow,
                main_prompt=main_prompt, base_options=base_options,
                chain_mode=chain_mode, chained_frame=chained_frame)
            all_specs.append(spec)
            url = _cached_clip_url(project_id, spec['hash'])
            if url:
                cached_idx.add(i)
            else:
                url = await cls._generate_clip(
                    project_id=project_id, custom_params=custom_params,
                    clip_hash=spec['hash'],
                    **{k: spec[k] for k in
                       ('index', 'total', 'clip', 'label', 'prompt',
                        'images', 'refs', 'options')},
                )
            results[i] = url
            if chain_mode != 'off' and i < total - 1:
                chained_frame = extract_frame(url, 'last')

        clip_results = [{
            'id': str(clips[i].get('id') or ''),
            'url': results[i],
            'cached': i in cached_idx,
            'hash': next(s['hash'] for s in all_specs if s['index'] == i),
        } for i in range(total)]

        urls = [results[i] for i in range(total)]
        boundaries = [_clip_transition(clips[i]) for i in range(1, total)]
        _emit_progress(cls, total, total, text="assembling")
        final_url = _assemble_with_transitions(urls, boundaries,
                                               progress=_progress)

        return _stage_emit_auto(
            cls, project_id=project_id, payload_str=final_url,
            params={'director_clips': [r['hash'] for r in clip_results]},
            parent_output_id=parent_output_id,
            extra_ui={"director_clips": [json.dumps(clip_results)]},
        )
