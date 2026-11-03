"""Synthesizes the 43.88 s soundtrack for launch-v2d.html (v2b + v2c merged), 120 BPM, A minor — the v2b score straight
from the transcript to the template, an Undo beat, a one-bar part-2 title card ("Place your words creatively."), the
v2c word-placement cues with a one-bar colour pick (word → Style → green gradient), the languages cues and the
v2c export / end card. Cues are written in the film's own clock and mapped to real time by add(), as the page does.

    python soundtrack-v2d.py  ->  out/soundtrack-v2d.wav
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
DUR = 43.88
BEAT = 0.5  # 120 BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)  # fixed seed: identical output every run
L = np.zeros(N)
R = np.zeros(N)
END = 40.18  # end card wipes in (cue times below are in the film's own clock — see real())
# each change is one bar, so the groove stays on the beat (same constants as launch-v2d.html)
CUT_AT, CUT = 8.6, 4.0          # part 1 skips straight from the transcript to the template
TITLE_AT, TITLE_DT = 20.2, 2.0  # the part-2 title card
COLOR_AT, COLOR_DT = 22.6, 2.0  # the colour pick inside the placement
L0 = 31.73   # languages section


def t_arr(dur):
    return np.arange(int(SR * dur)) / SR


def _add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - max(0, pan))
    R[i:i + len(sig)] += sig * gain * (1 + min(0, pan))


def real(b):
    # the film's clock → real time; None inside the part-1 cut
    if CUT_AT <= b < CUT_AT + CUT:
        return None
    r = b if b < CUT_AT else b - CUT
    if b >= TITLE_AT - 1e-9:
        r += TITLE_DT
    if b >= COLOR_AT - 1e-9:
        r += COLOR_DT
    return r


def add(sig, start, gain=1.0, pan=0.0):
    r = real(start)
    if r is not None:
        _add(sig, r, gain, pan)


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
for bar in range(23):
    start = bar * 2.0
    if start >= END:
        break
    chord, _ = CHORDS[bar % 4]
    pl, pr = pad([note(n) for n in chord], 2.15, 1700)
    add(pl, start, 0.14, pan=-0.6)
    add(pr, start, 0.14, pan=0.6)

# opening hit (the film opens straight on the statement)
add(impact(), 0.02, 0.4)

# hook "You speak. / Lekha creates.": word drops + the punch on "creates."
for ts in (0.15, 0.43, 1.15):
    add(tick(2300), ts, 0.28)
add(kick(1.1), 1.43)
add(clap(), 1.43, 0.5)

# groove 2.05 -> END (breathes out for the language reveal)
t = 2.05
while t < END - 0.1 - 1e-6:
    b = round((t - 2.05) / BEAT)
    in_lang = L0 + 0.05 <= t < L0 + 0.65
    if not in_lang:
        add(kick(0.75), t)
        add(hat(), t + BEAT / 2, 0.45, pan=0.25)
        if b % 2 == 1 and t >= 4.05:
            add(clap(), t, 0.35)
    t += BEAT
t = 4.05
while t < END - 0.1 - 1e-6:
    root = note(CHORDS[int((t - 0.05) // 2.0) % 4][1])
    add(bass(root * (2 if round((t - 0.05) / (BEAT / 2)) % 4 == 3 else 1), 0.22), t, 0.26)
    t += BEAT / 2

# camera moves + scene changes: editor, gallery, template preview, pull back for Undo, into the placement,
# playback, languages, export, end
for ts in (3.3, 12.6, 15.45, 18.6, 20.2, 27.58, L0 - 0.1, 35.98, 40.08):
    add(whoosh(0.6), ts, 0.33)
# cursor clicks: Upload New, T167 card, Undo, every press of the placement, EXPORT
for ts in (5.05, 15.2, 19.6, 21.1, 21.88, 22.865, 23.84, 24.945, 25.595, 26.115, 37.28):
    add(ui_click(), ts, 0.8)
# upload progress hum
up = np.sin(2 * np.pi * np.cumsum(np.linspace(300, 900, int(SR * 0.9))) / SR) * np.linspace(0, 1, int(SR * 0.9)) ** 2 * 0.12
add(up, 5.15)
add(tick(2600), 6.1, 0.3)
# captions are there as the video lands; one tick per word chip on the timeline
for i in range(6):
    add(tick(1900 + i * 110), 6.5 + i * 0.26, 0.26)
# T167 on the preview: drops + punch on "strategy"
for n in range(7):
    ts = 16.25 + n * 0.28
    if n == 3:
        add(kick(0.9), ts)
        add(tick(1400), ts, 0.4)
    else:
        add(tick(2400), ts, 0.2)
# Undo: the template lifts off — a short soft swish and a low tick
add(whoosh(0.3), 19.62, 0.14)
add(tick(1200), 19.62, 0.22)
# word placement: a swish for every drag, a snap tick when a smart guide shows, a rising sweep as the giant grows
for t0, t1 in ((21.1, 21.685), (22.865, 23.255), (23.84, 24.23), (24.945, 25.4), (25.595, 25.92), (26.115, 26.44)):
    add(whoosh(t1 - t0 + 0.1), t0, 0.1)
for ts in (21.386, 23.086, 24.074, 25.205, 25.764, 26.31):
    add(tick(3600), ts, 0.15)
    add(tick(4800), ts + 0.03, 0.08)
dt = t_arr(0.45)
add(np.sin(2 * np.pi * np.cumsum(420 + 1100 * dt / 0.45) / SR) * np.sin(np.pi * dt / 0.45) * 0.1, 21.88)
# playback: the layout clears, then each word rises into place (a hit as the giant lands)
add(whoosh(0.3), 27.88, 0.12)
for i, ts in enumerate((28.18, 28.38, 28.58, 28.93, 29.38, 29.58)):
    if i == 3:
        add(kick(1.0), ts)
        add(impact(), ts, 0.18)
    else:
        add(tick(2300 + i * 120), ts, 0.24, pan=(-0.3 + i * 0.12))
# languages: the same placed words rise word by word on all four cards
for n in range(8):
    add(tick(2200 + n * 80), L0 + 0.7 + n * 0.17, 0.2, pan=(-0.4 if n % 2 else 0.4))
add(kick(0.8), L0 + 0.7 + 0.34)
# export: riser under the progress bar, success chime on "Ready to share."
add(riser(1.2, 300, 6000), 37.63, 0.3)
chime(38.93)
for ts in (39.03, 39.15, 39.27):
    add(tick(2800), ts, 0.22)
# end card: logo build + quotes punch
for ts in (40.63, 40.85, 41.18, 41.38):
    add(tick(2000), ts, 0.28)
add(impact(), 41.73, 0.8)
add(kick(1.2), 41.73)
add(kick(0.9), 41.88)
for i, n in enumerate(['A4', 'C5', 'E5', 'A5']):
    add(bell(note(n), 2.1), 41.73 + i * 0.06, 0.15, pan=(-0.4 + i * 0.27))
pl, pr = pad([note(n) for n in ['A3', 'C4', 'E4', 'A4']], 2.15, 1500)
add(pl, 41.73, 0.2, pan=-0.6)
add(pr, 41.73, 0.2, pan=0.6)

# the two inserted bars, in real time: the groove, bass and pad carry on through each (the score's grid and backbeat
# phase hold, since every change is whole bars; the chord is the one the score holds either side)
def fill_bar(r0, chord_idx, pad_at):
    chord, root = CHORDS[chord_idx % 4]
    pl, pr = pad([note(n) for n in chord], 2.15, 1700)
    _add(pl, pad_at, 0.14, pan=-0.6)
    _add(pr, pad_at, 0.14, pan=0.6)
    for k in range(-1, 5):
        t = round(r0 + 0.05 + k * BEAT - (r0 % BEAT), 3)
        if r0 <= t < r0 + 2.0:
            _add(kick(0.75), t)
            _add(hat(), t + BEAT / 2, 0.45, pan=0.25)
            if round((t - 2.05) / BEAT) % 2 == 1:
                _add(clap(), t, 0.35)
    for k in range(-1, 10):
        t = round(r0 + 0.05 + k * BEAT / 2 - (r0 % (BEAT / 2)), 3)
        if r0 <= t < r0 + 2.0:
            _add(bass(note(root) * (2 if round((t - 0.05) / (BEAT / 2)) % 4 == 3 else 1), 0.22), t, 0.26)


# part-2 title card (16.2 – 18.2): a whoosh as the card covers the editor, a tick per word drop, the punch on "creatively."
fill_bar(16.2, 10, 18.0)
_add(whoosh(0.6), 16.1, 0.33)
for ts in (16.4, 16.58, 16.76):
    _add(tick(2300), ts, 0.28)
_add(kick(1.1), 17.0)
_add(clap(), 17.0, 0.5)
# the colour pick (20.6 – 22.6): click the giant word, the panel opens; Style; the green gradient lands with a chime
fill_bar(20.6, 11, 22.0)
for ts in (20.8, 21.3, 21.95):
    _add(ui_click(), ts, 0.8)
_add(whoosh(0.35), 20.85, 0.18)
for i, n in enumerate(['C6', 'E6']):
    _add(bell(note(n), 1.4), 21.97 + i * 0.05, 0.07, pan=(-0.2 + i * 0.4))

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
with wave.open(str(out / 'soundtrack-v2d.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out / 'soundtrack-v2d.wav')
