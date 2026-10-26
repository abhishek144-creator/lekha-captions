// The waveform needs the whole file and its decoded audio in memory. Above this
// size a phone can run out of memory, so the timeline shows no waveform instead.
const WAVEFORM_MAX_BYTES = 200 * 1024 * 1024;

const readMediaBytes = async (source) => {
  if (!source) return null;
  // A local File or Blob needs no download.
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    return source.size > WAVEFORM_MAX_BYTES ? null : source.arrayBuffer();
  }
  const url = typeof source === 'string' ? source : (source.currentSrc || source.src || source.querySelector?.('source')?.src);
  if (!url) return null;
  const response = await fetch(url);
  const length = Number(response.headers.get('content-length') || 0);
  if (!response.ok || length > WAVEFORM_MAX_BYTES) {
    response.body?.cancel?.().catch?.(() => {});
    return null;
  }
  if (!response.body?.getReader) return response.arrayBuffer()
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > WAVEFORM_MAX_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes.buffer
  } finally {
    reader.releaseLock()
  }
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
    
    const channels = Array.from({ length: audioBuffer.numberOfChannels || 1 }, (_, index) => audioBuffer.getChannelData(index))
    const length = channels[0]?.length || 0
    if (!length) return null
    const count = Math.min(length, Math.max(1, Math.min(12000, Math.floor(numSamples) || 300)))
    const samples = Array.from({ length: count }, (_, index) => {
      const start = Math.floor(index * length / count)
      const end = Math.floor((index + 1) * length / count)
      let peak = 0
      for (const channel of channels) {
        let energy = 0
        for (let offset = start; offset < end; offset += 1) energy += channel[offset] ** 2
        peak = Math.max(peak, Math.sqrt(energy / (end - start)))
      }
      return peak
    })
    const maxAmplitude = Math.max(...samples) || 1
    const normalizedSamples = samples.map(value => value / maxAmplitude)

    return normalizedSamples;
  } catch (error) {
    console.error('Waveform extraction error:', error);
    return null;
  } finally {
    // Browsers limit open audio contexts; a failed decode must close it too.
    audioContext?.close().catch(() => {});
  }
};
