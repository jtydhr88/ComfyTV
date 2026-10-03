"""Local, real encoded media; no server/model/GPU required."""
import base64
import hashlib
import io
import json
import subprocess

import pytest
from PIL import Image
from ComfyTV import storage
from test_bot_hermes import contract, provider
from ComfyTV.bot.providers import TurnRequest, TurnHandle


async def test_real_mixed_media_runs_reference_transport(media, contract):
    from ComfyTV.api import media_refs
    contract['settings']['bot-hermes-image-attachments'] = True
    manifest = media_refs.build_manifest([9, 7, 8])
    turn = TurnRequest(chat_id='media-chat', message_id='media-message', user_text=' exact\n ', attachment_manifest=manifest)
    async def emit(event):
        pass
    result = await provider().send(turn, emit, TurnHandle())
    assert not result.error
    body = next(c[2] for c in contract['calls'] if c[1] == '/v1/runs')
    task = json.loads(body['input'])
    assert task['attachment_manifest'] == manifest and task['user_text'] == turn.user_text
    assert 'inspect_media_asset' not in body['instructions']
    assert len(body['input'].encode()) <= 8192


@pytest.mark.parametrize('case', ['document', 'archive', 'missing', 'deleted', 'corrupt', 'mislabeled', 'oversize', 'symlink', 'http', 'traversal', 'temp', 'stale'])
def test_media_references_fail_closed(media, case):
    from ComfyTV.api import media_refs
    root, rows = media
    path = root / 'red-blue.mp4'
    revision = media_refs.build_manifest([7])['assets'][0]['revision']
    if case in {'document', 'archive'}:
        rows[7]['media_type'] = case
    elif case == 'missing':
        rows.pop(7)
    elif case == 'deleted':
        path.unlink()
    elif case == 'corrupt':
        path.write_bytes(b'not media')
    elif case == 'mislabeled':
        rows[7]['media_type'] = 'audio'
    elif case == 'oversize':
        with path.open('wb') as stream:
            stream.truncate(media_refs.MAX_SOURCE + 1)
    elif case == 'symlink':
        path.unlink()
        path.symlink_to(root / 'tone.wav')
    elif case == 'http':
        rows[7]['payload_url'] = 'https://invalid/media.mp4'
    elif case == 'traversal':
        rows[7]['payload_url'] = '/view?filename=../red-blue.mp4&type=input'
    elif case == 'temp':
        rows[7]['payload_url'] = '/view?filename=red-blue.mp4&type=temp'
    elif case == 'stale':
        revision = 'sha256:' + '0' * 64
    with pytest.raises(ValueError):
        media_refs.preview({'asset_id': 7, 'revision': revision})


@pytest.mark.parametrize('options', [
    {'url': 'https://invalid'}, {'path': '/etc/passwd'}, {'asset_id': True},
    {'mode': 'other'}, {'mode': 'timeline', 'frames': 5}, {'mode': 'timeline', 'frames': True},
    {'mode': 'frame', 'time_seconds': float('nan')}, {'mode': 'frame', 'time_seconds': True},
    {'mode': 'frame', 'time_seconds': 2}, {'mode': 'metadata', 'frames': 2}, {'mode': 'waveform'}])
def test_inspection_option_bounds(media, options):
    from ComfyTV.api import media_refs
    with pytest.raises(ValueError):
        media_refs.preview({'asset_id': 7, **options})


def test_media_duration_bound(media):
    from ComfyTV.api import media_refs
    path = media[0] / 'tone.wav'
    path.unlink()
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono',
                    '-t', '301', '-c:a', 'pcm_s16le', str(path)], check=True, timeout=10)
    with pytest.raises(ValueError):
        media_refs.build_manifest([8])


