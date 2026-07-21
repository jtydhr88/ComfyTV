PRESET_FIELDS: dict[str, tuple[str, ...]] = {
    "ComfyTV.VideoColorStage": (
        "exposure", "black", "temperature", "temp_mix", "hue", "saturation",
        "vibrance", "blackpoint", "whitepoint",
        "shadows_r", "shadows_g", "shadows_b",
        "midtones_r", "midtones_g", "midtones_b",
        "highlights_r", "highlights_g", "highlights_b",
        "preserve_lightness",
    ),
    "ComfyTV.VideoCurvesStage": (
        "preset", "master_pts", "red_pts", "green_pts", "blue_pts",
    ),
    "ComfyTV.VideoLUTStage": ("lut_file", "interp"),
    "ComfyTV.VideoBlurSharpenStage": ("mode", "amount", "size", "edge_preserve"),
    "ComfyTV.VideoDenoiseStage": ("method", "strength"),
    "ComfyTV.VideoChromaKeyStage": (
        "key_color", "similarity", "blend", "despill_mix", "despill_expand",
        "output",
    ),
    "ComfyTV.VideoTransitionStage": (
        "transition", "duration", "luma_softness", "luma_invert",
    ),
    "ComfyTV.VideoStabilizeStage": ("range_x", "range_y", "edge"),
    "ComfyTV.VideoStabilizeV2Stage": (
        "smoothing", "accuracy", "opt_zoom", "extra_zoom",
    ),
    "ComfyTV.VideoDeinterlaceStage": ("method", "rate"),
    "ComfyTV.VideoInterpolateStage": (
        "mode", "target_fps", "slow_factor", "mi_mode",
    ),
    "ComfyTV.VideoStylizeStage": ("effect", "strength", "block"),
    "ComfyTV.SceneDetectStage": ("threshold", "min_gap_s", "output", "cut_mode"),
    "ComfyTV.VideoScopesStage": ("scope",),
    "ComfyTV.ColorGradeStage": ("grade_state",),
    "ComfyTV.HueCorrectStage": ("curves", "sat_thrsh", "luminance_mix"),
    "ComfyTV.SelectiveColorStage": (
        "sc_method",
        "sc_reds", "sc_yellows", "sc_greens", "sc_cyans", "sc_blues",
        "sc_magentas", "sc_whites", "sc_neutrals", "sc_blacks",
    ),
    "ComfyTV.ChromaShiftStage": (
        "shift_rh", "shift_rv", "shift_bh", "shift_bv", "shift_edge",
    ),
    "ComfyTV.PseudocolorStage": ("pseudo_preset", "pseudo_opacity"),
    "ComfyTV.PosterizeStage": ("elbg_colors", "elbg_steps"),
    "ComfyTV.GlowStage": (
        "threshold", "size", "bloom_ratio", "bloom_count", "gain", "mix",
    ),
    "ComfyTV.GodRaysStage": (
        "translate_x", "translate_y", "scale", "rotate_deg", "steps", "decay",
        "max_mode", "mix",
    ),
    "ComfyTV.OldFilmStage": (
        "delta", "every", "brightness_up", "brightness_down",
        "brightness_every", "develop_up", "develop_down", "develop_duration",
        "lines_num", "line_width", "lines_darker", "lines_lighter",
    ),
    "ComfyTV.FrameBlendStage": (
        "mode", "frame_min", "frame_max", "interval", "operation", "decay",
        "shutter", "shutter_type", "shutter_offset", "divisions",
    ),
    "ComfyTV.KenBurnsStage": (
        "width", "height", "fps", "duration", "start_zoom", "end_zoom",
        "interp",
    ),
    "ComfyTV.PatternStage": (
        "kind", "width", "height", "fps", "duration", "color0", "color1",
        "p0_x", "p0_y", "p1_x", "p1_y", "interp", "softness",
        "noise_scale", "noise_octaves", "noise_speed", "seed", "box_size",
        "bar_intensity", "wheel_gamma", "wheel_rotate",
        "count_style", "count_direction",
    ),
    "ComfyTV.PIKStage": (
        "screen", "pick_color", "red_weight", "blue_green_weight",
        "alpha_bias", "despill_bias", "use_alpha_bias", "screen_subtraction",
        "clip_black", "clip_white", "replace_mode", "replace_color", "output",
    ),
    "ComfyTV.KeyerStage": (
        "mode", "key_color", "softness_lower", "tolerance_lower", "center",
        "tolerance_upper", "softness_upper", "despill", "despill_angle",
        "output",
    ),
    "ComfyTV.DespillStage": (
        "screen", "spill_mix", "expand", "red_scale", "green_scale",
        "blue_scale", "brightness", "output_spillmap",
    ),
    "ComfyTV.ColorSuppressStage": (
        "red", "green", "blue", "cyan", "magenta", "yellow", "preserve_luma",
        "output",
    ),
    "ComfyTV.KeyMixStage": ("mix", "invert_mask"),
    "ComfyTV.MatteMorphStage": ("op", "size_x", "size_y"),
    "ComfyTV.MaskPropagateStage": ("model", "max_points", "invert"),
    "ComfyTV.AudioReactiveStage": (
        "band", "freq_lo", "freq_hi", "attack", "release", "rate",
        "min_value", "max_value", "gain", "field",
    ),
    "ComfyTV.AudioDynamicsStage": (
        "mode", "threshold_db", "ratio", "attack_ms", "release_ms",
        "makeup_db", "knee", "intensity",
    ),
    "ComfyTV.AudioEQStage": ("bands",),
    "ComfyTV.AudioLoudnessStage": (
        "mode", "target_i", "target_tp", "target_lra", "dyn_frame_ms",
        "dyn_gauss", "peak_target_db", "peak_mode", "use_rms",
        "rms_target_db", "use_lufs",
    ),
    "ComfyTV.AudioDenoiseStage": (
        "method", "strength", "silence_db", "min_silence_s", "keep_silence_s",
    ),
    "ComfyTV.AudioEchoStage": (
        "preset", "in_gain", "out_gain", "delay_ms", "decay",
    ),
    "ComfyTV.AudioModulationStage": (
        "mode", "ph_delay", "ph_decay", "ph_speed", "ph_type",
        "fl_delay", "fl_depth", "fl_regen", "fl_width", "fl_speed",
        "fl_shape", "fl_phase", "chorus_preset", "lfo_f", "lfo_d",
        "pu_hz", "pu_amount", "pu_width", "pu_mode",
    ),
    "ComfyTV.AudioStereoStage": (
        "mode", "sw_delay", "sw_feedback", "sw_crossfeed", "sw_drymix",
        "es_m", "cf_strength", "cf_range", "haas_side_gain",
        "haas_left_delay", "haas_right_delay", "balance",
    ),
    "ComfyTV.AudioTimePitchStage": ("mode", "tempo", "semitones"),
    "ComfyTV.AudioRepairStage": (
        "method", "dk_window", "dk_threshold", "dk_burst", "dc_threshold",
        "dc_hsize", "dn_level", "wt_sigma", "wt_percent", "wt_levels",
        "hum_freq", "hum_harmonics", "hum_q",
    ),
    "ComfyTV.AudioSaturateStage": (
        "mode", "sc_type", "sc_threshold", "py_clip", "py_adaptive",
        "cr_bits", "cr_mix", "cr_mode", "ex_amount", "ex_drive", "ex_blend",
        "ex_freq", "cz_i",
    ),
    "ComfyTV.AudioConvolveStage": ("wet", "dry", "normalize"),
    "ComfyTV.AudioCrossfadeStage": ("duration", "curve1", "curve2", "overlap"),
    "ComfyTV.AudioSweepStage": ("duration_s", "fmin", "fmax", "amp", "tail_s"),
    "ComfyTV.AudioDeconvolveStage": (
        "duration_s", "fmin", "fmax", "amp", "ir_len_s",
    ),
}
