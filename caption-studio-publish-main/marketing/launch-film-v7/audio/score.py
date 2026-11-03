"""Original score + sound effects for launch film v7 ("Said, then subtitled."), synthesised from
scratch with numpy - no samples, no third-party music, nothing to license. Fixed seed: every run is
identical.

Everything is placed from the film's own files, so a re-time follows automatically:
  film/src/timeline.ts       scene lengths and every voiceover window (music dips under the VO)
  film/src/footage.ts        where each local take starts inside its scene (trimStartSec)
  recorder/takes/L*.json     the logged clicks / drags of the real takes (UI sounds land on them)

Musical plan (D major / B minor, 96 BPM, bars of 2.5 s counted from S2 at 6 s):
  S1  the creator speaks (their own sound, from F1); at the sound cut, one low felt-piano A
  S2  a muffled heartbeat pulse, dry key ticks under the hand-typed subtitle file, a closed pad
  S3-S4  the pad opens; felt piano walks G - D - A - Bm; soft clicks on the real clicks
  S5-S7  a gentle groove (soft kick, shaker, rim, bass); whoosh on the drag, bell on the gradient,
         a rise into the template click, four plucks rising as the language cards arrive
  S8  the groove drops to pad; a chime when the export completes
  S9  the creator's sound returns (F4b); the music resolves on D
  S10 the signature: the same A from S1, now resolving to D, then silence

    python audio/score.py  ->  film/public/audio/score-v7.wav  (+ audio/cues-v7.json)
"""
import json
import re
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
FILM = HERE.parent / 'film'
TAKES = HERE.parent / 'recorder' / 'takes'
OUT = FILM / 'public' / 'audio' / 'score-v7.wav'

SR = 48000
rng = np.random.default_rng(29)


# ---------- read the edit ----------
def read_timeline():
    src = (FILM / 'src' / 'timeline.ts').read_text(encoding='utf8')
    body = src[src.index('export const SCENES'):]
    blocks = re.split(r'\n\s*\{\s*\n\s*id: "', body)[1:]
    scenes, start = {}, 0.0
    for b in blocks:
        sid = b[:b.index('"')]
        secs = float(re.search(r'seconds: ([\d.]+)', b).group(1))
        vo = [(start + float(f), start + float(t)) for f, t in re.findall(r'from: ([\d.]+),\s*to: ([\d.]+)', b)]
        scenes[sid] = {'start': start, 'seconds': secs, 'vo': vo}
        start += secs
    return scenes, start


def read_trims():
    src = (FILM / 'src' / 'footage.ts').read_text(encoding='utf8')
    return {k: float(v) for k, v in re.findall(r'(L\d): \{\s*src: "[^"]+",\s*cursor: \w+,\s*trimStartSec: ([\d.]+)', src)}


SCENES, DUR = read_timeline()
TRIMS = read_trims()
N = int(SR * DUR)
MUSIC = np.zeros((2, N))  # ducked under the voiceover
SFX = np.zeros((2, N))    # UI sounds stay at level
CUES = []


def S(sid, offset=0.0):
    return SCENES[sid]['start'] + offset


def take_events(take, sid):
    """Logged events of a local take, moved to film time (only those inside the scene)."""
    log = json.loads((TAKES / f'{take}.json').read_text())['log']
    t0, sc = TRIMS[take], SCENES[sid]
    out = []
    for e in log:
        t = sc['start'] + e['t'] - t0
        if sc['start'] <= t < sc['start'] + sc['seconds']:
            out.append({**e, 't': t})
    return out


# ---------- DSP helpers ----------
def t_arr(dur):
    return np.arange(int(SR * dur)) / SR


def add(bus, sig, start, gain=1.0, pan=0.0, cue=None):
    i = int(round(start * SR))
    if i >= N or i < 0:
        return
    sig = np.asarray(sig)
    if sig.ndim == 1:
        sig = np.vstack([sig * (1 - max(0, pan)), sig * (1 + min(0, pan))])
    sig = sig[:, : N - i]
    bus[:, i:i + sig.shape[1]] += sig * gain
    if cue:
        CUES.append({'t': round(start, 3), 'cue': cue})