def test_media_timeout_reaps_child_and_releases_slot(media, monkeypatch):
    from ComfyTV.api import media_refs, image_refs
    run = subprocess.run
    pids = []
    popen = subprocess.Popen
    def tracked(*args, **kwargs):
        child = popen(*args, **kwargs)
        pids.append(child)
        return child
    def tiny_timeout(*args, **kwargs):
        return run(*args, **{**kwargs, 'timeout': .001})
    with monkeypatch.context() as scoped:
        scoped.setattr(subprocess, 'Popen', tracked)
        scoped.setattr(media_refs.subprocess, 'run', tiny_timeout)
        with pytest.raises(ValueError, match='limits'):
            media_refs.preview({'asset_id': 7, 'mode': 'frame'})
    assert pids and all(child.poll() is not None for child in pids)
    assert image_refs._SLOTS.acquire(False)
    assert image_refs._SLOTS.acquire(False)
    image_refs._SLOTS.release()
    image_refs._SLOTS.release()
    assert media_refs.build_manifest([7])['assets']


@pytest.mark.parametrize('native', [True, False])
async def test_media_routes_preserve_manifest_and_transcript(media, bot_client, fake_provider, monkeypatch, native):
    from conftest import wait_bot_done
    caps = fake_provider.capabilities()
    caps.attachment_transport = 'asset_refs'
    caps.attachment_mixed_context = True
    monkeypatch.setattr(fake_provider, 'capabilities', lambda: caps)
    chat = storage.create_bot_chat(provider=fake_provider.id)
    text = '  中文 media\n '
    if native:
        response = await bot_client.post(f"/comfytv/agent/threads/{chat['id']}/messages", json={
            'content': text, 'attachments': ['asset:9', 'asset:7', 'asset:8'],
            'draft': {'content': {'nodes': []}}})
        assert response.status == 202, await response.text()
    else:
        response = await bot_client.post(f"/comfytv/bot/chats/{chat['id']}/send", json={
            'text': text, 'attachments': [{'asset_id': aid} for aid in [9, 7, 8]]})
        assert response.status == 200, await response.text()
    await wait_bot_done(bot_client, chat['id'])
    turn = fake_provider.last_turn
    assert turn.chat_id == chat['id'] and turn.message_id and turn.user_text == text and not turn.attachments
    assert [a['media_type'] for a in turn.attachment_manifest['assets']] == ['image', 'video', 'audio']
    if native:
        assert json.loads(turn.task_input_json)['schema'] == 'comfytv.task-input.v2'
    response = await bot_client.get(f"/comfytv/agent/threads/{chat['id']}/messages")
    messages = await response.json()
    assert messages[0]['content']['attachment_manifest'] == turn.attachment_manifest


@pytest.mark.parametrize('aid,mode,kind', [(7, 'timeline', 'video'), (8, 'waveform', 'audio')])
async def test_media_mcp_gated_native_image_content(media, monkeypatch, aid, mode, kind):
    from ComfyTV.api.mcp import _tools_call, _tools_list
    monkeypatch.setattr(storage, 'get_setting', lambda key: key == 'bot-hermes-image-attachments')
    assert 'inspect_media_asset' in [item['name'] for item in _tools_list()['tools']]
    arguments = {'asset_id': aid, 'mode': mode}
    if mode == 'timeline':
        arguments['frames'] = 2
    result = await _tools_call({'name': 'inspect_media_asset', 'arguments': arguments})
    assert result['isError'] is False
    assert result['content'][1]['type'] == 'image'
    assert result['content'][1]['mimeType'] == 'image/jpeg'
    assert json.loads(result['content'][0]['text'])['media_type'] == kind
    monkeypatch.setattr(storage, 'get_setting', lambda key: False)
    assert 'inspect_media_asset' not in [item['name'] for item in _tools_list()['tools']]
    assert await _tools_call({'name': 'inspect_media_asset', 'arguments': {'asset_id': 8}}) is None


