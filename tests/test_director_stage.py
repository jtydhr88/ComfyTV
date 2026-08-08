import json

import pytest

from ComfyTV.nodes.stages import director as dstage
from ComfyTV.nodes.stages.director import (
    DirectorStage,
    _clip_refs,
    _director_clip_hash,
    _parse_director_timeline,
    _reinforce_prompt,
)


def _timeline(clips, settings=None):
    return json.dumps({"version": 1, "clips": clips,
                       "settings": settings or {}})


def _clip(i, **kw):
    base = {"id": f"c{i}", "prompt": f"scene {i}", "duration_s": 3}
    base.update(kw)
    return base


class TestParseTimeline:
    def test_empty_string_gives_empty_plan(self):
        plan = _parse_director_timeline("")
        assert plan["clips"] == []
        assert plan["settings"] == {}

    def test_corrupt_json_raises(self):
        with pytest.raises(RuntimeError, match="corrupt"):
            _parse_director_timeline("{not json")

    def test_non_dict_clips_filtered(self):
        plan = _parse_director_timeline(json.dumps(
            {"clips": [{"id": "a"}, "junk", 3, None], "settings": "junk"}))
        assert plan["clips"] == [{"id": "a"}]
        assert plan["settings"] == {}


class TestClipRefs:
    def test_missing_keys_default_empty(self):
        assert _clip_refs({}) == {"images": [], "videos": [], "audio": []}

    def test_drops_falsy_entries(self):
        refs = _clip_refs({"images": ["/a", "", None], "videos": "junk"})
        assert refs["images"] == ["/a"]
        assert refs["videos"] == []


class TestClipHash:
    def _hash(self, clip=None, **kw):
        c = clip or _clip(1)
        args = {"workflow": "wf", "global_prompt": "g",
                "options": {"resolution": "480P"},
                "merged_refs": _clip_refs(c)}
        args.update(kw)
        return _director_clip_hash(c, **args)

    def test_stable(self):
        assert self._hash() == self._hash()

    def test_sensitive_to_prompt(self):
        assert self._hash() != self._hash(clip=_clip(1, prompt="other"))

    def test_sensitive_to_seed_refs_workflow_options(self):
        base = self._hash()
        assert base != self._hash(clip=_clip(1, seed=7))
        assert base != self._hash(clip=_clip(1, images=["/x"]))
        assert base != self._hash(workflow="wf2")
        assert base != self._hash(options={"resolution": "720P"})

    def test_sensitive_to_chained_frame(self):
        assert self._hash() != self._hash(clip=_clip(1, _chained_frame="/f"))


class TestReinforcePrompt:
    def test_non_minimax_style_untouched(self):
        assert _reinforce_prompt("p", {"images": ["/a"]}, "") == "p"

    def test_injects_tags_for_each_ref(self):
        out = _reinforce_prompt(
            "walk", {"images": ["/a", "/b"], "videos": ["/v"], "audio": []},
            "minimax_tags")
        assert out == "<Picture 1> <Picture 2> <Video 1> walk"

    def test_manual_tags_respected_no_injection(self):
        out = _reinforce_prompt(
            "<Picture 1> walk", {"images": ["/a", "/b"]}, "minimax_tags")
        assert out == "<Picture 1> walk"

    def test_any_tag_kind_counts_as_manual_control(self):
        out = _reinforce_prompt(
            "follow <Video 1>", {"images": ["/a"], "videos": ["/v"]},
            "minimax_tags")
        assert out == "follow <Video 1>"

    def test_no_refs_no_change(self):
        assert _reinforce_prompt("p", {}, "minimax_tags") == "p"

    def test_audio_ordinals_offset_by_video_soundtracks(self):
        out = _reinforce_prompt(
            "sing", {"videos": ["/v1", "/v2"], "audio": ["/a"]},
            "minimax_tags")
        assert out == "<Video 1> <Video 2> <Audio 3> sing"

    def test_audio_offset_zero_without_videos(self):
        out = _reinforce_prompt("sing", {"audio": ["/a", "/b"]}, "minimax_tags")
        assert out == "<Audio 1> <Audio 2> sing"


@pytest.fixture()
def director_env(monkeypatch, tmp_path):
    calls = []

    async def fake_invoke(**kw):
        calls.append(kw)
        return f"/view?filename=clip{len(calls)}.mp4"

    concats = []

    def fake_concat(urls, progress=None):
        concats.append(list(urls))
        return "/view?filename=final.mp4"

    frames = []

    def fake_extract(url, position="last"):
        frames.append((url, position))
        return f"/view?filename=frame-of-{url.rsplit('=', 1)[-1]}.png"

    xfades = []

    def fake_xfade(a, b, transition="fade", duration=1.0, progress=None):
        xfades.append((a, b, transition, duration))
        return f"/view?filename=xfade{len(xfades)}.mp4"

    import ComfyTV.runners.media as media
    import ComfyTV.runners.media_filter as media_filter
    import ComfyTV.runners._media_paths as mp
    monkeypatch.setattr(dstage, "invoke_runner", fake_invoke)
    monkeypatch.setattr(dstage, "_mention_style_for", lambda label: "")
    monkeypatch.setattr(media, "concat_videos", fake_concat)
    monkeypatch.setattr(media, "extract_frame", fake_extract)
    monkeypatch.setattr(media_filter, "xfade_videos", fake_xfade)

    real_file = tmp_path / "clip.mp4"
    real_file.write_bytes(b"x")
    monkeypatch.setattr(mp, "localize", lambda url: real_file)

    return {"calls": calls, "concats": concats, "frames": frames,
            "xfades": xfades}


