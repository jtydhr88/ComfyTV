import logging

from ._common import *  # noqa: F401, F403

_log = logging.getLogger(__name__)


_SPEECH_LANGUAGES = [
    "Auto",
    "English", "English (British)", "Mandarin Chinese", "Japanese", "Korean",
    "French", "German", "Spanish", "Brazilian Portuguese", "Portuguese",
    "Italian", "Hindi", "Russian", "Arabic",
]

_ACE_TIME_SIGNATURES = ['2', '3', '4', '6']
_ACE_LANGUAGES = [
    'ar', 'az', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa',
    'fi', 'fr', 'he', 'hi', 'hr', 'ht', 'hu', 'id', 'is', 'it', 'ja', 'ko',
    'la', 'lt', 'ms', 'ne', 'nl', 'no', 'pa', 'pl', 'pt', 'ro', 'ru', 'sa',
    'sk', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tl', 'tr', 'uk', 'ur', 'vi',
    'yue', 'zh', 'unknown',
]
_ACE_KEYSCALES = [
    f"{root} {quality}"
    for quality in ["major", "minor"]
    for root in ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb",
                 "G", "G#", "Ab", "A", "A#", "Bb", "B"]
]


class ProjectStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ProjectStage",
            display_name="Project",
            category="ComfyTV/Project",
            inputs=[
                io.String.Input("project_id", default="", socketless=True,
                                tooltip="Bound to projectStore.currentProjectId. Persisted with the workflow."),
                io.String.Input("project_name", default="", socketless=True,
                                tooltip="Display label for the current project."),
                io.Int.Input("schema_version", default=COMFYTV_SCHEMA_VERSION,
                             min=0, max=2_147_483_647,
                             socketless=True, extra_dict={"hidden": True},
                             tooltip="ComfyTV workflow schema marker. Frontend warns if loaded ≠ current."),
            ],
            outputs=[],
            is_output_node=False,
        )

    @classmethod
    def execute(cls, project_id="", project_name="", schema_version=COMFYTV_SCHEMA_VERSION):
        return io.NodeOutput()


class TextStage(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.TextStage",
            display_name="Text Stage",
            category="ComfyTV/Generate",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('text') or [""],
                               default=TEXT_WORKFLOWS[0] if TEXT_WORKFLOWS else "",
                               tooltip="Which backend text workflow to invoke when Run is clicked. Placeholder for now."),
                _main_prompt_input(tooltip="Primary prompt — the user's intent for this stage. Upstream text inputs are treated as additional context."),
                io.Autogrow.Input("texts",  template=_text_template(8)),
                io.Autogrow.Input("images", template=_image_template(8)),
                io.Autogrow.Input("videos", template=_video_template(4)),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_TEXT.Output("text")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,workflow="", main_prompt="",
                texts=None, images=None, videos=None, custom_params="{}"):

        text_vals = _autogrow_values(texts)
        combined_prompt = _combine_prompt(main_prompt, text_vals, sep="\n")
        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='text',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=combined_prompt,
            upstream={
                'texts':  text_vals,
                'images': _autogrow_values(images),
                'videos': _autogrow_values(videos),
            },
            options={},
        )


class ImageStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ImageStage",
            display_name="Image Stage",
            category="ComfyTV/Generate",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('image') or [""],
                               default=IMAGE_WORKFLOWS[0] if IMAGE_WORKFLOWS else "",
                               tooltip="Which backend image workflow to invoke when Run is clicked. Placeholder for now."),
                io.Combo.Input("resolution", options=RESOLUTIONS, default="1K",
                               tooltip="Target output resolution tier (the short side, in px). Combined with the aspect ratio to compute (w, h)."),
                io.Combo.Input("aspect_ratio", options=ASPECT_RATIOS, default="1:1",
                               tooltip="Target output aspect ratio. Combined with resolution to compute actual (w, h) downstream."),
                io.Int.Input("batch_size", default=1, min=1, max=8, step=1,
                             display_mode=io.NumberDisplay.slider,
                             tooltip="How many images to generate per Run. The wrapped workflow's sampler runs once and emits this many samples."),
                _main_prompt_input(tooltip="Primary prompt — the user's intent for this stage. Upstream text inputs are treated as additional context."),
                io.Autogrow.Input("texts",  template=_text_template(8)),
                io.Autogrow.Input("images", template=_image_template(12)),
                _selected_index_input(),
                _custom_params_input(),
            ],

            outputs=[COMFYTV_IMAGES.Output("images"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,workflow="", resolution="",
                aspect_ratio="", batch_size=1, main_prompt="", texts=None, images=None,
                selected_index=1, custom_params="{}"):

        text_vals = _autogrow_values(texts)
        combined_prompt = _combine_prompt(main_prompt, text_vals)
        payload = await invoke_runner(
            kind='image',
            label=workflow,
            main_prompt=combined_prompt,
            upstream={
                'texts':  text_vals,
                'images': _autogrow_values(images),
            },
            options={
                'resolution':   resolution,
                'aspect_ratio': aspect_ratio,
                'batch_size':   int(batch_size or 1),
            },
            custom_params=custom_params,
        )
        picked_idx = int(selected_index or 1)
        picked_url = _pick_image_from_batch(payload, picked_idx)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                picked_payload=picked_url, picked_index=picked_idx)


class VideoStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.VideoStage",
            display_name="Video Stage",
            category="ComfyTV/Generate",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('video') or [""],
                               default=VIDEO_WORKFLOWS[0] if VIDEO_WORKFLOWS else "",
                               tooltip="Which backend video workflow to invoke when Run is clicked. Placeholder for now."),
                io.Combo.Input("resolution", options=RESOLUTIONS, default="720P",
                               tooltip="Target output resolution tier (the short side, in px). Combined with the aspect ratio to compute (w, h)."),
                io.Combo.Input("aspect_ratio", options=ASPECT_RATIOS, default="16:9",
                               tooltip="Target output aspect ratio. Combined with resolution to compute actual (w, h) downstream."),
                io.Int.Input("duration_s", default=VIDEO_DURATION_DEFAULT_S,
                             min=VIDEO_DURATION_MIN_S, max=VIDEO_DURATION_MAX_S, step=1,
                             display_mode=io.NumberDisplay.slider,
                             tooltip="Target clip duration in seconds. The wrapped workflow picks fps and frame count."),
                io.Boolean.Input("generate_audio", default=False,
                                 tooltip="Whether the wrapped workflow should generate an audio track alongside video."),
                _main_prompt_input(tooltip="Primary prompt — the user's intent for this stage. Upstream text inputs are treated as additional context."),
                io.Autogrow.Input("texts",  template=_text_template(6)),
                io.Autogrow.Input("images", template=_image_template(8)),
                io.Autogrow.Input("videos", template=_video_template(4)),

                COMFYTV_AUDIO.Input("audio", optional=True),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,workflow="", resolution="",
                aspect_ratio="", duration_s=VIDEO_DURATION_DEFAULT_S,
                generate_audio=False, main_prompt="",
                texts=None, images=None, videos=None, audio="", custom_params="{}"):

        text_vals = _autogrow_values(texts)
        combined_prompt = _combine_prompt(main_prompt, text_vals)
        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='video',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=combined_prompt,
            upstream={
                'texts':  text_vals,
                'images': _autogrow_values(images),
                'videos': _autogrow_values(videos),
                'audio':  audio,
            },
            options={
                'resolution':     resolution,
                'aspect_ratio':   aspect_ratio,
                'duration_s':     duration_s,
                'generate_audio': generate_audio,
            },
        )


class AudioStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.AudioStage",
            display_name="Music Stage",
            category="ComfyTV/Generate",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('audio'),
                               default=AUDIO_WORKFLOWS[0] if AUDIO_WORKFLOWS else "",
                               tooltip="Audio generation backend."),
                _main_prompt_input(placeholder="Tags / genre / mood / BPM (e.g. 'lo-fi, jazz piano, rainy, 90bpm')", ),
                io.String.Input("lyrics", default="", multiline=True,
                                extra_dict={"placeholder": "Leave empty for instrumental. Type lyrics for a vocal track."},
                                tooltip="Optional lyrics — non-empty triggers vocal generation."),
                io.Float.Input("duration_s", default=30.0, min=1.0, max=240.0, step=1.0,
                               display_mode=io.NumberDisplay.slider,
                               tooltip="Length of generated audio in seconds."),
                io.Int.Input("bpm", default=120, min=10, max=300, step=1,
                             tooltip="Tempo in beats per minute (ACE-Step 1.5)."),
                io.Combo.Input("timesignature", options=_ACE_TIME_SIGNATURES, default='4',
                               tooltip="Time signature — beats per bar (ACE-Step 1.5)."),
                io.Combo.Input("keyscale", options=_ACE_KEYSCALES, default='C major',
                               tooltip="Musical key and scale, e.g. 'C major' / 'A minor' (ACE-Step 1.5)."),
                io.Combo.Input("language", options=_ACE_LANGUAGES, default='en',
                               tooltip="Lyrics language code (ACE-Step 1.5)."),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", main_prompt="", duration_s=30.0, lyrics="",
                      bpm=120, timesignature='4', keyscale='C major', language='en',
                      custom_params="{}"):
        return await run_stage_workflow(
            cls,
            kind='audio',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=(main_prompt or '').strip(),
            upstream={},
            options={
                'duration_s':     float(duration_s or 30.0),
                'lyrics':         (lyrics or '').strip(),
                'bpm':            int(bpm or 120),
                'timesignature':  str(timesignature or '4'),
                'keyscale':       (keyscale or 'C major'),
                'language':       (language or 'en'),
            },
            custom_params=custom_params,
        )


class SpeechStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.SpeechStage",
            display_name="Speech Stage",
            category="ComfyTV/Generate",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('speech'),
                               default=SPEECH_WORKFLOWS[0] if SPEECH_WORKFLOWS else "",
                               tooltip="Text-to-speech backend."),
                _main_prompt_input(placeholder="The text to speak — type the script / lines for the voice to read aloud."),
                io.String.Input("voice", default="", multiline=False,
                                extra_dict={"placeholder": "Preset voice / speaker id (leave empty when cloning from a reference clip)."},
                                tooltip="Named preset voice for preset-voice models (Kokoro, Bark, ElevenLabs, …)."),
                io.Combo.Input("language", options=_SPEECH_LANGUAGES, default="Auto",
                               tooltip="Language for multilingual models. 'Auto' lets the workflow/model default decide; "
                                       "ignored by single-language / auto-detect models. Note: names must match what the "
                                       "selected model expects (e.g. Kokoro uses 'Mandarin Chinese')."),
                io.Float.Input("speed", default=1.0, min=0.5, max=2.0, step=0.05,
                               display_mode=io.NumberDisplay.slider,
                               tooltip="Speaking rate (1.0 = natural)."),
                io.String.Input("reference_text", default="", multiline=True,
                                extra_dict={"placeholder": "Transcript of the reference voice clip (needed by F5-TTS / GPT-SoVITS cloning)."},
                                tooltip="Transcript of the reference audio; auto-transcribing cloners can leave it empty."),
                COMFYTV_AUDIO.Input("reference_audio", optional=True),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_AUDIO.Output("audio")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", main_prompt="", voice="", language="Auto",
                      speed=1.0, reference_text="", reference_audio="",
                      custom_params="{}"):
        lang = "" if (language or "Auto") == "Auto" else language
        return await run_stage_workflow(
            cls,
            kind='speech',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=(main_prompt or '').strip(),
            upstream={
                'audio': reference_audio,
            },
            options={
                'voice':          (voice or '').strip(),
                'language':       lang.strip(),
                'speed':          float(speed or 1.0),
                'reference_text': (reference_text or '').strip(),
            },
            custom_params=custom_params,
        )


class ImagePickerStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ImagePickerStage",
            display_name="Image Picker",
            category="ComfyTV/Compose",
            inputs=[
                _project_id_input(),
                _parent_output_id_input(),

                io.Int.Input("selected_index", default=1, min=1, max=999, step=1,
                             socketless=True,
                             extra_dict={"hidden": True},
                             tooltip="Which item to extract (1-indexed). Hidden — set by clicking a thumbnail."),
                io.String.Input("pool", default="", multiline=False,
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Accumulated image pool (JSON {images:[...]}). Managed by the UI: "
                                        "new upstream batches are appended (deduped by image_url) and survive "
                                        "regeneration/disconnect; emptied by the Clear button."),
                io.MultiType.Input("batch", [COMFYTV_IMAGES, COMFYTV_IMAGE], optional=True,
                                   tooltip="Upstream image source. Accepts either a batch (COMFYTV_IMAGES) "
                                           "or a single image (COMFYTV_IMAGE); a single image is treated as "
                                           "a one-item batch."),
            ],
            outputs=[COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def execute(cls, project_id="", parent_output_id=0, selected_index=1, pool="", batch=None):
        source = pool if (pool or "").strip() else batch
        payload = _pick_image_from_batch(source, int(selected_index or 1))
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                emit_ui=False, parent_output_id=parent_output_id)


class ShotImagesStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ShotImagesStage",
            display_name="Shot Images",
            category="ComfyTV/Compose",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow",
                               options=labels_for('shot-images') or [""],
                               default=SHOT_IMAGES_WORKFLOWS[0] if SHOT_IMAGES_WORKFLOWS else "",
                               tooltip="Image-generation workflow to use for each shot."),
                io.Combo.Input("resolution", options=RESOLUTIONS, default="1K",
                               tooltip="Target output resolution tier for every shot (the short side, in px)."),
                io.Combo.Input("aspect_ratio", options=ASPECT_RATIOS, default="1:1",
                               tooltip="Target output aspect ratio for every shot."),
                COMFYTV_STORYBOARD.Input("storyboard", optional=True),
                io.Autogrow.Input("images", template=_image_template(8)),
                _selected_index_input(),
                _custom_params_input(),
            ],

            outputs=[COMFYTV_IMAGES.Output("images"), COMFYTV_IMAGE.Output("image")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", resolution="", aspect_ratio="",
                      storyboard=None, images=None, selected_index=1, custom_params="{}"):

        shots: list[dict] = []
        if storyboard:
            try:
                data = json.loads(storyboard) if isinstance(storyboard, str) else storyboard
                if isinstance(data, dict) and isinstance(data.get("shots"), list):
                    shots = data["shots"]
            except (ValueError, TypeError):
                shots = []

        runner = RUNNER_REGISTRY.by_label(workflow, 'image')
        if runner is None:
            raise StageRunnerMissing(
                f"no runner registered for image/{workflow!r} — was the workflow "
                f"added or renamed after startup? (restart ComfyUI to pick up new "
                f"workflow files, or re-open the workflow in the sidebar editor)"
            )
        shared_refs = _autogrow_values(images)
        out_images: list[dict] = []
        any_real = False

        for i, shot in enumerate(shots):
            shot_no = shot.get("shot_no", str(i + 1))
            prompt = str(shot.get("prompt") or shot.get("image_prompt") or "").strip()
            _emit_progress(cls, i, len(shots),
                           text=f"shot {i + 1}/{len(shots)}: {prompt[:40]}")
            shot_payload = None
            if runner is not None and prompt:
                try:
                    ctx = RunnerContext(
                        kind='image',
                        main_prompt=prompt,
                        upstream={'texts': [], 'images': shared_refs},
                        options={
                            'resolution':   resolution,
                            'aspect_ratio': aspect_ratio,
                            'batch_size':   1,
                        },
                    )
                    shot_payload = await runner.invoke(ctx)
                except NotImplementedError:
                    shot_payload = None
                except Exception as e:
                    _log.warning("[ComfyTV/shot-images] shot %s failed: %s", shot_no, e)
                    shot_payload = None

            if shot_payload:
                any_real = True
                try:
                    parsed = json.loads(shot_payload) if isinstance(shot_payload, str) else shot_payload
                    for img in (parsed.get("images") if isinstance(parsed, dict) else None) or []:
                        out_images.append({
                            "index":     shot_no,
                            "label":     f"Shot {shot_no}",
                            "prompt":    prompt,
                            "image_url": img.get("image_url"),
                        })
                except (ValueError, TypeError):
                    pass

        _emit_progress(cls, len(shots), len(shots), text="done")

        if not any_real or not out_images:
            raise RuntimeError(
                f"ShotImagesStage: workflow {workflow!r} returned no shots")
        payload = json.dumps({"images": out_images})
        picked_idx = int(selected_index or 1)
        picked_url = _pick_image_from_batch(payload, picked_idx)
        return _stage_emit_auto(cls, project_id=project_id, payload_str=payload,
                                parent_output_id=parent_output_id,
                                picked_payload=picked_url, picked_index=picked_idx)

class StoryboardStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.StoryboardStage",
            display_name="Storyboard",
            category="ComfyTV/Generate",
            inputs=[
                *_standard_stage_inputs(),
                io.Combo.Input("workflow", options=labels_for('storyboard') or [""],
                               default=STORYBOARD_WORKFLOWS[0] if STORYBOARD_WORKFLOWS else "",
                               tooltip="LLM backend that produces the 16-field shot list."),
                _main_prompt_input(placeholder="故事大纲 / Story premise — one to a few sentences describing the scene's beats.", tooltip="The story / scene premise the LLM expands into a shot list."),
                io.Int.Input("total_duration_s", default=30, min=2, max=600, step=1,
                             tooltip="Target total duration of the shot list in seconds. Per-shot durations should sum to this."),
                io.Int.Input("shot_count", default=6, min=1, max=25, step=1,
                             display_mode=io.NumberDisplay.slider,
                             tooltip="Exact number of shots to produce. The LLM is instructed to honor this strictly."),
                io.String.Input("characters", default="", multiline=True,
                                extra_dict={"placeholder": "Optional — one character per line, e.g.\n- 林岳_赛车手: 32岁男性,身材精悍,五官棱角分明,蓄短络腮胡,穿白色赛车手赛服"},
                                tooltip="Known character cards. One per line. Each shot referencing a character will repeat its full description for prompt-independence."),
                io.String.Input("storyboard_data", default="",
                                socketless=True, extra_dict={"hidden": True},
                                tooltip="Serialized shot list (JSON). Driven by the shot-board editor."),
                io.Autogrow.Input("texts", template=_text_template(6)),
                _custom_params_input(),
            ],
            outputs=[COMFYTV_STORYBOARD.Output("storyboard")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    async def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                      workflow="", main_prompt="", total_duration_s=30, shot_count=6,
                      characters="", storyboard_data="", texts=None, custom_params="{}"):

        text_vals = _autogrow_values(texts)
        premise = _combine_prompt(main_prompt, text_vals, sep="\n")
        composed_prompt = _storyboard_llm_prompt(
            premise,
            total_duration_s=int(total_duration_s or 30),
            shot_count=int(shot_count or 6),
            characters=characters or '',
        )
        return await run_stage_workflow(
            cls,
            custom_params=custom_params,
            kind='storyboard',
            label=workflow,
            project_id=project_id,
            parent_output_id=parent_output_id,
            main_prompt=composed_prompt,
            upstream={},
            options={'max_length': 6144},
            transform=lambda raw: _shape_storyboard_from_llm(str(raw or '')),
        )

