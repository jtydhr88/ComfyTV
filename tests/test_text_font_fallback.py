from __future__ import annotations

import pytest

PIL = pytest.importorskip("PIL")


@pytest.fixture()
def fonts():
    from PIL import ImageFont

    from ComfyTV.runners.text_overlay import _ASSET_FONTS
    inter = ImageFont.truetype(str(_ASSET_FONTS / "Inter-Regular.ttf"), 36)
    noto = ImageFont.truetype(str(_ASSET_FONTS / "NotoSansSC-Regular.ttf"), 36)
    return inter, noto


class TestFontRuns:
    def test_missing_glyphs_go_to_fallback(self, fonts):
        from ComfyTV.runners.text_overlay import _font_runs
        inter, noto = fonts
        lines = _font_runs("Hi 中文 ok\n标题", inter, noto)
        assert [[(t, f is noto) for t, f in runs] for runs in lines] == [
            [("Hi ", False), ("中文", True), (" ok", False)],
            [("标题", True)],
        ]

    def test_covered_text_stays_on_chosen_font(self, fonts):
        from ComfyTV.runners.text_overlay import _font_runs
        inter, noto = fonts
        lines = _font_runs("Custom Font Test", inter, noto)
        assert all(f is inter for runs in lines for _, f in runs)


class TestRenderFallback:
    def test_latin_only_text_keeps_original_path(self, monkeypatch):
        from ComfyTV.runners import text_overlay

        def boom(*a, **k):
            raise AssertionError("fallback renderer should not be used")

        monkeypatch.setattr(text_overlay, "_render_runs_rgba", boom)
        out = text_overlay.render_text_rgba("Hello", font="Inter-Regular", size=36)
        assert out[..., 3].any()

    def test_cjk_with_latin_font_renders_real_glyphs(self):
        from ComfyTV.runners.text_overlay import render_text_rgba
        mixed = render_text_rgba("Title 自定义", font="Inter-Regular", size=36, stroke=2)
        cjk = render_text_rgba("自定义", font="NotoSansSC-Regular", size=36, stroke=2)
        latin = render_text_rgba("Title ", font="Inter-Regular", size=36, stroke=2)
        assert mixed.shape[2] == 4 and mixed[..., 3].any()
        assert mixed.shape[1] >= latin.shape[1] + cjk.shape[1] - 12
        assert mixed[:, -cjk.shape[1] // 2:, 3].any()

    def test_multiline_and_alignment(self):
        from ComfyTV.runners.text_overlay import render_text_rgba
        one = render_text_rgba("中文 A", font="Inter-Regular", size=36)
        two = render_text_rgba("中文 A\n\n中文 A", font="Inter-Regular", size=36)
        assert two.shape[0] > 2 * one.shape[0]
        left = render_text_rgba("中文 AAAAAA\n中", font="Inter-Regular", size=36, align="left")
        right = render_text_rgba("中文 AAAAAA\n中", font="Inter-Regular", size=36, align="right")
        h = left.shape[0]
        assert left[h // 2:, :left.shape[1] // 3, 3].any()
        assert right[h // 2:, -right.shape[1] // 3:, 3].any()
