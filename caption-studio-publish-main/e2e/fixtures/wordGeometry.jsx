import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import VideoPlayer from '../../src/components/dashboard/VideoPlayer'
import '../../src/index.css'

const ignore = () => {}
function Harness() {
  const [wordPopup, setWordPopup] = useState(null)
  const [selectedCaptionId, setSelectedCaptionId] = useState(null)
  const [captions, setCaptions] = useState([{
    id: 'geometry', text: 'is strategy not', start_time: 0, end_time: 10,
    words: [], wordStyles: {},
  }])
  return <>
    <button id="reset" onClick={() => { setWordPopup(null); setCaptions((items) => items.map((caption) => ({ ...caption, wordStyles: {} }))) }}>Reset</button>
    <button id="restyle" onClick={() => setCaptions((items) => items.map((caption) => ({ ...caption, wordStyles: { 'geometry-1': { fontWeight: '900', textTransform: 'uppercase' } } })))}>Restyle</button>
    <button id="enlarge" onClick={() => setCaptions((items) => items.map((caption) => ({ ...caption, wordStyles: { 'geometry-1': { fontSize: 40, fontWeight: '900', textTransform: 'uppercase' } } })))}>Enlarge</button>
    <button id="emphasis" onClick={() => setCaptions((items) => items.map((caption) => ({ ...caption, wordStyles: { 'geometry-1': { fontSize: 32, isEmphasis: true } } })))}>Emphasis</button>
    <button id="detach" onClick={() => { setWordPopup(null); setCaptions((items) => items.map((caption) => ({ ...caption, wordStyles: { 'geometry-1': { fontSize: 32, abs_x_pct: 60, abs_y_pct: 40 } } }))) }}>Detach</button>
    <button id="unselect" onClick={() => setWordPopup(null)}>Unselect</button>
    <div style={{ width: 'min(480px, 100%)', height: 850 }}>
      <VideoPlayer videoUrl="" currentTime={9} setCurrentTime={ignore} isPlaying={false} setIsPlaying={ignore}
        captions={captions} setCaptions={setCaptions} setCaptionsRaw={setCaptions}
        captionStyle={{ font_family: 'Arial', font_size: 18, position_y: 70, text_color: '#fff', font_weight: '400', has_background: false }}
        duration={10} setDuration={ignore} waveformData={[]} setCaptionStyle={ignore} setCaptionStyleRaw={ignore} addToHistory={ignore}
        selectedCaptionId={selectedCaptionId} setSelectedCaptionId={setSelectedCaptionId}
        wordPopup={wordPopup} setWordPopup={setWordPopup} isVideoFullscreen={false} setIsVideoFullscreen={ignore} />
    </div>
  </>
}
createRoot(document.getElementById('root')).render(<Harness />)
