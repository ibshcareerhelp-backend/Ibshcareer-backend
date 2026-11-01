"""Synthesises the film's background bed: a choir-like "ah" pad, kalimba plucks and hand drums.

    python tools/make-bed.py assets/music/african-bed.wav

Needs numpy and soundfile only. Deterministic (seeded). 300 s, stereo, 44.1 kHz.
Intensity follows the five 60 s chapters: quiet opening, drums enter in II, a darker III,
an uplifting IV and a full finale in V.
"""
import sys
import numpy as np
import soundfile as sf

SR = 44100
DUR = 300
N = SR * DUR
rng = np.random.default_rng(7)
t_all = np.arange(N, dtype=np.float32) / SR


def note(name):
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n = names[name[0]]
    rest = name[1:]
    if rest.startswith("b"):
        n -= 1
        rest = rest[1:]
    return 440.0 * 2 ** ((n + (int(rest) + 1) * 12 - 69) / 12)


# ---------- choir-like pad: harmonic stack shaped by "ah" formants ----------
FORMANTS = [(800, 110, 1.0), (1150, 130, 0.55), (2900, 250, 0.2)]


def voice_note(f, dur, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n, dtype=np.float32) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * (5.1 + 0.3 * rng.random()) * t + rng.random() * 6.28)
    phase = 2 * np.pi * np.cumsum(f * vib) / SR
    out = np.zeros(n, dtype=np.float32)
    for h in range(1, 28):
        fh = f * h
        if fh > 5000:
            break
        w = sum(a * np.exp(-0.5 * ((fh - c) / bw) ** 2) for c, bw, a in FORMANTS) + 0.06
        out += (w / h ** 0.6) * np.sin(h * phase + rng.random() * 6.28)
    attack = np.minimum(1, t / 3.0)
    release = np.minimum(1, (dur - t) / 3.5)
    return (out * attack * release * amp).astype(np.float32)


CH = {
    # chapter: chords of (low note, [voices]) — four per chapter, 15 s each
    0: [("D2", ["D3", "A3", "D4"]), ("Bb1", ["D3", "F3", "Bb3"]), ("C2", ["E3", "G3", "C4"]), ("A1", ["E3", "A3", "C4"])],
    1: [("D2", ["F3", "A3", "D4"]), ("G1", ["D3", "G3", "Bb3"]), ("Bb1", ["D3", "F3", "Bb3"]), ("A1", ["E3", "A3", "C4"])],
    2: [("D2", ["D3", "F3", "A3"]), ("G1", ["D3", "G3", "Bb3"]), ("A1", ["E3", "A3", "C4"]), ("D2", ["F3", "A3", "D4"])],
    3: [("Bb1", ["F3", "Bb3", "D4"]), ("C2", ["G3", "C4", "E4"]), ("D2", ["A3", "D4", "F4"]), ("C2", ["G3", "C4", "E4"])],
    4: [("Bb1", ["F3", "Bb3", "D4"]), ("C2", ["G3", "C4", "E4"]), ("D2", ["A3", "D4", "F4"]), ("D2", ["A3", "D4", "A4"])],
}
PAD_LEVEL = [0.55, 0.6, 0.5, 0.7, 0.8]

pad = np.zeros(N, dtype=np.float32)
drone = np.zeros(N, dtype=np.float32)
for ch, chords in CH.items():
    for i, (low, voices) in enumerate(chords):
        start = ch * 60 + i * 15 - (0 if (ch == 0 and i == 0) else 2.5)
        dur = 15 + (0 if (ch == 0 and i == 0) else 2.5) + 2.5
        s = int(start * SR)
        for v in voices:
            w = voice_note(note(v), dur, PAD_LEVEL[ch] * 0.5)
            e = min(N, s + len(w))
            pad[s:e] += w[: e - s]
        d = voice_note(note(low), dur, 0.9)
        e = min(N, s + len(d))
        drone[s:e] += d[: e - s]