def lowpass(x, cutoff):
    # one-pole low-pass (scalar or per-sample cutoff)
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def env(n, attack, release, total):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.clip((total - t) / max(release, 1e-4), 0, 1)


def hz(name):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    return 440.0 * 2 ** ((names[name[:-1]] + (int(name[-1]) - 4) * 12) / 12)


# ---------- instruments ----------
def felt_piano(name, dur=3.2, vel=0.7):
    """Soft, felted piano: slightly inharmonic partials, two detuned strings, a muted hammer thump."""
    f, t = hz(name), t_arr(dur)
    s = np.zeros(len(t))
    for k in range(1, 9):
        fk = k * f * np.sqrt(1 + 0.00035 * k * k)
        if fk > 7000:
            break
        amp = (vel ** (0.35 * k)) / k ** 1.4
        dec = 0.55 + 0.45 * k + f / 900
        for det in (0.9993, 1.0007):
            s += amp * np.sin(2 * np.pi * fk * det * t + k) * np.exp(-t * dec)
    thump = lowpass(rng.standard_normal(len(t)), 500) * np.exp(-t * 90) * 0.35
    s = lowpass(s + thump, 1800 + 2200 * vel) * env(len(t), 0.006, 0.25, dur)
    return s * vel * 0.5


def pad(names, dur, cutoff=900, attack=0.8, release=1.2):
    n = int(SR * dur)
    t = t_arr(dur)[:n]
    out = np.zeros((2, n))
    for name in names:
        f = hz(name)
        for side, det in ((0, 0.996), (1, 1.004)):
            ph = 2 * np.pi * f * det * t
            out[side] += np.sin(ph) + 0.35 * np.sin(2 * ph + 0.3) + 0.12 * np.sin(3 * ph)
    e = env(n, attack, release, dur) * (1 + 0.04 * np.sin(2 * np.pi * 0.25 * t))
    return np.vstack([lowpass(out[0], cutoff), lowpass(out[1], cutoff)]) * e / len(names) * 0.5


def pulse(gain=1.0):
    # muffled heartbeat: a low sine thud
    t = t_arr(0.5)
    f = 48 + 40 * np.exp(-t * 20)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * gain


def kick(gain=1.0):
    t = t_arr(0.4)
    f = 50 + 95 * np.exp(-t * 30)
    return lowpass(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8), 900) * gain


def shaker(gain=1.0):
    t = t_arr(0.07)
    return highpass(rng.standard_normal(len(t)), 5500) * np.exp(-t * 70) * gain * 0.25


def rim(gain=1.0):
    t = t_arr(0.12)
    s = np.sin(2 * np.pi * 820 * t) * np.exp(-t * 55) + highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t * 90) * 0.3
    return lowpass(s, 3500) * gain * 0.35


def bass(name, dur):
    f, t = hz(name), t_arr(dur)
    s = np.tanh(1.6 * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)))
    return lowpass(s, 380) * env(len(t), 0.01, 0.12, dur) * 0.55


def key_tick(freq=1900):
    t = t_arr(0.05)
    n = rng.standard_normal(len(t))
    return lowpass(highpass(n, 1500), 5000) * np.exp(-t * 140) * 0.45 + np.sin(2 * np.pi * freq * t) * np.exp(-t * 90) * 0.18


def ui_click():
    t = t_arr(0.06)
    return np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 110) * 0.3 + np.sin(2 * np.pi * 160 * t) * np.exp(-t * 50) * 0.35


def whoosh(dur=0.9):
    t = t_arr(dur)
    shape = np.sin(np.pi * t / dur) ** 2
    return lowpass(highpass(rng.standard_normal(len(t)), 300), 600 + 3200 * shape) * shape * 0.5


def riser(dur=1.2):
    t = t_arr(dur)
    return lowpass(rng.standard_normal(len(t)), 300 * (5000 / 300) ** (t / dur)) * (t / dur) ** 2.2 * 0.45


