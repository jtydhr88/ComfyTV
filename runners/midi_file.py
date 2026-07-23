import struct

from .media import fresh_output_path, path_to_view_url

_PPQ = 480


def _vlq(value):
    value = max(0, int(value))
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(out))


def _track_chunk(payload):
    return b'MTrk' + struct.pack('>I', len(payload)) + payload


def write_smf(performance: dict, *, programs=None) -> str:
    tempo_map = performance.get('tempo_map') or [
        {'beat': 0.0, 't': 0.0, 'bpm': 120.0}]
    events = performance.get('events') or []
    programs = programs or {}

    def sec_to_ticks(t):
        seg = tempo_map[0]
        for m in tempo_map:
            if m['t'] <= t + 1e-9:
                seg = m
            else:
                break
        beats = seg['beat'] + (t - seg['t']) * seg['bpm'] / 60.0
        return int(round(beats * _PPQ))

    meta = bytearray()
    last_tick = 0
    for m in tempo_map:
        tick = int(round(m['beat'] * _PPQ))
        usec = int(round(60000000.0 / max(1.0, m['bpm'])))
        meta += _vlq(tick - last_tick)
        meta += bytes([0xFF, 0x51, 0x03])
        meta += struct.pack('>I', usec)[1:]
        last_tick = tick
    meta += _vlq(0) + bytes([0xFF, 0x2F, 0x00])

    by_channel = {}
    for e in events:
        by_channel.setdefault(int(e.get('ch', 0)), []).append(e)

    tracks = [_track_chunk(bytes(meta))]
    for ch in sorted(by_channel):
        msgs = []
        prog = programs.get(ch)
        if prog is not None and ch != 9:
            msgs.append((0, bytes([0xC0 | ch, int(prog) & 0x7F])))
        for e in by_channel[ch]:
            on = sec_to_ticks(e['t'])
            off = max(on + 1, sec_to_ticks(e['t'] + e['dur']))
            midi = int(e['midi']) & 0x7F
            vel = int(e['vel']) & 0x7F
            msgs.append((on, bytes([0x90 | ch, midi, max(1, vel)])))
            msgs.append((off, bytes([0x80 | ch, midi, 0x40])))
        msgs.sort(key=lambda m: (m[0], m[1][0] & 0xF0 != 0x80))
        payload = bytearray()
        last = 0
        for tick, data in msgs:
            payload += _vlq(tick - last)
            payload += data
            last = tick
        payload += _vlq(0) + bytes([0xFF, 0x2F, 0x00])
        tracks.append(_track_chunk(bytes(payload)))

    header = b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), _PPQ)
    out = fresh_output_path('.mid', subfolder='comfytv/midi')
    out.write_bytes(header + b''.join(tracks))
    return path_to_view_url(out)


__all__ = ['write_smf']
