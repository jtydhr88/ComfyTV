export const GM_NAMES = [
  'piano', 'bright_piano', 'e_piano', 'harpsichord', 'celesta', 'music_box',
  'vibraphone', 'marimba', 'organ', 'accordion', 'nylon_guitar',
  'steel_guitar', 'jazz_guitar', 'clean_guitar', 'overdrive_guitar',
  'acoustic_bass', 'finger_bass', 'pick_bass', 'violin', 'cello', 'harp',
  'strings', 'slow_strings', 'synth_strings', 'choir', 'voice_oohs',
  'trumpet', 'trombone', 'brass', 'alto_sax', 'tenor_sax', 'oboe',
  'clarinet', 'flute', 'pan_flute', 'square_lead', 'saw_lead', 'warm_pad',
]

export const GM_PROGRAM_NUMBERS: Record<string, number> = {
  piano: 0, bright_piano: 1, e_piano: 4, harpsichord: 6,
  celesta: 8, music_box: 10, vibraphone: 11, marimba: 12,
  organ: 19, accordion: 21, nylon_guitar: 24, steel_guitar: 25,
  jazz_guitar: 26, clean_guitar: 27, overdrive_guitar: 29,
  acoustic_bass: 32, finger_bass: 33, pick_bass: 34,
  violin: 40, cello: 42, harp: 46, strings: 48,
  slow_strings: 49, synth_strings: 50, choir: 52, voice_oohs: 53,
  trumpet: 56, trombone: 57, brass: 61, alto_sax: 65,
  tenor_sax: 66, oboe: 68, clarinet: 71, flute: 73,
  pan_flute: 75, square_lead: 80, saw_lead: 81, warm_pad: 89,
}

export function gmNameForProgram(program: number): string | null {
  for (const [name, num] of Object.entries(GM_PROGRAM_NUMBERS)) {
    if (num === program) return name
  }
  return null
}

export const GM_DRUMS: Record<number, string> = {
  35: 'Kick 2', 36: 'Kick', 37: 'Stick', 38: 'Snare', 39: 'Clap',
  40: 'Snare 2', 41: 'Tom Lo2', 42: 'HH Cl', 43: 'Tom Lo', 44: 'HH Pedal',
  45: 'Tom Mid', 46: 'HH Open', 47: 'Tom Mid2', 48: 'Tom Hi', 49: 'Crash',
  50: 'Tom Hi2', 51: 'Ride', 52: 'China', 53: 'Ride Bell', 54: 'Tamb',
  55: 'Splash', 56: 'Cowbell', 57: 'Crash 2', 58: 'Vibraslap', 59: 'Ride 2',
  60: 'Bongo Hi', 61: 'Bongo Lo', 62: 'Conga Mute', 63: 'Conga Hi',
  64: 'Conga Lo', 65: 'Timbale Hi', 66: 'Timbale Lo', 67: 'Agogo Hi',
  68: 'Agogo Lo', 69: 'Cabasa', 70: 'Maracas', 75: 'Claves',
  76: 'Woodblk Hi', 77: 'Woodblk Lo', 80: 'Tri Mute', 81: 'Tri Open',
}
