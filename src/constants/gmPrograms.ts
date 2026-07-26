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