async def test_mixed_media_submission_keeps_context_and_display_types(media, bot_client, fake_provider, monkeypatch):
    from ComfyTV.api import bot_send
    caps = fake_provider.capabilities()
    caps.attachment_transport = 'asset_refs'
    caps.attachment_mixed_context = True
    monkeypatch.setattr(fake_provider, 'capabilities', lambda: caps)
    chat = storage.create_bot_chat(provider=fake_provider.id)
    prepared = await bot_send.prepare_image_refs(chat, ['asset:9', 'asset:7', 'asset:8'], ' exact\n ', native=True,
                                                 body={'draft': {'content': {'nodes': [{'id': 1, 'type': 'Test'}]}},
                                                       'selection': {'node_ids': [1]}})
    try:
        assert [b['type'] for b in prepared['display_blocks'][:3]] == ['image', 'video', 'audio']
        task = json.loads(prepared['task_input_json'])
        assert task['schema'] == 'comfytv.task-input.v2' and task['user_text'] == ' exact\n '
        assert task['attachment_manifest'] == prepared['attachment_manifest']
        assert task['context_ref']['id']
        assert prepared['attachments'] == []
    finally:
        bot_send.release_prepared(prepared)
    caps.attachments = False
    with pytest.raises(ValueError, match='disabled'):
        await bot_send.prepare_image_refs(chat, ['asset:7'], 'hi', native=True)


def test_hermes_media_capability_and_local_health_projection(monkeypatch):
    from ComfyTV.bot.hermes import HermesProvider
    from ComfyTV.bot import hermes_health as health
    monkeypatch.setattr(storage, 'get_setting', lambda key: True)
    caps = HermesProvider().capabilities()
    assert caps.attachments and caps.attachment_media_types == ['image', 'video', 'audio']
    data = health.empty('comfytv')
    health.local_policy(data, 'comfytv', '', True)
    assert health.validate(data, '')['media']['unsupported'] == ['document']
    assert data['media']['image']['inference'] == 'not_tested'
    monkeypatch.setattr(storage, 'get_setting', lambda key: False)
    assert HermesProvider().capabilities().attachments is False


@pytest.mark.parametrize('mode', [[], {}])
def test_malformed_inspection_mode_fails_as_validation(media, mode):
    from ComfyTV.api import media_refs
    with pytest.raises(ValueError, match='mode'):
        media_refs.preview({'asset_id': 7, 'mode': mode})


def test_media_worker_disallows_nested_file_protocol(media):
    from ComfyTV.api import media_refs
    playlist = ('#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:2,\n'
                + str(media[0] / 'red-blue.mp4') + '\n#EXT-X-ENDLIST\n').encode()
    with pytest.raises(ValueError):
        media_refs._decode(playlist, 'video')


def test_decode_protocols_exclude_nested_file_and_network(media, monkeypatch):
    import av
    from ComfyTV.api import _media_decode
    original = av.open
    observed = []
    def checked(*args, **kwargs):
        protocols = kwargs['options']['protocol_whitelist'].split(',')
        observed.append(protocols)
        assert 'file' not in protocols and 'http' not in protocols and 'https' not in protocols
        return original(*args, **kwargs)
    monkeypatch.setattr(av, 'open', checked)
    container, stream, facts = _media_decode.probe((media[0] / 'red-blue.mp4').read_bytes(), 'video')
    container.close()
    assert observed and facts['width'] == 96


@pytest.fixture
def media(tmp_path, monkeypatch):
    import folder_paths
    monkeypatch.setattr(folder_paths, 'get_input_directory', lambda: str(tmp_path))
    monkeypatch.setattr(folder_paths, 'get_output_directory', lambda: str(tmp_path))
    video = tmp_path / 'red-blue.mp4'
    audio = tmp_path / 'tone.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=red:s=96x64:r=10:d=1',
                    '-f', 'lavfi', '-i', 'color=blue:s=96x64:r=10:d=1', '-filter_complex',
                    '[0:v][1:v]concat=n=2:v=1:a=0', '-c:v', 'mpeg4', str(video)], check=True, timeout=10)
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
                    '-c:a', 'pcm_s16le', str(audio)], check=True, timeout=10)
    Image.new('RGB', (30, 20), 'green').save(tmp_path / 'image.png')
    rows = {aid: {'media_type': kind, 'payload_url': f'/view?filename={name}&type=input'}
            for aid, kind, name in [(7, 'video', video.name), (8, 'audio', audio.name), (9, 'image', 'image.png')]}
    monkeypatch.setattr(storage, 'get_asset', lambda aid: rows.get(aid))
    return tmp_path, rows


