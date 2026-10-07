"""Synthesizes the 32s soundtrack for launch-v2.html (120 BPM, A minor), locked to its events.

    python soundtrack-v2.py  ->  out/soundtrack-v2.wav
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
DUR = 32.0
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
CHORDS = [(['A3', 'C4', 'E4'], 'A1'), (['F3', 'A3', 'C4'], 'F1'), (['C3', 'E3', 'G3', 'C4'], 'C2'), (['G3', 'B3', 'D4'], 'G1')]


def ui_click():
    t = t_arr(0.09)
    return (np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 90) * 0.5 + np.sin(2 * np.pi * 140 * t) * np.exp(-t * 40) * 0.6)


def chime(start, gain=0.14):
    for i, n in enumerate(['E5', 'A5', 'C6']):
        add(bell(note(n), 2.2), start + i * 0.07, gain, pan=(-0.3 + i * 0.3))


# pads under the whole film (dark on the cream intro, opening up in the editor)
for bar in range(15):
    start = bar * 2.0
    if start >= 28.3:
        break
    chord, _ = CHORDS[bar % 4]
    cutoff = 800 if start < 3.5 else 1700
    pl, pr = pad([note(n) for n in chord], 2.15, cutoff)
    add(pl, start, 0.14, pan=-0.6)
    add(pr, start, 0.14, pan=0.6)

# S1 logo build
for ts in (0.25, 0.47, 0.8, 1.0):
    add(tick(2000), ts, 0.3)
for ts in (1.35, 1.5):
    add(kick(0.7), ts)
    add(tick(1500), ts, 0.35)
add(whoosh(0.6), 2.75, 0.4)
add(impact(), 3.45, 0.55)

# S2 statement: word drops + the punch
for ts in (3.6, 3.88, 4.16, 4.6, 5.16):
    add(tick(2300), ts, 0.28)
add(kick(1.1), 4.88)
add(clap(), 4.88, 0.5)

# groove 5.5 -> 28.2 (breathes out for the language reveal)
t = 5.5
while t < 28.2 - 1e-6:
    b = round(t / BEAT)
    in_lang = 19.9 <= t < 20.5
    if not in_lang:
        add(kick(0.75), t)
        add(hat(), t + BEAT / 2, 0.45, pan=0.25)
        if b % 2 == 1 and t >= 7.5:
            add(clap(), t, 0.35)
    t += BEAT
t = 7.5
while t < 28.2 - 1e-6:
    root = note(CHORDS[int(t // 2.0) % 4][1])
    add(bass(root * (2 if round(t / (BEAT / 2)) % 4 == 3 else 1), 0.22), t, 0.26)
    t += BEAT / 2

# camera moves + scene changes
for ts in (6.75, 16.1, 19.75, 24.1, 28.2):
    add(whoosh(0.6), ts, 0.33)
# cursor clicks: Upload New, T167 card, EXPORT
for ts in (8.5, 15.85, 25.4):
    add(ui_click(), ts, 0.8)
# upload progress hum
up = np.sin(2 * np.pi * np.cumsum(np.linspace(300, 900, int(SR * 0.9))) / SR) * np.linspace(0, 1, int(SR * 0.9)) ** 2 * 0.12
add(up, 8.6)
add(tick(2600), 9.55, 0.3)
# transcription: one tick per word chip
for i in range(6):
    add(tick(1900 + i * 110), 11.9 + i * 0.3, 0.26)
# T167 on the preview: drops + punch on "strategy"
for n in range(7):
    ts = 16.9 + n * 0.28
    if n == 3:
        add(kick(0.9), ts)
        add(tick(1400), ts, 0.4)
    else:
        add(tick(2400), ts, 0.2)
# languages: same template, four at once
for n in range(5):
    add(tick(2200 + n * 90), 20.55 + n * 0.28, 0.24, pan=(-0.4 if n % 2 else 0.4))
add(kick(0.8), 20.55 + 0.28 * 3)
# export: riser under the progress bar, success chime
add(riser(1.2, 300, 6000), 25.75, 0.3)
chime(27.05)
for ts in (27.15, 27.27, 27.39):
    add(tick(2800), ts, 0.22)
# end card: logo build + quotes punch
for ts in (28.75, 28.97, 29.3, 29.5):
    add(tick(2000), ts, 0.28)
add(impact(), 29.85, 0.8)
add(kick(1.2), 29.85)
add(kick(0.9), 30.0)
for i, n in enumerate(['A4', 'C5', 'E5', 'A5']):
    add(bell(note(n), 2.1), 29.85 + i * 0.06, 0.15, pan=(-0.4 + i * 0.27))
pl, pr = pad([note(n) for n in ['A3', 'C4', 'E4', 'A4']], 2.15, 1500)
add(pl, 29.85, 0.2, pan=-0.6)
add(pr, 29.85, 0.2, pan=0.6)

# ---------- master ----------
mix = np.stack([L, R], axis=1)
fade = np.ones(N)
fo = int(SR * 1.0)
fade[-fo:] = np.linspace(1, 0, fo) ** 2
mix *= fade[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix *= 0.89 / np.max(np.abs(mix))

out = Path(__file__).parent / 'out'
out.mkdir(exist_ok=True)
pcm = (mix * 32767).astype('<i2')
with wave.open(str(out / 'soundtrack-v2.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out / 'soundtrack-v2.wav')
