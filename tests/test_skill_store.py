from __future__ import annotations

from pathlib import Path

import pytest

from ComfyTV import skill_store


def make_skill(root: Path, dirname: str, *, name: str | None = None,
               description: str = "Does useful things",
               body: str = "# Guide\n\nDo the thing.\n") -> Path:
    d = root / dirname
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text(
        f"---\nname: {name or dirname}\ndescription: {description}\n---\n\n{body}",
        encoding="utf-8")
    return d


@pytest.fixture()
def skill_dirs(tmp_path, monkeypatch, reset_db):
    builtin = tmp_path / "builtin-skills"
    user = tmp_path / "user-skills"
    builtin.mkdir()
    user.mkdir()
    monkeypatch.setattr(skill_store, "BUILTIN_SKILLS_DIR", builtin)
    monkeypatch.setattr(skill_store, "user_skills_dir", lambda: user)
    return builtin, user


class TestParseFrontmatter:
    def test_valid(self):
        meta, body = skill_store.parse_frontmatter(
            "---\nname: a-b\ndescription: hi\n---\nBody here\n")
        assert meta == {"name": "a-b", "description": "hi"}
        assert body == "Body here\n"

    def test_no_frontmatter(self):
        meta, body = skill_store.parse_frontmatter("# Just markdown\n")
        assert meta is None
        assert body == "# Just markdown\n"

    def test_unclosed(self):
        meta, _ = skill_store.parse_frontmatter("---\nname: x\nno closing\n")
        assert meta is None

    def test_bad_yaml(self):
        meta, _ = skill_store.parse_frontmatter("---\n\t{unparsable\n---\nx\n")
        assert meta is None


class TestScan:
    def test_merge_and_sources(self, skill_dirs):
        builtin, user = skill_dirs
        make_skill(builtin, "alpha")
        make_skill(user, "beta")
        entries = {e["name"]: e for e in skill_store.scan()}
        assert entries["alpha"]["source"] == "builtin"
        assert entries["beta"]["source"] == "user"
        assert entries["alpha"]["valid"] and entries["alpha"]["enabled"]

    def test_user_overrides_builtin(self, skill_dirs):
        builtin, user = skill_dirs
        make_skill(builtin, "alpha", description="builtin version")
        make_skill(user, "alpha", description="user version")
        entries = [e for e in skill_store.scan() if e["name"] == "alpha"]
        assert len(entries) == 1
        assert entries[0]["source"] == "user"
        assert entries[0]["description"] == "user version"
        assert entries[0]["overrides_builtin"] is True

    def test_frontmatter_name_wins_over_dirname(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "some-folder", name="canonical-name")
        assert skill_store.find("canonical-name") is not None
        assert skill_store.find("some-folder") is None

    def test_invalid_entries_flagged(self, skill_dirs):
        builtin, _ = skill_dirs
        (builtin / "no-fm").mkdir()
        (builtin / "no-fm" / "SKILL.md").write_text("plain\n", encoding="utf-8")
        make_skill(builtin, "bad-name", name="Bad Name!")
        make_skill(builtin, "no-desc", description="")
        (builtin / "not-a-skill").mkdir()
        entries = {e["name"]: e for e in skill_store.scan()}
        assert "not-a-skill" not in entries
        for key in ("no-fm", "bad-name", "no-desc"):
            match = [e for e in entries.values()
                     if not e["valid"] and key in (e["name"], Path(e["dir"]).name)]
            assert match, key
        for e in entries.values():
            if not e["valid"]:
                assert e["enabled"] is False
                assert e["error"]

    def test_description_truncated(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "longy", description="x" * 3000)
        entry = skill_store.find("longy")
        assert len(entry["description"]) == skill_store.DESCRIPTION_MAX

    def test_display_meta_from_openai_yaml(self, skill_dirs):
        builtin, _ = skill_dirs
        d = make_skill(builtin, "shiny")
        (d / "agents").mkdir()
        (d / "agents" / "openai.yaml").write_text(
            "interface:\n  display_name: Shiny Studio\n", encoding="utf-8")
        assert skill_store.find("shiny")["display_name"] == "Shiny Studio"


class TestEnableDisable:
    def test_toggle_roundtrip(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha")
        skill_store.set_skill_enabled("alpha", False)
        assert skill_store.find("alpha")["enabled"] is False
        assert skill_store.find_enabled("alpha") is None
        skill_store.set_skill_enabled("alpha", True)
        assert skill_store.find_enabled("alpha") is not None

    def test_global_toggle_gates_enabled_skills(self, skill_dirs):
        from ComfyTV import storage
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha")
        assert skill_store.skills_enabled() is True
        assert [s["name"] for s in skill_store.enabled_skills()] == ["alpha"]
        storage.set_settings({skill_store.ENABLE_SETTING: False})
        assert skill_store.enabled_skills() == []


class TestReadFiles:
    def test_read_skill_returns_full_text(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha", body="The body text.\n")
        text = skill_store.read_skill("alpha")
        assert text.startswith("---")
        assert "The body text." in text

    def test_read_reference_file(self, skill_dirs):
        builtin, _ = skill_dirs
        d = make_skill(builtin, "alpha")
        (d / "references").mkdir()
        (d / "references" / "deep.md").write_text("deep info", encoding="utf-8")
        assert skill_store.read_skill_file("alpha", "references/deep.md") == "deep info"
        assert skill_store.read_skill_file("alpha", "references\\deep.md") == "deep info"

    @pytest.mark.parametrize("relpath", [
        "../outside.txt", "..", "/etc/passwd", "C:/windows/win.ini", "",
        "references/../../outside.txt",
    ])
    def test_traversal_rejected(self, skill_dirs, tmp_path, relpath):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha")
        (tmp_path / "outside.txt").write_text("secret", encoding="utf-8")
        with pytest.raises(ValueError):
            skill_store.read_skill_file("alpha", relpath)

    def test_missing_file_and_unknown_skill(self, skill_dirs):
        builtin, _ = skill_dirs
        make_skill(builtin, "alpha")
        with pytest.raises(ValueError):
            skill_store.read_skill_file("alpha", "references/nope.md")
        with pytest.raises(ValueError):
            skill_store.read_skill("ghost")

    def test_oversized_file_rejected(self, skill_dirs, monkeypatch):
        builtin, _ = skill_dirs
        d = make_skill(builtin, "alpha")
        (d / "big.txt").write_text("x" * 64, encoding="utf-8")
        monkeypatch.setattr(skill_store, "FILE_BYTES_MAX", 10)
        with pytest.raises(ValueError):
            skill_store.read_skill_file("alpha", "big.txt")