def test_mixed_manifest_actual_facts_and_stable_reference_only(media):
    from ComfyTV.api import media_refs
    manifest = media_refs.build_manifest([9, 7, 8])
    assert [a['media_type'] for a in manifest['assets']] == ['image', 'video', 'audio']
    for item in manifest['assets']:
        assert item['perception'] == 'not_inspected'
        assert not {'path', 'url', 'data', 'payload_url'} & item.keys()
    video, audio = manifest['assets'][1:]
    assert video['width'] == 96 and video['height'] == 64
    assert video['duration_seconds'] == pytest.approx(2, abs=.1)
    assert video['revision'] == 'sha256:' + hashlib.sha256((media[0] / 'red-blue.mp4').read_bytes()).hexdigest()
    assert audio['duration_seconds'] == pytest.approx(2, abs=.1)
    assert audio['sample_rate'] == 44100 and audio['channels'] == 1
    assert audio['inspect_tool'] == 'inspect_media_asset'
    assert 'speech' in audio['limitations']
    from ComfyTV.api.image_refs import task_input
    assert json.loads(task_input(' untouched ', manifest))['user_text'] == ' untouched '


def decoded(result):
    raw = base64.b64decode(result['_images'][0]['data'])
    assert len(raw) <= 1024 * 1024
    return Image.open(io.BytesIO(raw))


def test_real_video_frame_and_timeline_inspection(media):
    from ComfyTV.api import media_refs
    revision = media_refs.build_manifest([7])['assets'][0]['revision']
    with decoded(media_refs.preview({'asset_id': 7, 'revision': revision, 'mode': 'frame', 'time_seconds': .5})) as frame:
        r, g, b = frame.getpixel((frame.width // 2, frame.height // 2))
        assert r > 200 and b < 30
    result = media_refs.preview({'asset_id': 7, 'mode': 'timeline', 'frames': 2})
    assert result['media_type'] == 'video'
    assert result['perception'] == 'sampled_frames_not_analyzed'
    assert len(result['sample_times_seconds']) == 2
    with decoded(result) as timeline:
        r1, _, b1 = timeline.getpixel((timeline.width // 4, timeline.height // 2))
        r2, _, b2 = timeline.getpixel((timeline.width * 3 // 4, timeline.height // 2))
        assert r1 > 200 and b1 < 30 and b2 > 200 and r2 < 30
    assert sorted(p.name for p in media[0].iterdir()) == ['image.png', 'red-blue.mp4', 'tone.wav']


def test_real_audio_waveform_is_structure_not_listening(media):
    from ComfyTV.api import media_refs
    result = media_refs.preview({'asset_id': 8, 'mode': 'waveform'})
    assert result['media_type'] == 'audio'
    assert result['perception'] == 'waveform_only_not_listened'
    assert result['waveform_peak'] > .1
    assert result['waveform_rms'] == pytest.approx(.088, abs=.01)
    assert result['inspected_duration_seconds'] == pytest.approx(2, abs=.1)
    assert 'speech' in result['limitations'] and not {'transcript', 'language', 'lyrics'} & result.keys()
    with decoded(result) as image:
        assert image.size == (800, 200)
        assert len(set(image.getdata())) > 2
    assert sorted(p.name for p in media[0].iterdir()) == ['image.png', 'red-blue.mp4', 'tone.wav']
