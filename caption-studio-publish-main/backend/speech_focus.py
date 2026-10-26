"""Conservative edge-speech suppression for transcription, in source seconds.

This is not speaker diarization. Only a short, isolated and much quieter
utterance before/after sustained speech is eligible. Interior/quiet narration
and dialogue remain intact. The original media is never modified.
"""
import array
import math
import sys
import wave

try:
    from .audio_analysis import analyze_pcm
except ImportError:
    from audio_analysis import analyze_pcm


def focus_pcm(source, output, mode='main'):
    analysis = analyze_pcm(source)
    report = {'mode': mode, 'suppressed_regions': [], 'reference': 'source_media_seconds'}
    if mode != 'main':
        return report
    with wave.open(source, 'rb') as audio:
        params = audio.getparams()
        pcm = array.array('h', audio.readframes(audio.getnframes()))
    if sys.byteorder != 'little':
        pcm.byteswap()
    rate = params.framerate
    runs = []
    for interval in analysis['activity']:
        if runs and interval['start'] - runs[-1]['end'] < 0.35:
            runs[-1]['end'] = interval['end']
        else:
            runs.append(dict(interval))
    if len(runs) < 2:
        return report

    def rms(run):
        samples = pcm[int(run['start'] * rate):int(run['end'] * rate)]
        return math.sqrt(sum(value * value for value in samples) / max(1, len(samples)))

    sustained = [run for run in runs if run['end'] - run['start'] >= 2]
    if not sustained:
        return report
    primary = max(sustained, key=lambda run: run['end'] - run['start'])
    reference = rms(primary)
    if reference <= 0:
        return report
    # Compare separated utterances, never individual soft syllables. A short
    # quiet turn inside a conversation must not disappear merely for being soft.
    def quiet_edge(run):
        return run['end'] - run['start'] <= 0.6 and rms(run) <= reference * 0.4

    lead = [run for run in runs if run['end'] <= primary['start']]
    tail = [run for run in runs if run['start'] >= primary['end']]
    if (lead and all(quiet_edge(run) for run in lead)
            and sum(run['end'] - run['start'] for run in lead) <= 0.8
            and primary['start'] - lead[-1]['end'] >= 0.6):
        report['suppressed_regions'].extend(lead)
    if (tail and all(quiet_edge(run) for run in tail)
            and sum(run['end'] - run['start'] for run in tail) <= 0.8
            and tail[0]['start'] - primary['end'] >= 0.6):
        report['suppressed_regions'].extend(tail)
    if not report['suppressed_regions']:
        return report
    retained = [run for run in runs if run not in report['suppressed_regions']]
    start = max(0, round((retained[0]['start'] - 0.16) * rate))
    end = min(len(pcm), round((retained[-1]['end'] + 0.2) * rate))
    # Silence rather than concatenate: Whisper/failover still returns times on
    # the original source clock, including the leading silence.
    pcm[:start] = array.array('h', [0]) * start
    pcm[end:] = array.array('h', [0]) * (len(pcm) - end)
    if sys.byteorder != 'little':
        pcm.byteswap()
    with wave.open(output, 'wb') as audio:
        audio.setparams(params)
        audio.writeframes(pcm.tobytes())
    report['window'] = {'start': start / rate, 'end': end / rate}
    return report


def slice_pcm(source, output, start, end):
    """Cut on PCM frame boundaries and return the exact source offset."""
    with wave.open(source, 'rb') as audio:
        params = audio.getparams()
        first = max(0, round(start * params.framerate))
        last = min(audio.getnframes(), round(end * params.framerate))
        audio.setpos(first)
        data = audio.readframes(max(0, last - first))
    with wave.open(output, 'wb') as audio:
        audio.setparams(params)
        audio.writeframes(data)
    return first / params.framerate
