"""Synthesizes the soundtrack for launch-v5.html (120 BPM, A minor) — the v3/v4 instruments, new arrangement.
Everything is placed from out/events-v5.json (node events.mjs --film v5): a hushed cold open with a soft tick per
subtitle word, the clip settling into the editor, a tape-style rewind that follows the scrub speed and lands on the
first upload frame, the groove from there, a left-to-right swish for every playhead wipe, and every on-screen click.

    python soundtrack-v5.py  ->  out/soundtrack-v5.wav
"""
import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
EV = json.loads((Path(__file__).parent / 'out' / 'events-v5.json').read_text())
DUR = round(EV['duration'], 3)
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
END = EV['end']
LANG = EV['lang']
QUOTES = END + 0.45 + 1.1   # end-card quote punch (see buildLogo timings)
RW0, RWL = EV['rewind']['start'], EV['rewind']['len']
LAND = RW0 + RWL            # the rewind lands on the first upload frame; the groove starts here
SETTLE = EV['settle'][0]


def ui_click():
    t = t_arr(0.09)
    return (np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 90) * 0.5 + np.sin(2 * np.pi * 140 * t) * np.exp(-t * 40) * 0.6)


def add_sweep(sig, start, gain, p0, p1):
    # like add(), with the pan moving from p0 to p1 across the sound (the playhead crossing the frame)
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    pan = np.linspace(p0, p1, len(sig))
    L[i:i + len(sig)] += sig * gain * (1 - np.maximum(0, pan))
    R[i:i + len(sig)] += sig * gain * (1 + np.minimum(0, pan))


def rw_speed(t):
    # normalised scrub speed of the rewind (derivative of the in-out cubic used by the composer)
    u = np.clip((t - RW0) / RWL, 0, 1)
    return np.where(u < 0.5, 12 * u * u, 12 * (1 - u) ** 2) / 3


# pads: closed and low under the cold open, opening up once the rewind lands
bar = 0
while bar * 2.0 < END:
    chord, _ = CHORDS[bar % 4]
    cutoff = 560 if bar * 2.0 < RW0 else 1600
    pl, pr = pad([note(n) for n in chord], 2.15, cutoff)
    add(pl, bar * 2.0, 0.12, pan=-0.6)
    add(pr, bar * 2.0, 0.12, pan=0.6)
    bar += 1

# A · cold open: a soft heartbeat under the finished clip
t = 0.5
while t < SETTLE:
    add(kick(0.42), t)
    t += 1.0
for i, n in enumerate(['A4', 'E5']):
    add(bell(note(n), 2.4), 0.45 + i * 0.05, 0.05, pan=(-0.25 + i * 0.5))

# B · settle into the editor: a low thump and an air swell
add(whoosh(0.55), SETTLE - 0.1, 0.22)
add(kick(0.65), SETTLE + 0.35)

# C · rewind: chatter and a spinning tone that follow the scrub speed, a reverse swell into the landing
t = RW0
while t < LAND:
    v = float(rw_speed(t))
    add(tick(1100 + 2600 * v), t, 0.06 + 0.16 * v, pan=float(np.sin(t * 37) * 0.4))
    t += 1 / (9 + 60 * v)
tt = t_arr(RWL)
v = rw_speed(RW0 + tt)
spin = 2 * ((np.cumsum(90 + 820 * v) / SR) % 1) - 1
add(lowpass(spin, 1800) * v * np.minimum(1, tt / 0.15), RW0, 0.1)
add(riser(RWL, 500, 7000), RW0, 0.3)
add(impact(), LAND, 0.45)
add(kick(1.25), LAND)
add(clap(), LAND, 0.42)

# D · groove under the editor chapters; half-time for the language reveal
t = LAND + BEAT
while t < END - 0.3:
    b = round((t - LAND) / BEAT)
    half = LANG <= t < LANG + 3.6
    if not half or b % 2 == 0:
        add(kick(0.7), t)
    add(hat(), t + BEAT / 2, 0.4, pan=0.25)
    if b % 2 == 1 and not half:
        add(clap(), t, 0.3)
    t += BEAT
t = LAND + 2.0
while t < END - 0.3:
    root = note(CHORDS[int((t - LAND) // 2.0) % 4][1])
    add(bass(root * (2 if round((t - LAND) / (BEAT / 2)) % 4 == 3 else 1), 0.22), t, 0.24)
    t += BEAT / 2

# E · subtitle track: a faint tick as each word lands, a touch brighter on the last word of a line
for c in EV['cues']:
    for i, ts in enumerate(c['words']):
        last = i == len(c['words']) - 1
        add(tick(3300 if last else 2700), ts, 0.1 if last else 0.06)

# F · playhead wipes: a swish that crosses the stereo field left to right with the line
for ts in EV['wipes']:
    add_sweep(whoosh(0.7), ts - 0.08, 0.36, -0.85, 0.85)
    add(tick(2200), ts + 0.02, 0.18, pan=-0.6)

# every on-screen click; jump cuts inside a chapter get a breath of air
for ts in EV['clicks']:
    add(ui_click(), ts, 0.75)
for ts in EV['cuts']:
    if any(abs(ts - w) < 0.3 for w in EV['wipes'] + [LAND]):
        continue
    add(whoosh(0.4), ts - 0.18, 0.12)
add(whoosh(0.6), LANG - 0.25, 0.32)
add(tick(2600), LANG + 0.15, 0.3)
add(whoosh(0.6), END - 0.2, 0.35)

# end card: logo build + quote punch
for ts in (END + 0.45, END + 0.67, END + 1.0, END + 1.2):
    add(tick(2000), ts, 0.28)
add(impact(), QUOTES, 0.8)
add(kick(1.2), QUOTES)
add(kick(0.9), QUOTES + 0.15)
for i, n in enumerate(['A4', 'C5', 'E5', 'A5']):
    add(bell(note(n), 2.1), QUOTES + i * 0.06, 0.15, pan=(-0.4 + i * 0.27))
pl, pr = pad([note(n) for n in ['A3', 'C4', 'E4', 'A4']], 2.15, 1500)
add(pl, QUOTES, 0.2, pan=-0.6)
add(pr, QUOTES, 0.2, pan=0.6)

# ---------- master ----------
mix = np.stack([L, R], axis=1)
fade = np.ones(N)
fo = int(SR * 1.0)
fade[-fo:] = np.linspace(1, 0, fo) ** 2
mix *= fade[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix *= 0.89 / np.max(np.abs(mix))

out = Path(__file__).parent / 'out'
pcm = (mix * 32767).astype('<i2')
with wave.open(str(out / 'soundtrack-v5.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out / 'soundtrack-v5.wav')