@pytest.mark.asyncio
class TestDirectorExecute:

    async def test_two_clips_invoke_and_concat_in_order(self, reset_db, director_env):
        out = await DirectorStage.execute(
            project_id="default", workflow="WF", resolution="480P",
            aspect_ratio="16:9", generate_audio=True, main_prompt="global",
            timeline_data=_timeline([_clip(1), _clip(2, duration_s=7)]),
        )
        calls = director_env["calls"]
        assert len(calls) == 2
        assert calls[0]["label"] == "WF"
        assert calls[0]["main_prompt"] == "global\nscene 1"
        assert calls[0]["options"]["duration_s"] == 3
        assert calls[1]["options"]["duration_s"] == 7
        assert director_env["concats"] == [
            ["/view?filename=clip1.mp4", "/view?filename=clip2.mp4"]]
        assert out.values[0] == "/view?filename=final.mp4"
        clips_ui = json.loads(out.ui["director_clips"][0])
        assert [c["cached"] for c in clips_ui] == [False, False]

    async def test_single_clip_skips_concat(self, reset_db, director_env):
        out = await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline([_clip(1)]),
        )
        assert director_env["concats"] == []
        assert out.values[0] == "/view?filename=clip1.mp4"

    async def test_second_run_hits_cache(self, reset_db, director_env):
        tl = _timeline([_clip(1), _clip(2)])
        await DirectorStage.execute(project_id="default", workflow="WF",
                                    timeline_data=tl)
        assert len(director_env["calls"]) == 2

        out = await DirectorStage.execute(project_id="default", workflow="WF",
                                          timeline_data=tl)
        assert len(director_env["calls"]) == 2
        clips_ui = json.loads(out.ui["director_clips"][0])
        assert [c["cached"] for c in clips_ui] == [True, True]

    async def test_edited_clip_regenerates_only_itself(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline([_clip(1), _clip(2)]))
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline([_clip(1), _clip(2, prompt="edited")]))
        assert len(director_env["calls"]) == 3
        assert director_env["calls"][2]["main_prompt"].endswith("edited")

    async def test_per_clip_workflow_override(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="Default WF",
            timeline_data=_timeline([_clip(1, workflow="Special WF"), _clip(2)]))
        assert director_env["calls"][0]["label"] == "Special WF"
        assert director_env["calls"][1]["label"] == "Default WF"

    async def test_chain_last_frame_feeds_next_clip(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline(
                [_clip(1), _clip(2, images=["/view?filename=ref.png"])],
                settings={"chain_last_frame": True}),
        )
        assert director_env["frames"] == [("/view?filename=clip1.mp4", "last")]
        second = director_env["calls"][1]
        assert second["upstream"]["images"] == [
            "/view?filename=frame-of-clip1.mp4.png", "/view?filename=ref.png"]

    async def test_disabled_clips_skipped(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline([_clip(1, enabled=False), _clip(2)]))
        assert len(director_env["calls"]) == 1
        assert director_env["calls"][0]["main_prompt"].endswith("scene 2")

    async def test_empty_timeline_raises(self, reset_db, director_env):
        with pytest.raises(RuntimeError, match="no clips"):
            await DirectorStage.execute(project_id="default", workflow="WF",
                                        timeline_data="")

    async def test_clip_failure_names_clip_and_keeps_cache_hint(
            self, reset_db, director_env, monkeypatch):
        async def boom(**kw):
            if kw["main_prompt"].endswith("scene 2"):
                raise RuntimeError("sampler exploded")
            director_env["calls"].append(kw)
            return "/view?filename=ok.mp4"

        monkeypatch.setattr(dstage, "invoke_runner", boom)
        with pytest.raises(RuntimeError, match=r"clip 2/2.*cached"):
            await DirectorStage.execute(
                project_id="default", workflow="WF",
                timeline_data=_timeline([_clip(1), _clip(2)]))

    async def test_seed_forwarded_to_options(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline([_clip(1, seed=1234)]))
        assert director_env["calls"][0]["options"]["seed"] == 1234

    async def test_refs_forwarded_to_upstream(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline([_clip(
                1, images=["/i.png"], videos=["/v.mp4"], audio=["/a.flac"])]))
        up = director_env["calls"][0]["upstream"]
        assert up["images"] == ["/i.png"]
        assert up["videos"] == ["/v.mp4"]
        assert up["audio"] == ["/a.flac"]

    async def test_chain_replace_mode_swaps_clip_images(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline(
                [_clip(1), _clip(2, images=["/view?filename=ref.png"])],
                settings={"chain": "replace"}),
        )
        second = director_env["calls"][1]
        assert second["upstream"]["images"] == [
            "/view?filename=frame-of-clip1.mp4.png"]

    async def test_transitions_fold_with_xfade(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline([
                _clip(1),
                _clip(2, transition="fade", transition_s=0.5),
                _clip(3),
            ]))
        assert director_env["concats"] == [
            ["/view?filename=clip2.mp4", "/view?filename=clip3.mp4"]]
        assert director_env["xfades"] == [
            ("/view?filename=clip1.mp4", "/view?filename=final.mp4",
             "fade", 0.5)]

    async def test_unknown_transition_treated_as_cut(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline([
                _clip(1), _clip(2, transition="sparkle-explosion"),
            ]))
        assert director_env["xfades"] == []
        assert len(director_env["concats"]) == 1

    async def test_legacy_chain_last_frame_still_chains(self, reset_db, director_env):
        await DirectorStage.execute(
            project_id="default", workflow="WF",
            timeline_data=_timeline(
                [_clip(1), _clip(2)],
                settings={"chain_last_frame": True}),
        )
        assert director_env["frames"] == [("/view?filename=clip1.mp4", "last")]

