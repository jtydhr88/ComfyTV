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
    return {
        "caps_by_kind": CAPS_BY_KIND,
        "fallback_caps": FALLBACK_CAPS,
    }
