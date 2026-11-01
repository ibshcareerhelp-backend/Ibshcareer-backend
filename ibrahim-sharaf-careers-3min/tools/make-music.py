"""Corporate instrumental bed: warm pad, soft piano arpeggio, light kick and hats; builds gently over the film.
    python tools/make-music.py assets/music/corporate-bed.wav 180"""
import sys
import numpy as np
import soundfile as sf

SR = 44100
DUR = int(sys.argv[2]) if len(sys.argv) > 2 else 30
N = SR * DUR
rng = np.random.default_rng(11)
BPM = 96
BEAT = 60 / BPM
t_all = np.arange(N, dtype=np.float32) / SR


def hz(name):
    base = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[name[0]]
    return 440.0 * 2 ** ((base + (int(name[1:]) + 1) * 12 - 69) / 12)


CHORDS = [("C3", ["C4", "E4", "G4", "C5"]), ("A2", ["C4", "E4", "A4", "C5"]), ("F2", ["C4", "F4", "A4", "C5"]), ("G2", ["B3", "D4", "G4", "B4"])]
BAR = 4 * BEAT
pad_cache = {}


def pad_note(f, dur, amp):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    x = np.zeros(n, dtype=np.float32)
    for det in (-0.004, 0.0, 0.004):
        ph = 2 * np.pi * f * (1 + det) * t + rng.random() * 6.28
        for h in range(1, 7):
            x += np.sin(h * ph) / h ** 1.4
    env = np.minimum(1, t / 0.9) * np.minimum(1, (dur - t) / 1.0)
    return (x * env * amp).astype(np.float32)


def piano(f, amp):
    n = int(2.4 * SR)
    t = np.arange(n, dtype=np.float32) / SR
    x = np.zeros(n, dtype=np.float32)
    for h in range(1, 8):
        x += (1.0 / h ** 1.1) * np.sin(2 * np.pi * f * h * np.sqrt(1 + 0.0004 * h * h) * t) * np.exp(-(1.4 + 1.0 * h) * t)
    return (x * np.minimum(1, t / 0.003) * np.exp(-0.6 * t) * amp).astype(np.float32)


def level(tt):  # 0..1 intensity across the film: gentle start, fuller middle, lift for the close
    return float(np.interp(tt, [0, 12, 40, 110, 150, DUR - 8, DUR], [0.45, 0.6, 0.75, 0.85, 1.0, 1.0, 0.8]))


pad = np.zeros(N, dtype=np.float32)
keys = np.zeros(N, dtype=np.float32)
bars = int(np.ceil(DUR / BAR))
for b in range(bars):
    low, tones = CHORDS[b % 4]
    s = int(b * BAR * SR)
    lv = level(b * BAR)
    for nm in [low] + tones[:3]:
        w = pad_note(hz(nm) * (0.5 if nm == low else 1.0), BAR + 0.8, (0.5 if nm != low else 0.8) * lv)
        e = min(N, s + len(w))
        pad[s:e] += w[: e - s]
    for k in range(8):
        tt = b * BAR + k * BEAT / 2
        if tt >= DUR - 3.0 or tt < 1.0:
            continue
        nm = tones[[0, 1, 2, 3, 2, 1, 2, 3][k]]
        w = piano(hz(nm), (0.22 + 0.14 * lv))
        s2 = int(tt * SR)
        e2 = min(N, s2 + len(w))
        keys[s2:e2] += w[: e2 - s2]

perc = np.zeros(N, dtype=np.float32)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n, dtype=np.float32) / SR
    f = 52 + 90 * np.exp(-28 * t)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-9 * t)).astype(np.float32)


def hat():
    n = int(0.06 * SR)
    t = np.arange(n, dtype=np.float32) / SR
    x = np.diff(rng.standard_normal(n + 1)).astype(np.float32)
    return x * np.exp(-60 * t) * 0.35


K, H = kick(), hat()
for i in range(int(DUR / BEAT)):
    tt = i * BEAT
    if tt < 8.0 or tt > DUR - 2.5:
        continue
    lv = level(tt)
    if i % 2 == 0:
        s = int(tt * SR); perc[s:s + len(K)] += K[: N - s][: len(K)] * 0.55 * lv
    s = int((tt + BEAT / 2) * SR)
    if s + len(H) < N:
        perc[s:s + len(H)] += H * (0.3 + 0.25 * lv)

mono = pad * 0.45 + keys * 1.0 + perc * 0.7
width = np.roll(pad, 700) * 0.15
mix = np.stack([mono + width, mono - width], axis=1)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= (np.minimum(1, t_all / 1.5) * np.minimum(1, (DUR - t_all) / 3.0))[:, None] * 0.85
sf.write(sys.argv[1], mix, SR, subtype="PCM_16")
print("ok")
