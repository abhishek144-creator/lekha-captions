import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownToLine, Captions, LayoutGrid, Loader2, Plus, SlidersHorizontal, Sparkles, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/lib/AuthContext'
import { apiRequest } from '@/lib/apiClient'
import { notifyApiError } from '@/lib/notifyApiError'
import { getClientContext, trackAnalytics } from '@/lib/analytics'
import { autoLoadFontForText, detectScript, loadGoogleFont, scriptFontMap } from '@/components/dashboard/fontUtils'
import PricingModal from '@/components/dashboard/PricingModal'

import MobileVideoStage from '@/components/mobile/MobileVideoStage'
import MobileTemplateSheet from '@/components/mobile/MobileTemplateSheet'
import MobileStyleSheet from '@/components/mobile/MobileStyleSheet'
import MobileCaptionsSheet from '@/components/mobile/MobileCaptionsSheet'
import MobileExportSheet from '@/components/mobile/MobileExportSheet'

// Mobile-only editor page. Desktop users never hit this code path — routing in
// App.jsx swaps Dashboard → MobileDashboard below the 768px breakpoint.
// Reuses backend endpoints, auth, fonts and template CSS; owns its own
// simplified state (no undo/redo, no per-word editing, no text layers in v1).

const defaultCaptionStyle = {
  font_family: 'Inter',
  font_size: 17,
  font_weight: '800',
  font_style: 'normal',
  line_spacing: 1.4,
  word_spacing: 1,
  is_bold: false,
  is_caps: false,
  text_case: 'none',
  text_align: 'center',
  text_color: '#ffffff',
  text_gradient: '',
  text_opacity: 1,
  highlight_color: '',
  highlight_gradient: '',
  has_background: false,
  background_opacity: 0.7,
  background_padding: 6,
  background_h_multiplier: 1.05,
  background_color: '#000000',
  has_stroke: false,
  has_shadow: true,
  has_animation: false,
  position: 'bottom',
  position_y: 75,
  max_lines: 2,
  max_chars: 30,
  auto_rotation: false,
  scale: 1,
}

// Properties a template fully owns — cleared before merge so template B never
// inherits from template A (mirrors handleApplyTemplate in Dashboard.jsx)
const TEMPLATE_OWNED_RESET = {
  template_id: '',
  template_20_id: '',
  template_source: '',
  template_class: '',
  template_name: '',
  template_layout: '',
  template_effect: '',
  template_markup: '',
  font_family: 'Inter',
  font_size: 17,
  font_weight: '800',
  font_style: 'normal',
  text_color: '#ffffff',
  text_opacity: 1,
  text_case: 'none',
  secondary_color: '',
  highlight_color: '',
  highlight_gradient: '',
  has_background: false,
  background_color: '#000000',
  background_opacity: 0.7,
  background_padding: 6,
  has_stroke: false,
  stroke_color: '#000000',
  stroke_width: 1,
  has_shadow: true,
  shadow_color: '#000000',
  shadow_blur: 4,
  shadow_offset_x: 0,
  shadow_offset_y: 2,
  show_inactive: undefined,
  position_y: 75,
}

const UPLOAD_LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'hindi', label: 'हिन्दी (Hindi)' },
  { value: 'english', label: 'English' },
  { value: 'marathi', label: 'मराठी (Marathi)' },
  { value: 'tamil', label: 'தமிழ் (Tamil)' },
  { value: 'telugu', label: 'తెలుగు (Telugu)' },
  { value: 'bengali', label: 'বাংলা (Bengali)' },
  { value: 'gujarati', label: 'ગુજરાતી (Gujarati)' },
  { value: 'kannada', label: 'ಕನ್ನಡ (Kannada)' },
  { value: 'malayalam', label: 'മലയാളം (Malayalam)' },
  { value: 'punjabi', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { value: 'urdu', label: 'اردو (Urdu)' },
]

const WORDS_PER_LINE_OPTIONS = [
  { value: 'dynamic', label: 'Auto' },
  { value: '1-2', label: '1–2 words' },
  { value: '3-4', label: '3–4 words' },
  { value: '5-6', label: '5–6 words' },
]

