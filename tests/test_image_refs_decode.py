"""Review1: complete pixel validation, isolated from Pillow's process-global flag."""
import hashlib
import io
import pytest
from PIL import Image, ImageFile
from test_image_refs import source, helper
from test_bot_hermes import contract, provider
from ComfyTV.bot.providers import TurnRequest, TurnHandle


def jpeg(source, truncated=False):
    out = io.BytesIO()
    Image.new('RGB', (1600, 900), 'red').save(out, format='JPEG')
    raw = out.getvalue()
    source[0].write_bytes(raw[:len(raw)//2] if truncated else raw)


@pytest.mark.parametrize('permissive', [False, True])
def test_truncated_jpeg_rejected_without_changing_global_flag(source, monkeypatch, permissive):
    jpeg(source, truncated=True)
    monkeypatch.setattr(ImageFile, 'LOAD_TRUNCATED_IMAGES', permissive)
    with pytest.raises(ValueError):
        helper().build_manifest([7])
    assert ImageFile.LOAD_TRUNCATED_IMAGES is permissive


@pytest.mark.parametrize('permissive', [False, True])
async def test_real_provider_never_runs_truncated_jpeg(contract, source, monkeypatch, permissive):
    # Forge matching metadata for the bad bytes to exercise provider revalidation,
    # not merely a changed revision or a builder that already rejects it.
    jpeg(source)
    manifest = helper().build_manifest([7])
    jpeg(source, truncated=True)
    raw = source[0].read_bytes()
    manifest['assets'][0].update(size_bytes=len(raw), revision='sha256:' + hashlib.sha256(raw).hexdigest())
    monkeypatch.setattr(ImageFile, 'LOAD_TRUNCATED_IMAGES', permissive)
    contract['settings']['bot-hermes-image-attachments'] = True
    async def emit(event): pass
    result = await provider().send(TurnRequest(chat_id='c', message_id='m', user_text='inspect',
                                              attachment_manifest=manifest), emit, TurnHandle())
    assert result.error
    assert contract['calls'] == []
    assert ImageFile.LOAD_TRUNCATED_IMAGES is permissive


@pytest.mark.parametrize('fmt', ['JPEG', 'PNG', 'WEBP', 'GIF', 'BMP', 'TIFF'])
def test_all_allowed_formats_decode_without_submit_preview(source, monkeypatch, fmt):
    Image.new('RGB', (32, 24), 'blue').save(source[0], format=fmt)
    monkeypatch.setattr(ImageFile, 'LOAD_TRUNCATED_IMAGES', True)
    monkeypatch.setattr(Image.Image, 'save', lambda *a, **kw: pytest.fail('submit must not encode'))
    manifest = helper().build_manifest([7])
    assert manifest['assets'][0]['width'] == 32
    assert manifest['assets'][0]['height'] == 24
    assert ImageFile.LOAD_TRUNCATED_IMAGES is True


async def test_valid_jpeg_real_provider_runs(contract, source):
    jpeg(source)
    manifest = helper().build_manifest([7])
    contract['settings']['bot-hermes-image-attachments'] = True
    async def emit(event): pass
    result = await provider().send(TurnRequest(chat_id='c', message_id='m', user_text='  valid JPEG\n',
                                              attachment_manifest=manifest), emit, TurnHandle())
    assert not result.error
    assert len([c for c in contract['calls'] if c[1] == '/v1/runs']) == 1
