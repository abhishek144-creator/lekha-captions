import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import VideoPlayer from '../../src/components/dashboard/VideoPlayer'
import SidebarTemplateGallery20 from '../../src/components/dashboard/SidebarTemplateGallery20'
import '../../src/index.css'

const ignore = () => {}
const input = JSON.parse(localStorage.getItem('cptParityFixture') || '{}')
function Harness() {
  const [captions, setCaptions] = useState([input.caption])
  const [style, setStyle] = useState(input.style)
  const [selected, setSelected] = useState(null)
  const [popup, setPopup] = useState(null)
  return <>
    <output id="fixture-state" hidden>{JSON.stringify({ captions, style })}</output>
    <div style={{ display: 'flex', gap: 20 }}>
      <div style={{ width: 260, height: 600 }}>
        <SidebarTemplateGallery20 currentStyle={style} onApplyTemplate={(template) => setStyle({ ...template, ...input.style })} />
      </div>
      <div style={{ width: 500, height: 850 }}>
        <VideoPlayer videoUrl="" currentTime={0.99} setCurrentTime={ignore} isPlaying={false} setIsPlaying={ignore}
          captions={captions} setCaptions={setCaptions} setCaptionsRaw={setCaptions}
          captionStyle={style} setCaptionStyle={setStyle} setCaptionStyleRaw={setStyle}
          duration={1} setDuration={ignore} waveformData={[]} addToHistory={ignore}
          selectedCaptionId={selected} setSelectedCaptionId={setSelected}
          wordPopup={popup} setWordPopup={setPopup} isVideoFullscreen={false} setIsVideoFullscreen={ignore} />
      </div>
    </div>
  </>
}
createRoot(document.getElementById('root')).render(<Harness />)