def bell(name, dur=2.6):
    f, t = hz(name), t_arr(dur)
    s = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 2.5) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 5)
    return s * np.exp(-t * 1.4) * env(len(t), 0.002, 0.4, dur) * 0.35


def pluck(name, dur=1.6):
    # Karplus-Strong string
    f = hz(name)
    p = int(SR / f)
    n = int(SR * dur)
    buf = lowpass(rng.standard_normal(p), 3000)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return lowpass(out, 3500) * env(n, 0.002, 0.3, dur) * 0.6


def thump():
    t = t_arr(0.6)
    f = 42 + 70 * np.exp(-t * 14)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * 0.8


# ---------- arrangement ----------
BAR, BEAT = 2.5, 0.625
GRID0 = S('S02Problem')                 # bar 0
GROOVE_FROM = S('S05Word')              # bar 10
GROOVE_TO = S('S08Export')              # music drops to pad here
PROG = [  # (pad voicing, piano notes on beats 0 and 2, bass)
    (['B3', 'D4', 'F#4'], ['B2', 'F#3', 'D4'], 'B1'),
    (['G3', 'B3', 'D4'], ['G2', 'D3', 'B3'], 'G1'),
    (['D4', 'F#4', 'A4'], ['D3', 'A3', 'F#4'], 'D2'),
    (['A3', 'C#4', 'E4'], ['A2', 'E3', 'C#4'], 'A1'),
]


def bar_at(t):
    return int(np.floor((t - GRID0) / BAR + 1e-6))


# S1 — the sound cut: one low A, unresolved (the creator's own voice comes from F1)
SOUND_CUT = S('S01Hook', 2.6)
add(MUSIC, felt_piano('A2', 4.5, 0.55), SOUND_CUT, 1.0, cue='S1 sound cut: felt piano A2')
add(MUSIC, felt_piano('A1', 4.5, 0.4), SOUND_CUT, 0.6)

# S2 — heartbeat pulse on beats 1 and 3, closed Bm pad, key ticks on the typed subtitle file
for b in range(0, 3):
    t0 = GRID0 + b * BAR
    add(MUSIC, pad(PROG[0][0], BAR + 0.6, cutoff=520, attack=1.2 if b == 0 else 0.3), t0, 0.5)
    for beat in (0, 2):
        add(MUSIC, pulse(0.55 if beat == 0 else 0.4), t0 + beat * BEAT)
add(MUSIC, pad(PROG[0][0], 1.6, cutoff=520, attack=0.3, release=1.2), GRID0 + 3 * BAR, 0.5)  # into the fade
CUES.append({'t': round(GRID0, 3), 'cue': 'S2 pulse + closed pad'})
# the typed file (S02Problem.tsx: typed over 0–2.4 s, "most" deleted 2.6–3.0 s, retyped 3.0–3.4 s)
typed = np.sort(rng.uniform(0.05, 2.4, 34))
for i, ts in enumerate(typed):
    add(SFX, key_tick(1700 + 140 * (i % 5)), S('S02Problem', ts), 0.22, pan=-0.2 + 0.4 * rng.random())
for k in range(4):
    add(SFX, key_tick(1500), S('S02Problem', 2.6 + k * 0.1), 0.2)
for k in range(4):
    add(SFX, key_tick(2100), S('S02Problem', 3.0 + k * 0.1), 0.24)
CUES.append({'t': round(S('S02Problem'), 3), 'cue': 'S2 key ticks (typing, backspace, retype)'})

# S3–S4 — the pad opens, felt piano walks the progression (one chord per bar, from bar 3)
for b in range(3, bar_at(GROOVE_FROM)):
    t0 = GRID0 + b * BAR
    chord, pno, _ = PROG[(b + 1) % 4]
    add(MUSIC, pad(chord, BAR + 0.8, cutoff=1100, attack=0.6), t0, 0.42)
    add(MUSIC, felt_piano(pno[0], 2.6, 0.55), t0, 0.9, pan=-0.15)
    add(MUSIC, felt_piano(pno[1], 2.2, 0.45), t0 + 2 * BEAT, 0.7, pan=0.1)
    if b % 2 == 0:
        add(MUSIC, felt_piano(pno[2], 1.8, 0.4), t0 + 3.5 * BEAT, 0.5, pan=0.25)
    for beat in (0, 2):
        add(MUSIC, pulse(0.35), t0 + beat * BEAT)
