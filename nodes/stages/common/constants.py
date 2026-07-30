RESOLUTIONS = ["480P", "720P", "1K", "1080P", "1440P", "2K", "2160P", "4K"]
ASPECT_RATIOS = [
    "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "21:9",
]

VIDEO_DURATION_MIN_S = 1
VIDEO_DURATION_MAX_S = 120
VIDEO_DURATION_DEFAULT_S = 5

SPEECH_LANGUAGES = [
    "Auto",
    "English", "English (British)", "Mandarin Chinese", "Japanese", "Korean",
    "French", "German", "Spanish", "Brazilian Portuguese", "Portuguese",
    "Italian", "Hindi", "Russian", "Arabic",
]

ACE_TIME_SIGNATURES = ['2', '3', '4', '6']
ACE_LANGUAGES = [
    'ar', 'az', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa',
    'fi', 'fr', 'he', 'hi', 'hr', 'ht', 'hu', 'id', 'is', 'it', 'ja', 'ko',
    'la', 'lt', 'ms', 'ne', 'nl', 'no', 'pa', 'pl', 'pt', 'ro', 'ru', 'sa',
    'sk', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tl', 'tr', 'uk', 'ur', 'vi',
    'yue', 'zh', 'unknown',
]
ACE_KEYSCALES = [
    f"{root} {quality}"
    for quality in ["major", "minor"]
    for root in ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb",
                 "G", "G#", "Ab", "A", "A#", "Bb", "B"]
]
