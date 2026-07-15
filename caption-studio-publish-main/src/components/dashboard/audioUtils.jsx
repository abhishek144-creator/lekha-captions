// Extract waveform data for visualization
export const extractWaveformData = async (videoElement, numSamples = 300) => {
  try {
    if (!videoElement || !videoElement.src) return null;
    
    // Fetch the video/audio file
    const response = await fetch(videoElement.src);
    const arrayBuffer = await response.arrayBuffer();
    
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
    
    // Normalize samples to 0-1 range
    const maxAmplitude = Math.max(...samples);
    const normalizedSamples = samples.map(s => s / maxAmplitude);
    
    audioContext.close();
    
    return normalizedSamples;
  } catch (error) {
    console.error('Waveform extraction error:', error);
    return null;
  }
};
