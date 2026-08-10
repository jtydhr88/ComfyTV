import pytest

import folder_paths
from ComfyTV.runners._media_paths import (
    strip_filename_annotation,
    view_url_to_path,
)


class TestStripFilenameAnnotation:
    def test_no_annotation_keeps_type(self):
        assert strip_filename_annotation("a.png", "input") == ("a.png", "input")

    @pytest.mark.parametrize("suffix", ["output", "input", "temp"])
    def test_annotation_overrides_type(self, suffix):
        got = strip_filename_annotation(f"a.png [{suffix}]", "input")
        assert got == ("a.png", suffix)


class TestViewUrlToPath:
    @pytest.fixture()
    def fs(self, tmp_path, monkeypatch):
        dirs = {}
        for t in ("output", "input", "temp"):
            d = tmp_path / t
            d.mkdir()
            dirs[t] = d
        monkeypatch.setattr(
            folder_paths, "get_directory_by_type",
            lambda t: str(dirs[t]) if t in dirs else None, raising=False,
        )
        return dirs

    def test_plain_type_param(self, fs):
        (fs["input"] / "a.png").write_bytes(b"x")
        got = view_url_to_path("/view?filename=a.png&type=input")
        assert got == fs["input"] / "a.png"

    def test_filename_annotation_overrides_type(self, fs):
        (fs["output"] / "z.png").write_bytes(b"x")
        got = view_url_to_path("/view?filename=z.png+%5Boutput%5D&type=input")
        assert got == fs["output"] / "z.png"

    def test_annotation_with_subfolder(self, fs):
        sub = fs["temp"] / "runs"
        sub.mkdir()
        (sub / "b.mp4").write_bytes(b"x")
        got = view_url_to_path(
            "/view?filename=b.mp4+%5Btemp%5D&subfolder=runs&type=input"
        )
        assert got == sub / "b.mp4"

    def test_missing_file_returns_none(self, fs):
        assert view_url_to_path("/view?filename=nope.png&type=input") is None

    def test_unknown_type_returns_none(self, fs):
        assert view_url_to_path("/view?filename=a.png&type=bogus") is None

    def test_escape_raises(self, fs):
        (fs["input"] / "a.png").write_bytes(b"x")
        with pytest.raises(ValueError, match="escapes"):
            view_url_to_path("/view?filename=..%2Finput%2Fa.png&type=output")