// Templates ship with Latin display fonts. On non-Latin captions those fonts
// have no glyphs and silently fall back — remap to a native font for the
// detected script so the template still reads as "applied".
const resolveTemplateFontForScript = (fontFamily, sampleText) => {
  const script = detectScript(sampleText || '')
  if (script === 'latin') return fontFamily
  const nativeFonts = scriptFontMap[script] || []
  if (nativeFonts.length === 0) return fontFamily
  if (nativeFonts.some(f => f.name === fontFamily)) return fontFamily
  return nativeFonts[0].name
}

export default function MobileDashboard() {
  const { currentUser, userData } = useAuth()
  const navigate = useNavigate()
  const stageRef = useRef(null)
  const fileInputRef = useRef(null)

  const [videoUrl, setVideoUrl] = useState('')
  const [fileId, setFileId] = useState(null)
  const [originalFileName, setOriginalFileName] = useState('')
  const [captions, setCaptions] = useState([])
  const [captionStyle, setCaptionStyle] = useState(defaultCaptionStyle)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [projectId, setProjectId] = useState(null)
  const [settings, setSettings] = useState({ language: 'auto', wordsPerLine: 'dynamic' })

  const [isGenerating, setIsGenerating] = useState(false)
  const [activeSheet, setActiveSheet] = useState(null) // 'captions' | 'templates' | 'style' | 'export'
  const [isPricingOpen, setIsPricingOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const [uploadLanguage, setUploadLanguage] = useState('auto')
  const [uploadWordsPerLine, setUploadWordsPerLine] = useState('dynamic')

  // Restore a previous session (same storage key + shape as the desktop editor)
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('captionEditorState')
      if (savedState) {
        const parsed = JSON.parse(savedState)
        if (parsed.videoUrl && Array.isArray(parsed.captions) && parsed.captions.length > 0) {
          setVideoUrl(parsed.videoUrl)
          setCaptions(parsed.captions)
          setCaptionStyle({ ...defaultCaptionStyle, ...(parsed.captionStyle || {}) })
          setProjectId(parsed.projectId || null)
          setDuration(parsed.duration || 0)
          setFileId(parsed.fileId || null)
          setOriginalFileName(parsed.originalFileName || '')
          if (parsed.settings) setSettings(parsed.settings)
        }
      }
    } catch (e) {
      console.warn('Mobile session restore failed:', e)
    }
    setIsLoaded(true)
  }, [])

  // Debounced auto-save, mirroring the desktop editor's persistence contract
  useEffect(() => {
    if (!isLoaded || !videoUrl) return undefined
    const timeoutId = setTimeout(() => {
      try {
        const serialized = JSON.stringify({
          videoUrl, captions, captionStyle, projectId, settings,
          duration, fileId, originalFileName, savedAt: Date.now(),
        })
        if (serialized.length < 5 * 1024 * 1024) {
          localStorage.setItem('captionEditorState', serialized)
        }
      } catch (e) {
        console.warn('Failed to save state:', e)
      }
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [videoUrl, captions, captionStyle, projectId, settings, duration, fileId, originalFileName, isLoaded])

  // Keep the active caption font loaded (auto-center hook equivalent)
  useEffect(() => {
    if (!captionStyle?.font_family) return
    loadGoogleFont(captionStyle.font_family, [300, 400, 500, 600, 700, 800]).catch(() => {})
  }, [captionStyle?.font_family])

  const handleFilePicked = async (file) => {
    if (!file) return
    setIsGenerating(true)
    setIsPlaying(false)
    const uploadSettings = { language: uploadLanguage, wordsPerLine: uploadWordsPerLine }
    setSettings(uploadSettings)

    try {
      const idToken = currentUser?.accessToken || await currentUser?.getIdToken?.() || ''

      const formData = new FormData()
      formData.append('file', file)
      const uploadData = await apiRequest('/api/upload', {
        method: 'POST',
        body: formData,
        dedupeKey: 'upload-video',
        cancelPrevious: true,
      })
      if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed')
      trackAnalytics('funnel.upload.success', getClientContext({ stage: 'upload', surface: 'mobile', fileId: uploadData.file_id || '' }))

      let minWords = 5
      let maxWords = 6
      if (uploadWordsPerLine !== 'dynamic') {
        const parts = uploadWordsPerLine.split('-').map(Number)
        if (parts.length === 2) { minWords = parts[0]; maxWords = parts[1] }
      }

      const processData = await apiRequest('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: uploadData.file_id,
          language: 'auto',
          min_words: minWords,
          max_words: maxWords,
          id_token: idToken,
        }),
        dedupeKey: 'process-video',
        cancelPrevious: true,
      })
      if (!processData.success) throw new Error(processData.error || 'Processing failed')
      trackAnalytics('funnel.process.success', getClientContext({ stage: 'process', surface: 'mobile', language: uploadLanguage }))

      let generatedCaptions = (processData.captions || []).map((cap, idx) => ({
        text: cap?.text || '',
        start_time: cap?.start_time || 0,
        end_time: cap?.end_time || 3,
        id: `${Date.now()}-${idx}`,
        words: cap?.words || [],
      }))

      if (uploadLanguage !== 'auto' && generatedCaptions.length > 0) {
        try {
          const translateData = await apiRequest('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              captions: generatedCaptions,
              target_language: uploadLanguage,
              id_token: idToken,
            }),
            dedupeKey: 'translate-captions',
            cancelPrevious: true,
          })
          if (translateData.success && translateData.captions) {
            const translatedMap = new Map()
            translateData.captions.forEach(tc => { if (tc.id) translatedMap.set(tc.id, tc.text) })
            generatedCaptions = generatedCaptions.map(c =>
              translatedMap.has(c.id) ? { ...c, text: translatedMap.get(c.id) } : c
            )
          }
        } catch (translateErr) {
          console.warn('Auto-translation failed, using original captions:', translateErr)
        }
      }

      let nextStyle = { ...defaultCaptionStyle, wordsPerLine: uploadWordsPerLine }
      if (generatedCaptions.length > 0) {
        const sampleText = generatedCaptions.map(c => c.text).join(' ')
        const { fontFamily, script } = await autoLoadFontForText(sampleText)
        nextStyle = { ...nextStyle, font_family: fontFamily, detected_script: script }
      }

      setVideoUrl(uploadData.raw_url)
      setFileId(uploadData.file_id)
      setOriginalFileName(file.name)
      setCaptions(generatedCaptions)
      setCaptionStyle(nextStyle)
      setProjectId(`local_${Date.now()}`)
      setCurrentTime(0)
      setDuration(0)
    } catch (error) {
      console.error('Mobile upload failed:', error)
      trackAnalytics('funnel.upload.failed', getClientContext({ stage: 'upload', surface: 'mobile' }))
      notifyApiError(error, 'Failed to process video')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApplyTemplate = (templateStyle) => {
    const sampleText = captions.filter(c => !c.isTextElement).map(c => c.text).join(' ')
    const merged = { ...captionStyle, ...TEMPLATE_OWNED_RESET, ...(templateStyle || {}) }
    if (merged.template_id && merged.font_family) {
      merged.font_family = resolveTemplateFontForScript(merged.font_family, sampleText)
      loadGoogleFont(merged.font_family, [300, 400, 500, 600, 700, 800, 900]).catch(() => {})
    }
    setCaptionStyle(merged)
  }

  const updateStyle = (patch) => setCaptionStyle(prev => ({ ...prev, ...patch }))

  const handleSeek = (time) => {
    setIsPlaying(false)
    setCurrentTime(time)
    const video = stageRef.current?.querySelector('video')
    if (video) video.currentTime = time
  }

  const handleUpdateCaptionText = (captionId, text) => {
    setCaptions(prev => prev.map(c => (c.id === captionId ? { ...c, text } : c)))
  }

  const handleNewProject = () => {
    localStorage.removeItem('captionEditorState')
    setVideoUrl('')
    setFileId(null)
    setOriginalFileName('')
    setCaptions([])
    setCaptionStyle(defaultCaptionStyle)
    setProjectId(null)
    setDuration(0)
    setCurrentTime(0)
    setIsPlaying(false)
    setActiveSheet(null)
  }

  const creditsLabel = userData?.credits_remaining ?? null

  const dockActions = [
    { id: 'captions', label: 'Captions', icon: Captions },
    { id: 'templates', label: 'Templates', icon: LayoutGrid },
    { id: 'style', label: 'Style', icon: SlidersHorizontal },
    { id: 'export', label: 'Export', icon: ArrowDownToLine },
  ]

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#050505] text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => navigate('/Home')} className="text-sm font-black tracking-tight">
          Lekha <span className="text-[#F5A623]">Captions</span>
        </button>
        <div className="flex items-center gap-2">
          {currentUser && creditsLabel !== null && (
            <button
              type="button"
              onClick={() => setIsPricingOpen(true)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-gray-200"
            >
              ⚡ {creditsLabel}
            </button>
          )}
          {!currentUser && (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold text-black"
            >
              Sign in
            </button>
          )}
          {videoUrl && (
            <button
              type="button"
              onClick={handleNewProject}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300"
              aria-label="New project"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="flex min-h-0 flex-1 flex-col px-3 pb-2">
        {isGenerating ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] ring-1 ring-white/10">
                <Sparkles className="h-6 w-6 animate-pulse text-[#f6a54b]" />
              </span>
              <h2 className="text-xl font-semibold">Lekha Captions is working…</h2>
              <p className="mt-2 text-sm text-gray-400">Transcribing your video and preparing captions.</p>
              <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-[#F5A623]" />
            </motion.div>
          </div>
        ) : !videoUrl ? (
          <div className="flex flex-1 flex-col justify-center px-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-sm">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
                <Upload className="h-7 w-7 text-yellow-400" />
              </div>
              <h1 className="text-center text-2xl font-bold">Caption your video</h1>
              <p className="mt-2 text-center text-sm text-gray-500">
                Upload a short video (15–180s works best) and get styled captions in seconds.
              </p>

              <label className="mt-6 block text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Caption language</label>
              <select
                value={uploadLanguage}
                onChange={(e) => setUploadLanguage(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm text-white"
              >
                {UPLOAD_LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>

              <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Words per line</label>
              <div className="mt-1.5 grid grid-cols-4 gap-2">
                {WORDS_PER_LINE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setUploadWordsPerLine(option.value)}
                    className={`rounded-xl border px-1 py-2.5 text-[11px] font-semibold transition-colors ${uploadWordsPerLine === option.value
                      ? 'border-[#F5A623] bg-[#F5A623]/10 text-white'
                      : 'border-white/10 bg-white/[0.03] text-gray-400'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => { handleFilePicked(e.target.files?.[0]); e.target.value = '' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-bold text-black active:bg-gray-200"
              >
                <Upload className="h-4 w-4" />
                Upload video
              </button>
            </motion.div>
          </div>
        ) : (
          <MobileVideoStage
            videoUrl={videoUrl}
            captions={captions}
            captionStyle={captionStyle}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            duration={duration}
            setDuration={setDuration}
            stageRef={stageRef}
          />
        )}
      </main>

      {/* Bottom action dock */}
      {videoUrl && !isGenerating && (
        <nav className="grid shrink-0 grid-cols-4 gap-1 border-t border-white/10 bg-[#0a0a0a] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
          {dockActions.map(action => (
            <button
              key={action.id}
              type="button"
              onClick={() => { setIsPlaying(false); setActiveSheet(action.id) }}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition-colors ${activeSheet === action.id ? 'text-[#F5A623]' : 'text-gray-400 active:text-white'}`}
            >
              <action.icon className="h-5 w-5" />
              {action.label}
            </button>
          ))}
        </nav>
      )}

      {/* Sheets */}
      <MobileCaptionsSheet
        open={activeSheet === 'captions'}
        onClose={() => setActiveSheet(null)}
        captions={captions}
        currentTime={currentTime}
        onSeek={handleSeek}
        onUpdateCaptionText={handleUpdateCaptionText}
      />
      <MobileTemplateSheet
        open={activeSheet === 'templates'}
        onClose={() => setActiveSheet(null)}
        currentStyle={captionStyle}
        onApplyTemplate={handleApplyTemplate}
      />
      <MobileStyleSheet
        open={activeSheet === 'style'}
        onClose={() => setActiveSheet(null)}
        captionStyle={captionStyle}
        updateStyle={updateStyle}
      />
      <MobileExportSheet
        open={activeSheet === 'export'}
        onClose={() => setActiveSheet(null)}
        captions={captions}
        captionStyle={captionStyle}
        fileId={fileId}
        originalFileName={originalFileName}
        stageRef={stageRef}
        onUpgradeClick={() => { setActiveSheet(null); setIsPricingOpen(true) }}
      />

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        onSelectPlan={() => setIsPricingOpen(false)}
        user={currentUser}
        userData={userData}
      />
    </div>
  )
}
