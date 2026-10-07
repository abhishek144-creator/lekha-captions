"""Synthesizes the 32.82 s soundtrack for launch-v2c.html (the CPT film), 120 BPM, A minor — the v2b score with the
middle rewritten for the CPT ("Reels Giant") section: a swish per drag, a snap tick whenever a smart guide appears,
a rising sweep as the giant grows, a chime as the giant turns yellow, and one tick per word (a hit on the giant) on playback.

    python soundtrack-v2c.py  ->  out/soundtrack-v2c.wav
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
DUR = 32.82
BEAT = 0.5  # 120 BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)  # fixed seed: identical output every run
L = np.zeros(N)
R = np.zeros(N)


def t_arr(dur):
    return np.arange(int(SR * dur)) / SR


# the CPT authoring (9.4–14.3 s in the original cue sheet) plays 30% slower; everything after it moves 1.47 s later
def M(t):
    if t < 9.4:
        return t
    if t <= 14.3:
        return 9.4 + (t - 9.4) * 1.3
    return t + 1.47


def addm(sig, start, gain=1.0, pan=0.0):
    add(sig, M(start), gain, pan)


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


# pads under the whole film
for bar in range(16):
    start = bar * 2.0
    if start >= 29.12:
        break
    chord, _ = CHORDS[bar % 4]
    pl, pr = pad([note(n) for n in chord], 2.15, 1700)
    add(pl, start, 0.14, pan=-0.6)
    add(pr, start, 0.14, pan=0.6)

# opening hit (the film now opens straight on the statement)
add(impact(), 0.02, 0.4)

# hook (a CPT): a tick per satellite word, the punch as the giant "anywhere." rises
for ts in (0.15, 0.32, 0.49, 1.45, 1.6, 1.75):
    add(tick(2300), ts, 0.28)
add(kick(1.1), 0.85)
add(clap(), 0.85, 0.5)

# groove 2.05 -> 29.02 (breathes out for the language reveal)
t = 2.05
while t < 29.02 - 1e-6:
    b = round((t - 2.05) / BEAT)
    in_lang = 20.72 <= t < 21.32
    if not in_lang:
        add(kick(0.75), t)
        add(hat(), t + BEAT / 2, 0.45, pan=0.25)
        if b % 2 == 1 and t >= 4.05:
            add(clap(), t, 0.35)
    t += BEAT
t = 4.05
while t < 29.02 - 1e-6:
    root = note(CHORDS[int((t - 0.05) // 2.0) % 4][1])
    add(bass(root * (2 if round((t - 0.05) / (BEAT / 2)) % 4 == 3 else 1), 0.22), t, 0.26)
    t += BEAT / 2

# camera moves + scene changes (into the editor, word editor, gallery, preview, languages, export, end)
for ts in (3.3, 8.4, 15.05, 19.1, 23.45, 27.55):
    addm(whoosh(0.6), ts, 0.33)
# cursor clicks: Upload New, every press in the CPT section, EXPORT
for ts in (5.05, 9.4, 10.0, 10.6, 10.95, 11.25, 12.0, 12.85, 13.35, 13.75, 24.75):
    addm(ui_click(), ts, 0.8)
# upload progress hum
up = np.sin(2 * np.pi * np.cumsum(np.linspace(300, 900, int(SR * 0.9))) / SR) * np.linspace(0, 1, int(SR * 0.9)) ** 2 * 0.12
addm(up, 5.15)
addm(tick(2600), 6.1, 0.3)
# captions are there as the video lands; one tick per word chip on the timeline
for i in range(6):
    addm(tick(1900 + i * 110), 6.5 + i * 0.26, 0.26)
# CPT ("Reels Giant"): a swish for every drag, a snap tick when a smart guide shows, a rising sweep as the giant grows
for t0, dur in ((9.4, 0.45), (11.25, 0.3), (12.0, 0.3), (12.85, 0.35), (13.35, 0.25), (13.75, 0.25)):
    addm(whoosh(dur + 0.1), t0, 0.1)
for ts in (9.62, 11.42, 12.18, 13.05, 13.48, 13.9):
    addm(tick(3600), ts, 0.15)
    addm(tick(4800), ts + 0.03, 0.08)
dt = t_arr(0.45)
addm(np.sin(2 * np.pi * np.cumsum(420 + 1100 * dt / 0.45) / SR) * np.sin(np.pi * dt / 0.45) * 0.1, 10.0)
# word panel opens; a soft chime as the giant turns yellow
addm(whoosh(0.35), 10.62, 0.18)
for ts, g in ((10.95, 0.07),):
    for i, n in enumerate(['A5', 'E6']):
        addm(bell(note(n), 1.2), ts + 0.02 + i * 0.05, g, pan=(-0.2 + i * 0.4))
# playback: the layout clears, then each word rises into place (a hit as the giant lands)
addm(whoosh(0.3), 15.35, 0.12)
for i, ts in enumerate((15.65, 15.85, 16.05, 16.4, 16.85, 17.05)):
    if i == 3:
        addm(kick(1.0), ts)
        addm(impact(), ts, 0.18)
    else:
        addm(tick(2300 + i * 120), ts, 0.24, pan=(-0.3 + i * 0.12))
# languages: same template, four at once
# languages: the same CPT rises word by word on all four cards
for n in range(8):
    addm(tick(2200 + n * 80), 19.9 + n * 0.17, 0.2, pan=(-0.4 if n % 2 else 0.4))
addm(kick(0.8), 20.24)
# export: riser under the progress bar, success chime
addm(riser(1.2, 300, 6000), 25.1, 0.3)
chime(26.4)
for ts in (26.5, 26.62, 26.74):
    addm(tick(2800), ts, 0.22)
# end card: logo build + quotes punch
for ts in (28.1, 28.32, 28.65, 28.85):
    addm(tick(2000), ts, 0.28)
addm(impact(), 29.2, 0.8)
addm(kick(1.2), 29.2)
addm(kick(0.9), 29.35)
for i, n in enumerate(['A4', 'C5', 'E5', 'A5']):
    addm(bell(note(n), 2.1), 29.2 + i * 0.06, 0.15, pan=(-0.4 + i * 0.27))
pl, pr = pad([note(n) for n in ['A3', 'C4', 'E4', 'A4']], 2.15, 1500)
addm(pl, 29.2, 0.2, pan=-0.6)
addm(pr, 29.2, 0.2, pan=0.6)

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
with wave.open(str(out / 'soundtrack-v2c.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out / 'soundtrack-v2c.wav')
