DELIVERY_CODECS = {
    'h264': {'vcodec': 'libx264', 'ext': '.mp4', 'pix_fmt': 'yuv420p',
             'quality': {'draft': {'crf': '28', 'preset': 'veryfast'},
                         'standard': None,
                         'high': {'crf': '16', 'preset': 'slow'}}},
    'hevc': {'vcodec': 'libx265', 'ext': '.mp4', 'pix_fmt': 'yuv420p',
             'quality': {'draft': {'crf': '30', 'preset': 'fast'},
                         'standard': None,
                         'high': {'crf': '20', 'preset': 'slow'}}},
    'prores': {'vcodec': 'prores_ks', 'ext': '.mov',
               'pix_fmt': 'yuv422p10le',
               'quality': {'draft': {'profile': '0'},
                           'standard': {'profile': '2'},
                           'high': {'profile': '3'}}},
}


DELIVERY_COLORSPACES = {'bt709', 'bt601-6-625', 'bt2020', 'smpte170m'}


def _delivery_norm(delivery):
    d = dict(delivery or {})

    def _num(key):
        try:
            v = float(d.get(key) or 0)
        except (TypeError, ValueError):
            return 0
        return v if v > 0 else 0

    codec = d.get('codec')
    quality = d.get('quality')
    cs = d.get('colorspace')
    return {
        'colorspace': cs if cs in DELIVERY_COLORSPACES else 'bt709',
        'size': int(_num('size')),
        'fps': _num('fps'),
        'codec': codec if codec in DELIVERY_CODECS else 'h264',
        'quality': quality if quality in ('draft', 'standard', 'high')
        else 'standard',
    }


def _delivery_active(d):
    return (d['colorspace'] != 'bt709' or d['size'] > 0 or d['fps'] > 0
            or d['codec'] != 'h264' or d['quality'] != 'standard')


def _delivery_specs(d):
    specs = []
    if d['fps'] > 0:
        specs.append(('fps', f"fps={d['fps']:g}"))
    if d['size'] > 0:
        s = d['size'] - d['size'] % 2
        specs.append(('scale',
                      f"w='if(gt(iw,ih),-2,{s})':h='if(gt(iw,ih),{s},-2)'"))
    return specs


def _delivery_encode_kwargs(d):
    c = DELIVERY_CODECS[d['codec']]
    opts = c['quality'][d['quality']]
    return {'vcodec': c['vcodec'], 'out_ext': c['ext'],
            'pix_fmt': c['pix_fmt'],
            'vcodec_options': dict(opts) if opts else None,
            'out_colorspace': d['colorspace']}
