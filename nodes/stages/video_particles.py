from ._common import *  # noqa: F401, F403
from ...runners.particles import (
    PARTICLE_EMITTERS, PARTICLE_SPRITES, PARTICLE_RENDERERS, PARTICLE_BLENDS,
    PARTICLE_COLLIDES, PARTICLE_SUB_MODES, particles_video,
)

from .common.fx_helpers import (  # noqa: F401
    _need_video, _progress_cb, _f,
    _hidden_float, _hidden_int, _hidden_str, _hidden_combo,
)


class ParticlesStage(io.ComfyNode):

    @classmethod
    def define_schema(cls):
        return io.Schema(
            node_id="ComfyTV.ParticlesStage",
            display_name="Particles",
            category="ComfyTV/VideoFX",
            inputs=[
                *_standard_stage_inputs(),
                _hidden_combo("emitter", PARTICLE_EMITTERS, 'point'),
                _hidden_float("e_x0", 0.5, 0.0, 1.0),
                _hidden_float("e_y0", 0.85, 0.0, 1.0),
                _hidden_float("e_x1", 0.5, 0.0, 1.0),
                _hidden_float("e_y1", 0.85, 0.0, 1.0),
                _hidden_float("rate", 120.0, 0.0, 2000.0, step=1.0),
                _hidden_float("lifetime", 2.0, 0.1, 10.0),
                _hidden_float("speed", 120.0, 0.0, 1200.0, step=1.0),
                _hidden_float("direction", -90.0, -180.0, 180.0, step=1.0),
                _hidden_float("spread", 30.0, 0.0, 180.0, step=1.0),
                _hidden_float("gravity", 60.0, -600.0, 600.0, step=1.0),
                _hidden_float("wind", 0.0, -600.0, 600.0, step=1.0),
                _hidden_float("turbulence", 60.0, 0.0, 600.0, step=1.0),
                _hidden_float("turb_scale", 120.0, 8.0, 600.0, step=1.0),
                _hidden_float("drag", 0.1, 0.0, 0.99),
                _hidden_float("attract_strength", 0.0, -600.0, 600.0,
                              step=1.0),
                _hidden_float("attract_x", 0.5, 0.0, 1.0),
                _hidden_float("attract_y", 0.5, 0.0, 1.0),
                _hidden_float("attract_radius", 0.5, 0.05, 1.5),
                _hidden_float("swirl", 0.0, -600.0, 600.0, step=1.0),
                _hidden_combo("collide", PARTICLE_COLLIDES, 'none'),
                _hidden_float("floor_y", 0.9, 0.0, 1.0),
                _hidden_float("bounce", 0.5, 0.0, 1.0),
                _hidden_combo("sub_mode", PARTICLE_SUB_MODES, 'none'),
                _hidden_int("sub_count", 8, 0, 30),
                _hidden_float("sub_speed", 120.0, 0.0, 600.0, step=1.0),
                _hidden_float("sub_lifetime", 0.6, 0.1, 5.0),
                _hidden_float("sub_size_ratio", 0.5, 0.1, 2.0),
                _hidden_str("sub_color", "#FFF2B0"),
                _hidden_float("size", 12.0, 1.0, 64.0, step=0.5),
                _hidden_float("size_end_ratio", 0.4, 0.0, 3.0),
                _hidden_float("opacity_start", 1.0, 0.0, 1.0),
                _hidden_float("opacity_end", 0.0, 0.0, 1.0),
                _hidden_str("size_curve", "",
                            "JSON [{t,v}] size multiplier over life"),
                _hidden_str("opacity_curve", "",
                            "JSON [{t,v}] opacity over life"),
                _hidden_str("color0", "#FFD27A"),
                _hidden_str("color1", "#FF5A2A"),
                _hidden_combo("sprite", PARTICLE_SPRITES, 'glow'),
                _hidden_combo("renderer", PARTICLE_RENDERERS, 'sprite'),
                _hidden_float("stretch", 1.0, 0.0, 3.0),
                _hidden_int("trail_len", 4, 2, 5),
                _hidden_combo("blend", PARTICLE_BLENDS, 'additive'),
                _hidden_float("warmup", 1.0, 0.0, 10.0),
                _hidden_int("seed", 7, 0, 99999),
                COMFYTV_VIDEO.Input("video", optional=True),
                COMFYTV_VIDEO.Input("mask_video", optional=True),
                COMFYTV_IMAGE.Input("mask_image", optional=True),
            ],
            outputs=[COMFYTV_VIDEO.Output("video")],
            is_output_node=True,
            hidden=[io.Hidden.unique_id],
        )

    @classmethod
    def _params(cls, kw):
        p = {
            'emitter': kw['emitter'] if kw['emitter'] in PARTICLE_EMITTERS
            else 'point',
            'e_x0': _f(kw['e_x0'], 0, 1, 0.5),
            'e_y0': _f(kw['e_y0'], 0, 1, 0.85),
            'e_x1': _f(kw['e_x1'], 0, 1, 0.5),
            'e_y1': _f(kw['e_y1'], 0, 1, 0.85),
            'rate': _f(kw['rate'], 0, 2000, 120.0),
            'lifetime': _f(kw['lifetime'], 0.1, 10, 2.0),
            'speed': _f(kw['speed'], 0, 1200, 120.0),
            'direction': _f(kw['direction'], -180, 180, -90.0),
            'spread': _f(kw['spread'], 0, 180, 30.0),
            'gravity': _f(kw['gravity'], -600, 600, 60.0),
            'wind': _f(kw['wind'], -600, 600, 0.0),
            'turbulence': _f(kw['turbulence'], 0, 600, 60.0),
            'turb_scale': _f(kw['turb_scale'], 8, 600, 120.0),
            'drag': _f(kw['drag'], 0, 0.99, 0.1),
            'attract_strength': _f(kw['attract_strength'], -600, 600, 0.0),
            'attract_x': _f(kw['attract_x'], 0, 1, 0.5),
            'attract_y': _f(kw['attract_y'], 0, 1, 0.5),
            'attract_radius': _f(kw['attract_radius'], 0.05, 1.5, 0.5),
            'swirl': _f(kw['swirl'], -600, 600, 0.0),
            'collide': kw['collide'] if kw['collide'] in PARTICLE_COLLIDES
            else 'none',
            'floor_y': _f(kw['floor_y'], 0, 1, 0.9),
            'bounce': _f(kw['bounce'], 0, 1, 0.5),
            'sub_mode': kw['sub_mode'] if kw['sub_mode'] in PARTICLE_SUB_MODES
            else 'none',
            'sub_count': max(0, min(30, int(kw['sub_count'] or 0))),
            'sub_speed': _f(kw['sub_speed'], 0, 600, 120.0),
            'sub_lifetime': _f(kw['sub_lifetime'], 0.1, 5, 0.6),
            'sub_size_ratio': _f(kw['sub_size_ratio'], 0.1, 2, 0.5),
            'sub_color': kw['sub_color'] or '#FFF2B0',
            'size': _f(kw['size'], 1, 64, 12.0),
            'size_end_ratio': _f(kw['size_end_ratio'], 0, 3, 0.4),
            'opacity_start': _f(kw['opacity_start'], 0, 1, 1.0),
            'opacity_end': _f(kw['opacity_end'], 0, 1, 0.0),
            'size_curve': kw['size_curve'] or '',
            'opacity_curve': kw['opacity_curve'] or '',
            'color0': kw['color0'] or '#FFD27A',
            'color1': kw['color1'] or '#FF5A2A',
            'sprite': kw['sprite'] if kw['sprite'] in PARTICLE_SPRITES
            else 'glow',
            'renderer': kw['renderer'] if kw['renderer'] in PARTICLE_RENDERERS
            else 'sprite',
            'stretch': _f(kw['stretch'], 0, 3, 1.0),
            'trail_len': max(2, min(5, int(kw['trail_len'] or 4))),
            'blend': kw['blend'] if kw['blend'] in PARTICLE_BLENDS
            else 'additive',
            'warmup': _f(kw['warmup'], 0, 10, 1.0),
            'seed': int(kw['seed'] or 0),
        }
        return p

    @classmethod
    def execute(cls, force_run_token=0, project_id="", parent_output_id=0,
                emitter='point', e_x0=0.5, e_y0=0.85, e_x1=0.5, e_y1=0.85,
                rate=120.0, lifetime=2.0, speed=120.0, direction=-90.0,
                spread=30.0, gravity=60.0, wind=0.0, turbulence=60.0,
                turb_scale=120.0, drag=0.1, attract_strength=0.0,
                attract_x=0.5, attract_y=0.5, attract_radius=0.5, swirl=0.0,
                collide='none', floor_y=0.9, bounce=0.5, sub_mode='none',
                sub_count=8, sub_speed=120.0, sub_lifetime=0.6,
                sub_size_ratio=0.5, sub_color="#FFF2B0", size=12.0,
                size_end_ratio=0.4, opacity_start=1.0, opacity_end=0.0,
                size_curve="", opacity_curve="", color0="#FFD27A",
                color1="#FF5A2A", sprite='glow', renderer='sprite',
                stretch=1.0, trail_len=4, blend='additive', warmup=1.0,
                seed=7, video="", mask_video="", mask_image=""):
        params = cls._params(locals())
        if params['rate'] <= 0:
            return _fx_identity(video)
        mask_vid = (mask_video or '').strip()
        mask_img = (mask_image or '').strip()
        if mask_vid or mask_img:
            _need_video(video, "Particles")
            params['emitter'] = 'mask_edge'
            payload = particles_video(
                video, mask_vid or mask_img, params,
                mask_is_video=bool(mask_vid), progress=_progress_cb(cls))
            return _stage_emit_auto(cls, project_id=project_id,
                                    payload_str=payload,
                                    parent_output_id=parent_output_id)
        if params['emitter'] == 'mask_edge':
            raise RuntimeError(
                "Particles: mask-edge emitter needs a mask — wire mask_video "
                "or mask_image."
            )
        fx_spec = build_torch_fx_spec(
            "ComfyTV.ParticlesStage", "Particles", "video", "particles",
            params)
        return _fx_passthrough(video, fx_spec)
