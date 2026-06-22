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
    'audio':         _caps(['text', 'audio'],              ['option:seed', 'option:duration_s', 'option:lyrics'],
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
    'relight':       _caps(['image'],                      ['option:seed', 'option:negative'],
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


def caps_payload() -> dict:
    """The JSON body served at GET /comfytv/caps."""
    import logging

    by_kind: dict[str, dict] = {
        k: {
            "upstream_kinds": list(v["upstream_kinds"]),
            "option_keys":    list(v["option_keys"]),
            "computed_keys":  list(v["computed_keys"]),
        }
        for k, v in CAPS_BY_KIND.items()
    }
    option_labels: dict[str, str] = {}

    try:
        from .... import storage
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
    except Exception as e:
        logging.warning("[ComfyTV/stage-params] caps merge failed: %s", e)

    return {
        "caps_by_kind": by_kind,
        "fallback_caps": FALLBACK_CAPS,
        "option_labels": option_labels,
    }
