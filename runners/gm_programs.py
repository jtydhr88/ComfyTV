GM_PROGRAMS = {
    'piano': 0, 'bright_piano': 1, 'e_piano': 4, 'harpsichord': 6,
    'celesta': 8, 'music_box': 10, 'vibraphone': 11, 'marimba': 12,
    'organ': 19, 'accordion': 21, 'nylon_guitar': 24, 'steel_guitar': 25,
    'jazz_guitar': 26, 'clean_guitar': 27, 'overdrive_guitar': 29,
    'acoustic_bass': 32, 'finger_bass': 33, 'pick_bass': 34,
    'violin': 40, 'cello': 42, 'harp': 46, 'strings': 48,
    'slow_strings': 49, 'synth_strings': 50, 'choir': 52, 'voice_oohs': 53,
    'trumpet': 56, 'trombone': 57, 'brass': 61, 'alto_sax': 65,
    'tenor_sax': 66, 'oboe': 68, 'clarinet': 71, 'flute': 73,
    'pan_flute': 75, 'square_lead': 80, 'saw_lead': 81, 'warm_pad': 89,
}

GM_NAME_BY_PROGRAM = {v: k for k, v in GM_PROGRAMS.items()}
