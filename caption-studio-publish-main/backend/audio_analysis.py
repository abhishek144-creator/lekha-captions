"""Bounded waveform and activity envelope from the exact transcription PCM.

All times are seconds from media zero. This is activity detection, not a
phonetic forced aligner: phrase-derived word times remain labelled estimates.
"""
import array
import math
import sys
import wave
import os
import tempfile


def extraction_command(source, output):
    # FFmpeg normalizes the input presentation origin. Preserve a late audio
    # stream's initial silence instead of rebasing its first packet to zero.
    return ['ffmpeg', '-y', '-i', source, '-map', '0:a:0', '-vn', '-af',
            'aresample=async=1:first_pts=0', '-ar', '16000', '-ac', '1',
            '-c:a', 'pcm_s16le', output]


def analyze_media(source, duration):
    try:
        from .media_commands import run_media_command
    except ImportError:
        from media_commands import run_media_command
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as handle:
        path = handle.name
    try:
        run_media_command(extraction_command(source, path), check=True,
                          capture_output=True, timeout=120)
        analysis = analyze_pcm(path, duration)
        analysis.pop('activity', None)
        return analysis
    finally:
        os.remove(path)


def analyze_pcm(path, media_duration=0):
    with wave.open(path, 'rb') as audio:
        rate, channels, width = audio.getframerate(), audio.getnchannels(), audio.getsampwidth()
        if rate != 16000 or channels != 1 or width != 2 or audio.getnframes() > 16000 * 600:
            raise ValueError('Expected bounded 16 kHz mono PCM')
        pcm = array.array('h', audio.readframes(audio.getnframes()))
    if sys.byteorder != 'little':
        pcm.byteswap()
    seconds = len(pcm) / rate
    duration = max(seconds, float(media_duration or 0))
    if not pcm or not math.isfinite(duration) or duration > 600:
        raise ValueError('Invalid audio duration')
    # 20 ms activity windows and 50 ms timeline bins: even a 3-minute clip
    # needs only a few KB in browser/account drafts.
    levels = []
    for start in range(0, len(pcm), 320):
        frame = pcm[start:start+320]
        levels.append(math.sqrt(sum(v*v for v in frame) / len(frame)) / 32768)
    threshold = max(0.005, sorted(levels)[int((len(levels)-1)*0.85)] * 0.12)
    intervals = []
    for index, level in enumerate(levels):
        if level < threshold:
            continue
        start, end = index * 0.02, min(seconds, (index+1)*0.02)
        if intervals and start - intervals[-1]['end'] < 0.12:
            intervals[-1]['end'] = end
        else:
            intervals.append({'start': start, 'end': end})
    samples = []
    count = math.ceil(duration * 20)
    for index in range(count):
        frame = pcm[int(index*duration*rate/count):int((index+1)*duration*rate/count)]
        samples.append(math.sqrt(sum(v*v for v in frame)/len(frame))/32768 if frame else 0)
    peak = max(samples) or 1
    return {
        'duration': round(duration, 6), 'sample_period': duration/count, 'start_time': 0,
        'samples': [round(v/peak, 4) for v in samples], 'activity': intervals,
        'reference': 'source_media_seconds',
    }