CUES.append({'t': round(GRID0 + 3 * BAR, 3), 'cue': 'S3 pad opens, piano progression'})

# S4 — real clicks of take L1, and the three typed letters of "not"
for e in take_events('L1', 'S04Edit'):
    if e['kind'] == 'click':
        add(SFX, ui_click(), e['t'], 0.5, cue='S4 click (L1)')
fix = [e['t'] for e in take_events('L1', 'S04Edit') if e['kind'] == 'click'][2:3]
for f in fix:  # record.mjs: double-click, 0.12 + 0.35 s, then a key every 0.11 s
    for k in range(3):
        add(SFX, key_tick(2000 + 120 * k), f + 0.35 + 0.11 * k, 0.3)

# S5–S7 — the groove
for b in range(bar_at(GROOVE_FROM), bar_at(GROOVE_TO)):
    t0 = GRID0 + b * BAR
    chord, pno, bs = PROG[(b + 1) % 4]
    add(MUSIC, pad(chord, BAR + 0.8, cutoff=1500, attack=0.4), t0, 0.36)
    add(MUSIC, felt_piano(pno[0], 2.4, 0.55), t0, 0.75, pan=-0.15)
    add(MUSIC, felt_piano(pno[1], 2.0, 0.45), t0 + 2 * BEAT, 0.6, pan=0.1)
    add(MUSIC, felt_piano(pno[2], 1.6, 0.42), t0 + 3.5 * BEAT, 0.45, pan=0.25)
    add(MUSIC, bass(bs, 1.1), t0, 0.8)
    add(MUSIC, bass(bs, 0.6), t0 + 2.5 * BEAT, 0.6)
    for beat in range(4):
        if beat in (0, 2):
            add(MUSIC, kick(0.7), t0 + beat * BEAT)
        else:
            add(MUSIC, rim(0.8), t0 + beat * BEAT, pan=0.2)
    for e8 in range(8):
        add(MUSIC, shaker(0.9 if e8 % 2 else 0.55), t0 + e8 * BEAT / 2, pan=0.35)
CUES.append({'t': round(GROOVE_FROM, 3), 'cue': 'S5 groove in'})

# S5 — whoosh on the drag, clicks, bell on the gradient (take L2)
l2 = take_events('L2', 'S05Word')
first_down = next((e['t'] for e in l2 if e['kind'] == 'down'), None)  # the word drag, not the size slider
for e in l2:
    if e['kind'] == 'down' and e['t'] == first_down:
        up = next((u['t'] for u in l2 if u['kind'] == 'up' and u['t'] > e['t']), e['t'] + 0.8)
        add(SFX, whoosh(max(0.4, up - e['t'] + 0.2)), e['t'], 0.35, cue='S5 drag whoosh (L2)')
    if e['kind'] == 'click':
        add(SFX, ui_click(), e['t'], 0.45)
grad = [e['t'] for e in l2 if e['kind'] == 'click'][-1:]
for g in grad:
    add(SFX, bell('F#5'), g + 0.03, 0.5, cue='S5 gradient bell')
    add(SFX, bell('D6'), g + 0.08, 0.25, pan=0.3)

# S6 — clicks of take L3; a rise into the template click and a light thump on apply
l3 = [e for e in take_events('L3', 'S06Template') if e['kind'] == 'click']
for e in l3:
    add(SFX, ui_click(), e['t'], 0.45)
if l3:
    apply_t = l3[-1]['t']
    add(SFX, riser(1.2), apply_t - 1.2, 0.35, cue='S6 rise into template click')
    add(SFX, thump(), apply_t, 0.5, cue='S6 template applied')
    add(SFX, bell('A5', 2.0), apply_t + 0.02, 0.22)

