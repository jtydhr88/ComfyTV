from __future__ import annotations

import pytest


@pytest.fixture()
def resource_font(reset_db, tmp_path, monkeypatch):
    import folder_paths

    from ComfyTV import storage

    monkeypatch.setattr(folder_paths, "get_input_directory",
                        lambda: str(tmp_path), raising=False)
    d = tmp_path / "comfytv" / "fonts"
    d.mkdir(parents=True)
    (d / "BrandSans.ttf").write_bytes(b"stub")
    (d / "Ignored.woff2").write_bytes(b"stub")
    (d / "missing.ttf")
    storage.register_resource(kind="font", name="BrandSans",
                            filename="BrandSans.ttf",
                            subfolder="comfytv/fonts")
    storage.register_resource(kind="font", name="WebOnly",
                            filename="Ignored.woff2",
                            subfolder="comfytv/fonts")
    storage.register_resource(kind="font", name="Gone",
                            filename="missing.ttf",
                            subfolder="comfytv/fonts")
    return d


class TestResourceFonts:
    def test_listed_first_and_resolvable(self, resource_font):
        from ComfyTV.runners.text_overlay import _font_path, list_fonts
        fonts = list_fonts()
        assert fonts[0] == "BrandSans"
        assert "WebOnly" not in fonts
        assert "Gone" not in fonts
        path = _font_path("BrandSans")
        assert path is not None and path.endswith("BrandSans.ttf")

    def test_bundled_fonts_still_present(self, resource_font):
        from ComfyTV.runners.text_overlay import list_fonts
        fonts = list_fonts()
        assert "NotoSansSC-Regular" in fonts
        assert "Inter-Regular" in fonts

    def test_unknown_name_falls_back(self, resource_font):
        from ComfyTV.runners.text_overlay import _font_path
        assert _font_path("nope-nope") is not None

    def test_storage_failure_degrades_gracefully(self, reset_db, monkeypatch):
        from ComfyTV import storage
        from ComfyTV.runners.text_overlay import _font_path, list_fonts

        def boom(kind=None):
            raise RuntimeError("db down")

        monkeypatch.setattr(storage, "list_resources", boom)
        assert "Inter-Regular" in list_fonts()
        assert _font_path("anything") is not None