# ---------- kalimba plucks, D minor pentatonic ----------
PENTA = ["D4", "F4", "G4", "A4", "C5", "D5", "F5"]
DENS = [0.22, 0.42, 0.3, 0.6, 0.5]
BEAT = 60 / 96
pluck = np.zeros(N, dtype=np.float32)


def kalimba(f, amp):
    n = int(2.6 * SR)
    t = np.arange(n, dtype=np.float32) / SR
    x = (np.sin(2 * np.pi * f * t) + 0.32 * np.sin(2 * np.pi * f * 3.0 * t) * np.exp(-9 * t)
         + 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-14 * t))
    return (x * np.exp(-2.6 * t) * np.minimum(1, t / 0.004) * amp).astype(np.float32)


k = 0
pos = 0.0
last = 3
while pos < DUR - 3:
    ch = min(4, int(pos // 60))
    if rng.random() < DENS[ch]:
        last = int(np.clip(last + rng.integers(-2, 3), 0, len(PENTA) - 1))
        w = kalimba(note(PENTA[last]), 0.22 * (0.7 + 0.3 * rng.random()))
        s = int(pos * SR)
        e = min(N, s + len(w))
        pluck[s:e] += w[: e - s]
    pos += BEAT / 2
    k += 1

# ---------- hand drums: enter in chapter II ----------
drum = np.zeros(N, dtype=np.float32)


def hit(low, amp):
    n = int(0.5 * SR)
    t = np.arange(n, dtype=np.float32) / SR
    f = (95 if low else 150) * (1 + 1.4 * np.exp(-30 * t))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-(9 if low else 14) * t)
    slap = rng.standard_normal(n).astype(np.float32) * np.exp(-60 * t) * 0.35
    return ((body + slap) * amp).astype(np.float32)


PATTERNS = {
    1: [(0, 1, 0.8), (4, 0, 0.35), (6, 0, 0.35)],
    2: [(0, 1, 0.9), (3, 1, 0.5), (8, 1, 0.8)],
    3: [(0, 1, 0.8), (2, 0, 0.4), (4, 0, 0.5), (6, 0, 0.35), (8, 1, 0.7), (10, 0, 0.4), (12, 0, 0.5), (14, 0, 0.35)],
    4: [(0, 1, 0.9), (2, 0, 0.45), (4, 0, 0.55), (6, 0, 0.4), (8, 1, 0.8), (10, 0, 0.45), (12, 0, 0.55), (13, 0, 0.35), (14, 0, 0.5)],
}
bar = BEAT * 4
n_bars = int(DUR // bar)
for b in range(n_bars):
    t0 = b * bar
    ch = int(t0 // 60)
    if ch not in PATTERNS or t0 < 62 or t0 > 281:
        continue
    for step, low, a in PATTERNS[ch]:
        s = int((t0 + step * BEAT / 4) * SR)
        w = hit(bool(low), 0.5 * a)
        e = min(N, s + len(w))
        if s < N:
            drum[s:e] += w[: e - s]

# ---------- mix, sweep slow movement into stereo ----------
mono = pad * 0.75 + drone * 0.5 + pluck + drum * 0.9
pan = 0.5 + 0.18 * np.sin(2 * np.pi * t_all / 23.0)
left = mono * np.sqrt(1 - pan) + np.roll(pad, 900) * 0.2
right = mono * np.sqrt(pan) + np.roll(pad, -900) * 0.2
mix = np.stack([left, right], axis=1)
mix /= np.max(np.abs(mix)) + 1e-9
fade_in = np.minimum(1, t_all / 3.0)
fade_out = np.minimum(1, (DUR - t_all) / 6.0)
mix *= (fade_in * fade_out)[:, None] * 0.85
sf.write(sys.argv[1] if len(sys.argv) > 1 else "bed.wav", mix, SR, subtype="PCM_16")
print("ok", mix.shape)
