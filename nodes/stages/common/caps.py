def _caps(upstream_kinds, option_keys, computed_keys) -> dict:
    return {
        "upstream_kinds": list(upstream_kinds),
        "option_keys":    list(option_keys),
        "computed_keys":  list(computed_keys),
    }


CAPS_BY_KIND: dict[str, dict] = {
    'text':          _caps(['text'],                       [],
                           []),
    'image':         _caps(['image', 'text'],              ['option:negative', 'option:seed', 'option:batch_size'],
                           ['computed:width', 'computed:height']),
    'shot-images':   _caps(['image', 'text'],              ['option:negative', 'option:seed', 'option:batch_size'],
                           ['computed:width', 'computed:height']),
    'video':         _caps(['image', 'video', 'text'],     ['option:negative', 'option:seed', 'option:duration_s', 'option:generate_audio'],
                           ['computed:width', 'computed:height', 'computed:length']),
    'audio':         _caps(['text', 'audio'],              ['option:seed', 'option:duration_s', 'option:lyrics', 'option:bpm', 'option:timesignature', 'option:keyscale', 'option:language'],
                           ['computed:length']),
    'speech':        _caps(['text', 'audio'],              ['option:seed', 'option:voice', 'option:language', 'option:speed', 'option:reference_text'],
                           ['computed:length']),
    'storyboard':    _caps(['text'],                       ['option:max_length'],
                           []),
    'panorama':      _caps(['image', 'text'],              ['option:seed'],
                           []),
    'upscale':       _caps(['image'],                      ['option:seed', 'option:scale'],
                           []),
    'outpaint':      _caps(['image'],                      ['option:seed', 'option:negative', 'option:pad_left', 'option:pad_top', 'option:pad_right', 'option:pad_bottom', 'option:feathering'],
                           []),
    'inpaint':       _caps(['image'],                      ['option:seed', 'option:negative', 'option:mask_data'],
                           []),
    'erase':         _caps(['image'],                      ['option:seed', 'option:mask_data'],
                           []),
    'cutout':        _caps(['image'],                      [],
                           []),
    'multiangle':    _caps(['image'],                      ['option:seed'],
                           []),
    'image-edit':    _caps(['image'],                      ['option:seed'],
                           []),
    'multiview':     _caps(['image'],                      ['option:seed'],
                           []),
    'sequence':      _caps(['image'],                      ['option:seed'],
                           []),
    'timeline':      _caps([],                             [],
                           []),
    'audio-vocal':   _caps(['audio'],                      [],
                           []),
    'audio-bg':      _caps(['audio'],                      [],
                           []),
}


FALLBACK_CAPS: dict = _caps(
    ['image', 'video', 'audio', 'text'],
    ['option:negative', 'option:seed', 'option:batch_size'],
    ['computed:width', 'computed:height', 'computed:length'],
)


BUILTIN_OPTION_META: dict[str, tuple[str, str]] = {
    'negative':       ('Stage negative prompt', 'string'),
    'seed':           ('Stage seed', 'int'),
    'batch_size':     ('Stage batch size', 'int'),
    'duration_s':     ('Stage duration (s)', 'float'),
    'generate_audio': ('Stage generate audio', 'boolean'),
    'lyrics':         ('Stage lyrics', 'string'),
    'bpm':            ('Stage BPM', 'int'),
    'timesignature':  ('Stage time signature', 'string'),
    'keyscale':       ('Stage key / scale', 'string'),
    'voice':          ('Stage voice / speaker', 'string'),
    'language':       ('Stage language', 'string'),
    'speed':          ('Stage speaking speed', 'float'),
    'reference_text': ('Stage reference transcript', 'string'),
    'max_length':     ('Stage LLM max output length', 'int'),
    'scale':          ('Stage scale', 'string'),
    'pad_left':       ('Stage pad left', 'int'),
    'pad_top':        ('Stage pad top', 'int'),
    'pad_right':      ('Stage pad right', 'int'),
    'pad_bottom':     ('Stage pad bottom', 'int'),
    'feathering':     ('Stage feathering', 'int'),
    'mask_data':      ('Stage mask (painter output)', 'string'),
}


def builtin_option_rows() -> list[dict]:
    rows: list[dict] = []
    for kind, caps in CAPS_BY_KIND.items():
        for okey in caps["option_keys"]:
            key = okey.split(":", 1)[1] if okey.startswith("option:") else okey
            label, type_ = BUILTIN_OPTION_META.get(key, (key, 'string'))
            rows.append({"kind": kind, "key": key, "label": label, "type": type_})
    return rows


def caps_payload() -> dict:
    from .... import storage

    by_kind: dict[str, dict] = {
        k: {
            "upstream_kinds": list(v["upstream_kinds"]),
            "option_keys":    [],
            "computed_keys":  list(v["computed_keys"]),
        }
        for k, v in CAPS_BY_KIND.items()
    }
    option_labels: dict[str, str] = {}

    for p in storage.list_stage_params():
        kind = p["kind"]
        key = f"option:{p['key']}"
        entry = by_kind.get(kind)
        if entry is None:
            entry = {"upstream_kinds": [], "option_keys": [], "computed_keys": []}
            by_kind[kind] = entry
        if key not in entry["option_keys"]:
            entry["option_keys"].append(key)
        option_labels[key] = p["label"]

    return {
        "caps_by_kind": by_kind,
        "fallback_caps": FALLBACK_CAPS,
        "option_labels": option_labels,
    }