# S7 — four language cards arrive: plucks rising D - F# - A - D (placeholder times until F3)
for k, name in enumerate(['D4', 'F#4', 'A4', 'D5']):
    add(SFX, pluck(name), S('S07Translate', 4.0 + 0.4 * k), 0.5, pan=-0.45 + 0.3 * k, cue=f'S7 card {k + 1} pluck (placeholder time)')

# S8 — the groove drops to an open D pad; the export-complete chime (placeholder time until F4)
add(MUSIC, pad(['D4', 'A4', 'E5'], 5.6, cutoff=1300, attack=0.3, release=1.6), GROOVE_TO, 0.42)
add(MUSIC, felt_piano('D3', 3.0, 0.5), GROOVE_TO, 0.7)
EXPORT_DONE = S('S08Export', 2.0)
for name, d, g in (('D6', 0, 0.4), ('A5', 0.06, 0.3), ('F#5', 0.12, 0.25)):
    add(SFX, bell(name, 2.4), EXPORT_DONE + d, g)
CUES.append({'t': round(EXPORT_DONE, 3), 'cue': 'S8 export chime (placeholder time)'})

# S9 — resolution on D under the returning voice
RES = S('S09Payoff')
add(MUSIC, pad(['D3', 'A3', 'D4', 'F#4'], SCENES['S09Payoff']['seconds'] + 1.5, cutoff=900, attack=1.0, release=2.0), RES, 0.38)
for name, d in (('D2', 0), ('A2', 0.04), ('D3', 0.08), ('F#3', 0.12)):
    add(MUSIC, felt_piano(name, 5.5, 0.45), RES + d, 0.7)
CUES.append({'t': round(RES, 3), 'cue': 'S9 resolution on D'})

# S10 — the signature: the S1 A, now resolving to D, as the wordmark wipes in and lands
SIG = S('S10Reveal')
add(MUSIC, felt_piano('A3', 3.5, 0.6), SIG + 0.0, 0.9, cue='S10 signature A3')
add(MUSIC, felt_piano('D4', 3.6, 0.62), SIG + 1.47, 0.95, cue='S10 signature D4 (logo lands)')
add(MUSIC, felt_piano('D2', 3.6, 0.5), SIG + 1.47, 0.7)
add(MUSIC, pad(['D4', 'A4'], 3.4, cutoff=800, attack=0.4, release=1.8), SIG + 1.47, 0.25)

# ---------- mix ----------
# duck the music (not the UI sounds) by 5 dB under every voiceover window, with soft ramps
duck = np.ones(N)
ramp = int(0.15 * SR)
for sc in SCENES.values():
    for a, b in sc['vo']:
        i0, i1 = int((a - 0.1) * SR), int((b + 0.2) * SR)
        duck[max(0, i0):min(N, i1)] = np.minimum(duck[max(0, i0):min(N, i1)], 10 ** (-5 / 20))
kern = np.hanning(2 * ramp + 1)
duck = np.convolve(duck, kern / kern.sum(), mode='same')
mix = MUSIC * duck + SFX


def reverb(x, seconds=1.8, wet=0.18):
    n = int(SR * seconds)
    t = np.arange(n) / SR
    ir = np.vstack([lowpass(rng.standard_normal(n), 4500) * np.exp(-t * 3.8) for _ in range(2)])
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    size = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
    wetsig = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:, : x.shape[1]]
    return x * (1 - wet) + wetsig * wet * 2.2


mix = reverb(mix)
fade = np.clip((DUR - 0.25 - np.arange(N) / SR) / 0.8, 0, 1)  # silence by the last frame
mix *= fade
peak = np.abs(mix).max()
mix *= 10 ** (-3 / 20) / peak  # -3 dBFS peak; loudness is measured and reported separately

OUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUT), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes())
(HERE / 'cues-v7.json').write_text(json.dumps(sorted(CUES, key=lambda c: c['t']), indent=1))
print(f'{OUT.name}: {DUR:.2f} s, {len(CUES)} cues, VO windows {sum(len(s["vo"]) for s in SCENES.values())}')
