"""Synthesizes the soundtrack for launch-v6.html (120 BPM, A minor) — the v3–v5 instruments, a call-and-response arrangement.
Everything is placed from out/events-v6.json (node events.mjs --film v6). Each transcript card is a held breath: closed pads,
a soft key tick per word as it is read in and a bell on the amber word. Its flight into the footage is a falling whoosh
that lands with a thump, and the groove plays under the footage only, cutting out on the dip to ink before the next card.

    python soundtrack-v6.py  ->  out/soundtrack-v6.wav
"""
import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
EV = json.loads((Path(__file__).parent / 'out' / 'events-v6.json').read_text())
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
FLY = EV['fly']
CARDS = EV['cards']


def ui_click():
    t = t_arr(0.09)
    return (np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 90) * 0.5 + np.sin(2 * np.pi * 140 * t) * np.exp(-t * 40) * 0.6)


def key_tick(freq):
    # a typewriter-ish key: a short click plus a little body
    t = t_arr(0.07)
    n = rng.standard_normal(len(t))
    return (lowpass(n - lowpass(n, 1800), 6000) * np.exp(-t * 120) * 0.5 + np.sin(2 * np.pi * freq * t) * np.exp(-t * 70) * 0.35)


def fall(dur=0.62):
    # the flight: a whoosh whose filter falls as the word dives into the footage
    t = t_arr(dur)
    n = rng.standard_normal(len(t))
    cutoff = 6500 * (300 / 6500) ** (t / dur)
    return lowpass(n, cutoff) * np.sin(np.pi * np.minimum(1, t / dur * 1.1)) ** 2 * 0.9


def in_card(t):
    return any(c['start'] - 0.05 <= t < c['fly'] + FLY for c in CARDS)


# pads all the way through: closed and quiet on the cards, open under the footage
bar = 0
while bar * 2.0 < END:
    chord, _ = CHORDS[bar % 4]
    card = in_card(bar * 2.0) or in_card(bar * 2.0 + 1.0)
    pl, pr = pad([note(n) for n in chord], 2.15, 520 if card else 1500)
    add(pl, bar * 2.0, 0.13 if card else 0.11, pan=-0.6)
    add(pr, bar * 2.0, 0.13 if card else 0.11, pan=0.6)
    bar += 1

for ci, c in enumerate(CARDS):
    land = c['fly'] + FLY
    nxt = CARDS[ci + 1]['start'] if ci + 1 < len(CARDS) else LANG
    # A · the card: a low heartbeat under it, one key per word, a bell as the amber box grows behind the key word
    add(kick(0.38), c['start'] + 0.05)
    add(kick(0.3), c['start'] + 1.05)
    for i, ts in enumerate(c['words']):
        add(key_tick(1800 + 90 * i), ts, 0.16, pan=-0.3 + 0.6 * i / max(1, len(c['words']) - 1))
    add(bell(note(['E5', 'A5', 'C6', 'E5'][ci]), 2.2), c['key'] + 0.04, 0.12)
    add(bell(note(['A4', 'E5', 'G5', 'A4'][ci]), 2.2), c['key'] + 0.09, 0.07, pan=0.3)
    # B · the flight and the landing
    add(fall(FLY + 0.05), c['fly'] - 0.04, 0.4)
    add(riser(0.5, 400, 5000), c['fly'] - 0.5, 0.12)
    add(kick(1.2), land - 0.04)
    add(impact(), land - 0.04, 0.3)
    add(clap(), land - 0.04, 0.3)
    # C · the groove under the footage, cut on the dip to ink before the next card (half-time for the languages)
    stop = nxt - (0.0 if ci + 1 < len(CARDS) else -3.6) - 0.3
    t = land - 0.04 + BEAT
    b = 1
    while t < min(stop, END - 0.3):
        half = LANG <= t
        if not half or b % 2 == 0:
            add(kick(0.7), t)
        add(hat(), t + BEAT / 2, 0.4, pan=0.25)
        if b % 2 == 1 and not half:
            add(clap(), t, 0.3)
        t += BEAT
        b += 1
    t = land - 0.04
    k = 0
    while t < min(stop, END - 0.3):
        root = note(CHORDS[(k // 4) % 4][1])
        add(bass(root * (2 if k % 4 == 3 else 1), 0.22), t, 0.24)
        t += BEAT / 2
        k += 1
    if ci + 1 < len(CARDS):
        add(whoosh(0.45), nxt - 0.4, 0.16)

# every on-screen click; jump cuts inside a chapter get a breath of air
for ts in EV['clicks']:
    add(ui_click(), ts, 0.75)
for ts in EV['cuts']:
    if any(abs(ts - c['fly']) < 0.3 for c in CARDS):
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
with wave.open(str(out / 'soundtrack-v6.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out / 'soundtrack-v6.wav')
