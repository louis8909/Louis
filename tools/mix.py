# SFX bed + final mix for the 20 s cut. Cue time = where the sound's measured peak lands.
# Run from the Katana workspace: python3 tools/mix.py  (reads audio/sfx_cand/*, audio/music/music_edit.wav)
import json, subprocess, sys, numpy as np
SR = 48000
DUR = 20.0
M = json.load(open('audio/sfx_cand/measure.json'))
CUES = [  # (sfx id, peak time s, gain dB after -1 dBFS peak normalisation, note)
    (1491, 2.80, -8, 'whoosh: dive through the 0'),
    (2151, 2.88, -10, 'bass hit: drop / title'),
    (1491, 4.66, -9, 'whoosh: whip to the map'),
    (901, 7.60, -14, 'check: 공식 인증 badge'),
    (166, 8.62, -10, 'sweep: dive into 전주'),
    *[(2995, round(8.784 + k * 0.135 + 0.03, 3), -20, f'tick: {40 + 10 * k}년') for k in range(6)],
    (2151, 9.72, -14, 'bass hit: 100년'),
    (2050, 10.10, -12, 'swoosh: succession card flip'),
    (1491, 11.50, -9, 'whoosh: to the support cube'),
    (166, 12.55, -11, 'sweep: cube turn 2'),
    (166, 13.63, -11, 'sweep: cube turn 3'),
    (166, 14.71, -11, 'sweep: cube turn 4'),
    (1491, 15.82, -9, 'whoosh: cube exit'),
    (1469, 15.90, -12, 'impact: logo reveal'),
]
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
n = int(DUR * SR)
bed = np.zeros((n, 2), np.float32)
log = []
for sid, T, g, note in CUES:
    a = load(f'audio/sfx_cand/sfx{sid}.mp3')
    a *= 10 ** ((-1 - 20 * np.log10(np.abs(a).max() + 1e-9)) / 20) * 10 ** (g / 20)
    st = int(round((T - M[str(sid)]['peak']) * SR))
    if st < 0: a = a[-st:]; st = 0
    e = min(n, st + len(a))
    bed[st:e] += a[: e - st]
    log.append({'id': sid, 'title': M[str(sid)]['title'], 'peak_at': T, 'start': round(st / SR, 3), 'gain_db': g, 'note': note})
music = load('audio/music/music_edit.wav')[:n]
mix = music + bed
def wav(path, x):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', path], input=x.astype(np.float32).tobytes(), check=True)
wav('audio/sfx_bed.wav', bed)
wav('audio/premix.wav', mix)
json.dump({'cues': log}, open('audio/sfx_cues.json', 'w'), ensure_ascii=False, indent=1)
print('bed peak dB', round(20 * np.log10(np.abs(bed).max()), 2), 'premix peak dB', round(20 * np.log10(np.abs(mix).max()), 2))
# mastering (premix -15.1 LUFS): +2.7 dB, 4x-oversampled limiter at -1.6 dBFS, AAC 256k
#   ffmpeg -i audio/premix.wav -af "volume=2.7dB,aresample=192000,alimiter=limit=0.83:attack=1:release=50:level=disabled,aresample=48000" -c:a pcm_s24le audio/final_mix.wav
#   ffmpeg -i audio/final_mix.wav -c:a aac -b:a 256k audio/final_mix.m4a      -> -12.5 LUFS, -1.3 dBTP
