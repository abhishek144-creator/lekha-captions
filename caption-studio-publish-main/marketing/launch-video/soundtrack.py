"""Synthesizes the 30s launch soundtrack (120 BPM, A minor) locked to launch.html's timeline.

    python soundtrack.py  ->  out/soundtrack.wav
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
DUR = 30.0
BEAT = 0.5  # 120 BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)  # fixed seed: identical output every run
L = np.zeros(N)
R = np.zeros(N)


def t_arr(dur):
    return np.arange(int(SR * dur)) / SR


def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * gain * (1 + min(0, pan))


def lowpass(x, cutoff):
    # one-pole low-pass; cutoff may be a scalar or a per-sample array
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def env(n, attack, release, total):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(attack, 1e-4))
    tail = np.clip((total - t) / max(release, 1e-4), 0, 1)
    return e * tail


def saw(freq, dur):
    t = t_arr(dur)
    return 2 * ((t * freq) % 1) - 1


def note(name):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + (octave - 4) * 12) / 12)


# ---------- instruments ----------
def kick(gain=1.0):
    t = t_arr(0.45)
    f = 45 + 120 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) * gain


def hat():
    t = t_arr(0.08)
    n = rng.standard_normal(len(t))
    n = n - lowpass(n, 7000)
    return n * np.exp(-t * 60) * 0.5


def clap():
    t = t_arr(0.25)
    n = rng.standard_normal(len(t))
    n = lowpass(n - lowpass(n, 900), 5000)
    e = np.exp(-t * 18) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * t) > 0) * (t < 0.03))
    return n * e * 0.7


def tick(freq=2400):
    t = t_arr(0.06)
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 80) * 0.5


def pad(freqs, dur, cutoff=1400):
    n = int(SR * dur)
    left = np.zeros(n)
    right = np.zeros(n)
    for f in freqs:
        left += saw(f * 0.997, dur)[:n] + 0.5 * saw(f * 2.003, dur)[:n]
        right += saw(f * 1.003, dur)[:n] + 0.5 * saw(f * 1.997, dur)[:n]
    e = env(n, 0.25, 0.4, dur)
    return lowpass(left, cutoff) * e / len(freqs), lowpass(right, cutoff) * e / len(freqs)


def bass(freq, dur):
    t = t_arr(dur)
    s = np.sin(2 * np.pi * freq * t) + 0.35 * np.sign(np.sin(2 * np.pi * freq * t))
    return lowpass(s, 600) * env(len(t), 0.005, 0.06, dur)


def riser(dur, f0=300, f1=6000):
    t = t_arr(dur)
    n = rng.standard_normal(len(t))
    cutoff = f0 * (f1 / f0) ** (t / dur)
    swell = (t / dur) ** 2
    return lowpass(n, cutoff) * swell


def whoosh(dur=0.6):
    t = t_arr(dur)
    n = rng.standard_normal(len(t))
    cutoff = 400 + 5000 * np.sin(np.pi * t / dur) ** 2
    return lowpass(n, cutoff) * np.sin(np.pi * t / dur) ** 2 * 0.8


def impact():
    t = t_arr(2.5)
    f = 38 + 90 * np.exp(-t * 10)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    n = rng.standard_normal(len(t))
    crash = lowpass(n, 3500) * np.exp(-t * 3.2) * 0.5
    return sub + crash


def bell(freq, dur=3.5):
    t = t_arr(dur)
    s = (np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 2)
         + 0.25 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 4))
    return s * np.exp(-t * 1.1) * env(len(t), 0.002, 0.3, dur)


# ---------- arrangement ----------
CHORDS = [  # one bar (2s) each, A minor: Am – F – C – G
    (['A3', 'C4', 'E4'], 'A1'),
    (['F3', 'A3', 'C4'], 'F1'),
    (['C3', 'E3', 'G3', 'C4'], 'C2'),
    (['G3', 'B3', 'D4'], 'G1'),
]

# Pads under everything up to the logo (dark/low-pass in the intro, opening up later)
for bar in range(13):
    start = bar * 2.0
    if start >= 25:
        break
    chord, _ = CHORDS[bar % 4]
    cutoff = 700 if start < 4 else (1100 if start < 7.5 else 1800)
    pl, pr = pad([note(n) for n in chord], 2.15, cutoff)
    add(pl, start, 0.16, pan=-0.6)
    add(pr, start, 0.16, pan=0.6)

# Scene A word ticks (match the word-pop timings in launch.html)
for i, ts in enumerate([0.45, 0.72, 1.12, 1.4, 1.85, 2.15]):
    add(tick(1800 + i * 120), ts, 0.35)
add(riser(1.0, 200, 4000), 3.98, 0.25)  # swell into "So make every word"

# "LAND." slam
add(impact(), 4.98, 0.9)
add(kick(1.2), 4.98)

# Groove: half-time 5.5–7.5, full groove from 7.5 until the pre-logo drop at 24.5
t = 5.5
while t < 24.5 - 1e-6:
    full = t >= 7.5
    beat_idx = round(t / BEAT)
    if full or beat_idx % 2 == 0:
        add(kick(0.95), t)
    if full:
        add(hat(), t + BEAT / 2, 0.55, pan=0.25)
        if beat_idx % 2 == 1:
            add(clap(), t, 0.5)
    t += BEAT

# Bass: eighth-note roots from 7.5 → 24.5
t = 7.5
while t < 24.5 - 1e-6:
    bar = int(t // 2.0)
    root = note(CHORDS[bar % 4][1])
    octave_up = 2 if round(t / (BEAT / 2)) % 4 == 3 else 1
    add(bass(root * octave_up, 0.22), t, 0.32)
    t += BEAT / 2

# Language swaps + template swaps get a soft tick
for ts in [9.0, 10.0, 11.0, 12.0]:
    add(tick(2600), ts, 0.22, pan=0.3)
for ts in [13.45, 14.45, 15.45, 16.45, 17.45, 18.45]:
    add(tick(3000), ts, 0.2, pan=-0.3)

# Scene transitions
for ts in [7.25, 12.75, 19.25]:
    add(whoosh(0.6), ts, 0.35)

# Pre-logo riser, short breath, then the logo impact + bell chord
add(riser(1.5, 300, 9000), 23.4, 0.42)
add(impact(), 25.0, 1.0)
add(kick(1.3), 25.0)
for i, n in enumerate(['A4', 'C5', 'E5', 'A5']):
    add(bell(note(n), 4.8), 25.0 + i * 0.06, 0.16, pan=(-0.4 + i * 0.27))
pl, pr = pad([note(n) for n in ['A3', 'C4', 'E4', 'A4']], 5.0, 1500)
add(pl, 25.0, 0.2, pan=-0.6)
add(pr, 25.0, 0.2, pan=0.6)
# gentle arpeggio over the end card
for i, n in enumerate(['E5', 'A5', 'C6', 'E6', 'C6', 'A5', 'E5', 'A5']):
    add(bell(note(n), 1.6), 26.0 + i * 0.5, 0.06, pan=(0.3 if i % 2 else -0.3))

# ---------- master ----------
mix = np.stack([L, R], axis=1)
fade = np.ones(N)
fo = int(SR * 1.2)
fade[-fo:] = np.linspace(1, 0, fo) ** 2
mix *= fade[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)  # soft clip / glue
mix *= 0.89 / np.max(np.abs(mix))

out = Path(__file__).parent / 'out'
out.mkdir(exist_ok=True)
pcm = (mix * 32767).astype('<i2')
with wave.open(str(out / 'soundtrack.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out / 'soundtrack.wav')
