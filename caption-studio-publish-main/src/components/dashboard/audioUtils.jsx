export const extractAudioAsWav = async (videoFile) => {
  try {
    // Create an audio context with lower sample rate for speech (16kHz is standard for Whisper)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext({ sampleRate: 16000 });
    
    // Read the video file as an array buffer
    const arrayBuffer = await videoFile.arrayBuffer();
    
    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to WAV (Mono, 16kHz) to reduce size and ensure compatibility
    const wavBlob = bufferToWav(audioBuffer);
    
    // Create a file from the blob
    const fileName = videoFile.name.substring(0, videoFile.name.lastIndexOf('.')) || videoFile.name;
    const audioFile = new File([wavBlob], `${fileName}.wav`, {
      type: 'audio/wav'
    });
    
    return audioFile;
  } catch (error) {
    console.error('Audio extraction error:', error);
    throw new Error('Failed to extract audio from video file.');
  }
};

// Helper function to convert AudioBuffer to WAV Blob
// Optimized for speech: Mono, 16kHz (if context is 16k), 16-bit PCM
function bufferToWav(abuffer) {
  // Force mono for speech transcription to save space
  const numOfChan = 1; 
  const length = abuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  
  // Get the first channel (usually sufficient for speech) or mix down if needed
  // Here we just take channel 0 for simplicity and speed
  const channelData = abuffer.getChannelData(0);
  
  let offset = 0;
  let pos = 0;

  // Write the WAV header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // Write data
  while (pos < abuffer.length) {
    // clamp and scale to 16-bit signed int
    let sample = Math.max(-1, Math.min(1, channelData[pos]));
    sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
    view.setInt16(44 + offset, sample, true);
    offset += 2;
    pos++;
  }

  return new Blob([buffer], { type: 'audio/wav' });

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

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