import { useCallback, useEffect, useRef, useState } from 'react'
import { defaultCaptionStyle, defaultEditorSettings, emptyEditorDocument } from '@/lib/editorDocument'

const clone = (value) => JSON.parse(JSON.stringify(value))

// Owns the editor document: the video, its caption tracks, the caption style
// and project identity. Everything a saved draft restores lives here, so a
// restore, a reset and New Project always change the same set of fields.
export function useEditorDocument() {
  const [audioAnalysis, setAudioAnalysis] = useState(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [fileId, setFileId] = useState(null)
  const [originalFileName, setOriginalFileName] = useState('')
  const [duration, setDuration] = useState(0)
  const [captions, setCaptions] = useState([])
  const [captionTracks, setCaptionTracks] = useState([])
  const [activeCaptionTrackId, setActiveCaptionTrackId] = useState('source')
  const [captionStyle, setCaptionStyle] = useState(defaultCaptionStyle)
  const [projectId, setProjectId] = useState(null)
  const [settings, setSettings] = useState(defaultEditorSettings)
  // The immutable point "Reset" returns to: set when a project is opened or
  // generated, cleared when the editor is emptied.
  const resetPointRef = useRef(null)

  // Edits always target the active track's captions; keep the stored track in
  // step so switching tracks or saving never loses them.
  useEffect(() => {
    if (!activeCaptionTrackId) return
    setCaptionTracks((tracks) => {
      if (!tracks.some((track) => track.id === activeCaptionTrackId)) return tracks
      return tracks.map((track) => (
        track.id === activeCaptionTrackId ? { ...track, captions } : track
      ))
    })
  }, [activeCaptionTrackId, captions])

  const snapshotEditorState = useCallback((overrides = {}) => ({
    videoUrl,
    audioAnalysis,
    captions: clone(overrides.captions ?? captions),
    captionTracks: clone(overrides.captionTracks ?? captionTracks),
    activeCaptionTrackId: overrides.activeCaptionTrackId ?? activeCaptionTrackId,
    captionStyle: clone(overrides.captionStyle ?? captionStyle),
    duration: overrides.duration ?? duration,
    fileId: overrides.fileId ?? fileId,
    originalFileName: overrides.originalFileName ?? originalFileName,
    projectId: overrides.projectId ?? projectId,
    settings: clone(overrides.settings ?? settings),
  }), [audioAnalysis, activeCaptionTrackId, captionStyle, captionTracks, captions, duration, fileId, originalFileName, projectId, settings, videoUrl])

  // Replaces the whole document. Pass a value from restoreEditorDocument() or
  // emptyEditorDocument() so every field is set together.
  const applyDocument = useCallback((doc) => {
    setAudioAnalysis(doc.audioAnalysis || null)
    setVideoUrl(doc.videoUrl)
    setFileId(doc.fileId)
    setOriginalFileName(doc.originalFileName)
    setDuration(doc.duration)
    setCaptions(doc.captions)
    setCaptionTracks(doc.captionTracks)
    setActiveCaptionTrackId(doc.activeCaptionTrackId)
    setCaptionStyle(doc.captionStyle)
    setProjectId(doc.projectId)
    setSettings(doc.settings)
  }, [])

  const resetDocument = useCallback(() => {
    applyDocument(emptyEditorDocument())
    resetPointRef.current = null
  }, [applyDocument])

  return {
    audioAnalysis, setAudioAnalysis,
    videoUrl, setVideoUrl,
    fileId, setFileId,
    originalFileName, setOriginalFileName,
    duration, setDuration,
    captions, setCaptions,
    captionTracks, setCaptionTracks,
    activeCaptionTrackId, setActiveCaptionTrackId,
    captionStyle, setCaptionStyle,
    projectId, setProjectId,
    settings, setSettings,
    resetPointRef,
    snapshotEditorState,
    applyDocument,
    resetDocument,
  }
}
