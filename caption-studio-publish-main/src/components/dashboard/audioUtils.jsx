// The waveform needs the whole file and its decoded audio in memory. Above this
// size a phone can run out of memory, so the timeline shows no waveform instead.
const WAVEFORM_MAX_BYTES = 200 * 1024 * 1024;

const readMediaBytes = async (source) => {
  if (!source) return null;
  // A local File or Blob needs no download.
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    return source.size > WAVEFORM_MAX_BYTES ? null : source.arrayBuffer();
  }
  const url = typeof source === 'string' ? source : source.src;
  if (!url) return null;
  const response = await fetch(url);
  const length = Number(response.headers.get('content-length') || 0);
  if (!response.ok || length > WAVEFORM_MAX_BYTES) {
    response.body?.cancel?.().catch?.(() => {});
    return null;
  }
  return response.arrayBuffer();
};

// Extract waveform data for visualization. `source` is a File/Blob, a media
// URL, or a <video>/<audio> element.
export const extractWaveformData = async (source, numSamples = 300) => {
  let audioContext = null;
  try {
    const arrayBuffer = await readMediaBytes(source);
    if (!arrayBuffer) return null;

    // Create audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Get the raw audio data (first channel)
    const rawData = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / numSamples);
    const samples = [];
    
    for (let i = 0; i < numSamples; i++) {
      let blockStart = blockSize * i;
      let sum = 0;
      
      // Get average amplitude for this block
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j]);
      }
      
      samples.push(sum / blockSize);
    }
    
    // Normalize samples to 0-1 range. Guard against a silent track:
    // dividing by 0 turns every sample into NaN, which breaks the timeline
    // waveform bars AND the audio-emotion analysis downstream.
    const maxAmplitude = Math.max(...samples) || 1;
    const normalizedSamples = samples.map(s => s / maxAmplitude);

    return normalizedSamples;
  } catch (error) {
    console.error('Waveform extraction error:', error);
    return null;
  } finally {
    // Browsers limit open audio contexts; a failed decode must close it too.
    audioContext?.close().catch(() => {});
  }
};
