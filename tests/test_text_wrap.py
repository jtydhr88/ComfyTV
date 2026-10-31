"""The same cases live in src/composables/stages/textOverlayLayout.test.ts: preview and render must break alike."""
from __future__ import annotations

import numpy as np
import pytest

from ComfyTV.runners.text_overlay import render_text_rgba, wrap_text


def _cells(text):
    return sum(2 if ord(c) > 0x2E7F else 1 for c in text)


CASES = [
    ("fits unchanged", "短句", 10, "短句"),
    ("explicit breaks kept", "一二\n三四", 10, "一二\n三四"),
    ("blank line kept", "一二\n\n三四", 10, "一二\n\n三四"),
    ("cjk breaks between characters, bottom heavy", "一二三四五六七", 10, "一二三\n四五六七"),
    ("latin breaks between words", "aaa bbb ccc ddd", 8, "aaa bbb\nccc ddd"),
    ("balances instead of filling", "aa bb cc dd ee", 10, "aa bb\ncc dd ee"),
    ("closing punctuation stays on the line", "一二三四，五六七八", 10, "一二三四，\n五六七八"),
    ("opening punctuation stays with its word", "一二三四《五六七》", 10, "一二三四\n《五六七》"),
    ("mixed scripts", "中文 mixed 文字 text", 12, "中文 mixed\n文字 text"),
    ("long word splits by character", "abcdefghijkl", 5, "abcd\nefgh\nijkl"),
    ("three lines keep the short one on top", "一二三四五六七八九十一二", 8, "一二三四\n五六七八\n九十一二"),
    ("trailing spaces dropped when broken", "aaaa   bbbb", 5, "aaaa\nbbbb"),
]


@pytest.mark.parametrize("name,text,width,expected", CASES, ids=[c[0] for c in CASES])
def test_wrap_text(name, text, width, expected):
    assert wrap_text(text, _cells, width) == expected


def test_every_line_fits():
    text = "这是一句比较长的中文字幕，用来测试它在视频画面里会不会超出边界。" * 3
    for line in wrap_text(text, _cells, 40).split("\n"):
        assert _cells(line) <= 40


def test_a_character_wider_than_the_frame_still_terminates():
    assert wrap_text("一二", _cells, 1) == "一\n二"


def test_real_font_stays_inside_the_frame():
    from ComfyTV.runners.text_overlay import _text_wrapper

    text = "这是一句比较长的中文字幕，用来测试它在视频画面里会不会超出边界。" * 2
    wrapped = _text_wrapper("NotoSansSC-Regular", 48, 2)(text, 1080)
    arr = render_text_rgba(wrapped, font="NotoSansSC-Regular", size=48, stroke=2)
    assert "\n" in wrapped
    assert arr.shape[1] <= 1080 * 0.9
    assert np.any(arr[..., 3] > 0)


def test_title_wraps_before_the_typewriter_slices():
    from ComfyTV.runners.text_overlay import _typewriter_slice

    wrapped = wrap_text("aaa bbb ccc ddd", _cells, 8)
    assert _typewriter_slice(wrapped, 5, 0, "char", 1.0) == "aaa b"
    assert _typewriter_slice(wrapped, 9, 0, "char", 1.0) == "aaa bbb\nc"


def test_short_text_renders_as_before():
    from ComfyTV.runners.text_overlay import _text_wrapper

    assert _text_wrapper("NotoSansSC-Regular", 48, 2)("短句", 1920) == "短句"
