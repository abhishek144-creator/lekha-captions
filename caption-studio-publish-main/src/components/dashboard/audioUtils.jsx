const readMediaBytes = async (source) => {
  if (!source) return null;
  // A local File or Blob needs no download.
  if (typeof Blob !== 'undefined' && source instanceof Blob) return source.arrayBuffer();
  const url = typeof source === 'string' ? source : source.src;
  if (!url) return null;
  const response = await fetch(url);
  return response.arrayBuffer();
};

// Extract waveform data for visualization. `source` is a File/Blob, a media
// URL, or a <video>/<audio> element.
export const extractWaveformData = async (source, numSamples = 300) => {
  try {
    const arrayBuffer = await readMediaBytes(source);
    if (!arrayBuffer) return null;
    
    // Create audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    
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
    
    audioContext.close();
    
    return normalizedSamples;
  } catch (error) {
    console.error('Waveform extraction error:', error);
    return null;
  }
};
