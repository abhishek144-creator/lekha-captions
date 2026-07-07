import React, { useRef, useState } from 'react'
import { FileText, Lock, Video } from 'lucide-react'
import MobileBottomSheet from './MobileBottomSheet'
import { useAuth } from '@/lib/AuthContext'
import { apiRequest } from '@/lib/apiClient'
import { notifyApiError } from '@/lib/notifyApiError'
import { getClientContext, trackAnalytics } from '@/lib/analytics'
import { MOBILE_TEMPLATE_CANONICAL_STYLES } from './mobileTemplates'

// Mobile export flow. Talks to the same backend pipeline as the desktop
// ExportPanel (/api/export → /api/export-status → /api/export-result) and
// builds the same payload shape, including DOM word-layout capture from the
// mobile stage so the ASS renderer takes the precise word_layouts path.

const downloadBlobUrl = (url, filename) => {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const generateSRT = (captions) => {
  const formatTime = (seconds) => {
    const total = Math.max(0, seconds || 0)
    const hrs = Math.floor(total / 3600)
    const mins = Math.floor((total % 3600) / 60)
    const secs = Math.floor(total % 60)
    const ms = Math.floor((total % 1) * 1000)
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
  }
  return captions
    .filter(cap => cap && cap.text && !cap.isTextElement)
    .map((caption, index) => `${index + 1}\n${formatTime(caption.start_time)} --> ${formatTime(caption.end_time)}\n${caption.text}\n`)
    .join('\n')
}

// Same geometry as the desktop ExportPanel: map stage-container percentages
// into rendered-video-area percentages (letterbox aware)
const buildStageGeometry = (stageEl) => {
  const videoEl = stageEl?.querySelector('video')
  if (!stageEl || !videoEl) return null
  const cw = stageEl.offsetWidth || 1
  const ch = stageEl.offsetHeight || 1
  const vnw = videoEl.videoWidth || cw
  const vnh = videoEl.videoHeight || ch
  const vAspect = vnw / vnh
  const cAspect = cw / ch
  let renderW, renderH, offsetX, offsetY
  if (vAspect > cAspect) {
    renderW = cw; renderH = cw / vAspect; offsetX = 0; offsetY = (ch - renderH) / 2
  } else {
    renderH = ch; renderW = ch * vAspect; offsetX = (cw - renderW) / 2; offsetY = 0
  }
  const containerRect = stageEl.getBoundingClientRect()
  const containerToVideo = (xPct, yPct) => {
    const xPx = (xPct / 100) * cw
    const yPx = (yPct / 100) * ch
    return {
      x: Math.max(0, Math.min(100, ((xPx - offsetX) / renderW) * 100)),
      y: Math.max(0, Math.min(100, ((yPx - offsetY) / renderH) * 100)),
    }
  }
  return { cw, ch, renderW, renderH, containerRect, containerToVideo }
}

const captureWordLayouts = (captions, stageEl, geometry) => {
  const layout = {}
  if (!geometry) return layout
  const { containerRect, containerToVideo, renderW, renderH } = geometry
  captions.forEach(cap => {
    if (!cap.words || cap.words.length === 0 || cap.isTextElement) return
    cap.words.forEach((_, wIdx) => {
      const key = `${cap.id}-${wIdx}`
      const el = stageEl.querySelector(`[data-word-key="${key}"]`)
      if (!el) return
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2 - containerRect.left
      const centerY = rect.top + rect.height / 2 - containerRect.top
      const pos = containerToVideo(
        (centerX / containerRect.width) * 100,
        (centerY / containerRect.height) * 100
      )
      layout[key] = {
        x: pos.x,
        y: pos.y,
        w: (rect.width / renderW) * 100,
        h: (rect.height / renderH) * 100,
        rot: 0,
      }
    })
  })
  return layout
}

export default function MobileExportSheet({
  open,
  onClose,
  captions,
  captionStyle,
  fileId,
  originalFileName,
  stageRef,
  onUpgradeClick,
}) {
  const { currentUser, userData } = useAuth()
  const isSignedIn = !!currentUser
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const inFlightRef = useRef(false)

  // Same gating as the desktop ExportPanel (optimistic while userData loads)
  const isPlanActive = (() => {
    if (!isSignedIn) return false
    if (!userData) return true
    if (userData.credits_remaining > 0) return true
    if (userData.subscription_tier && userData.subscription_tier !== 'free') {
      if (!userData.subscription_expiry) return true
      return new Date(userData.subscription_expiry) > new Date()
    }
    return false
  })()

  const pollExportStatus = async (jobId, authHeaders, timeoutMs = 2 * 60 * 1000) => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      let statusPayload
      try {
        statusPayload = await apiRequest(`/api/export-status/${jobId}`, { headers: authHeaders })
      } catch {
        setStatusMessage('Reconnecting...')
        await new Promise(resolve => setTimeout(resolve, 1500))
        continue
      }
      const status = (statusPayload?.status || '').toLowerCase()
      if (status === 'queued') { setStatusMessage('Queued...'); setProgress(prev => Math.max(prev, 25)) }
      else if (status === 'processing') { setStatusMessage('Rendering...'); setProgress(prev => Math.max(prev, 55)) }
      else if (status === 'finalizing') { setStatusMessage('Finalizing...'); setProgress(prev => Math.max(prev, 82)) }
      else if (status === 'completed') { setProgress(prev => Math.max(prev, 90)); return }
      else if (status === 'failed') throw new Error(statusPayload?.error || 'Export failed')
      await new Promise(resolve => setTimeout(resolve, 1200))
    }
    throw new Error('Export timed out. Please retry.')
  }

  const handleExportVideo = async (quality) => {
    if (inFlightRef.current || !fileId || captions.length === 0) return
    inFlightRef.current = true
    setIsExporting(true)
    setProgress(10)
    setStatusMessage('Preparing export...')
    trackAnalytics('funnel.export.started', getClientContext({ stage: 'export', quality, surface: 'mobile' }))

    try {
      const stageEl = stageRef?.current
      const geometry = buildStageGeometry(stageEl)
      const wordLayouts = geometry ? captureWordLayouts(captions, stageEl, geometry) : {}
      const containerToVideo = geometry?.containerToVideo || ((x, y) => ({ x, y }))

      const templateOverride = MOBILE_TEMPLATE_CANONICAL_STYLES[captionStyle?.template_id || ''] || {}
      const cs = { ...captionStyle, ...templateOverride }
      const capVidPos = containerToVideo(cs.position_x ?? 50, cs.position_y ?? 75)
      const templateSnapshot = cs.template_id ? { ...cs, template_snapshot: undefined } : null

      const idToken = currentUser?.accessToken || await currentUser?.getIdToken?.() || ''
      const authHeaders = idToken ? { Authorization: `Bearer ${idToken}` } : {}

      const exportData = {
        file_id: fileId,
        id_token: idToken,
        quality,
        captions: captions.filter(c => c && c.text && !c.isTextElement).map(cap => ({
          id: cap.id,
          text: cap.text,
          start_time: cap.start_time,
          end_time: cap.end_time,
          animation: cap.animation || 'none',
          is_text_element: false,
          template_id: cs.template_id || '',
          template_20_id: '',
          template_source: '',
          template_class: '',
          template_name: cs.template_name || '',
          template_layout: '',
          template_effect: '',
          template_markup: '',
          applied_template_style: templateSnapshot,
          custom_style: null,
          word_styles: cap.wordStyles || {},
          words: cap.words || [],
        })),
        style: {
          font_family: cs.font_family || 'Inter',
          font_size: cs.font_size || 26,
          font_weight: cs.font_weight || '800',
          font_style: cs.font_style || 'normal',
          line_spacing: cs.line_spacing || 1.4,
          text_color: cs.text_color || '#ffffff',
          text_gradient: cs.text_gradient || '',
          text_opacity: cs.text_opacity ?? 1,
          highlight_color: cs.highlight_color || '',
          highlight_gradient: cs.highlight_gradient || '',
          has_background: !!cs.has_background,
          background_opacity: cs.background_opacity ?? 0.7,
          background_color: cs.background_color || '#000000',
          has_stroke: cs.has_stroke || false,
          stroke_width: cs.stroke_width || 1,
          stroke_color: cs.stroke_color || '#000000',
          has_shadow: cs.has_shadow || false,
          shadow_color: cs.shadow_color || '#000000',
          shadow_blur: cs.shadow_blur ?? 4,
          shadow_offset_x: cs.shadow_offset_x ?? 0,
          shadow_offset_y: cs.shadow_offset_y ?? 2,
          has_animation: cs.has_animation || false,
          text_align: cs.text_align || 'center',
          text_case: cs.text_case || 'none',
          is_caps: cs.is_caps || false,
          is_bold: cs.is_bold || false,
          effect_type: cs.effect_type || 'none',
          effect_offset: cs.effect_offset ?? 50,
          effect_direction: cs.effect_direction ?? -45,
          effect_blur: cs.effect_blur ?? 50,
          effect_transparency: cs.effect_transparency ?? 40,
          effect_thickness: cs.effect_thickness ?? 50,
          effect_intensity: cs.effect_intensity ?? 50,
          effect_color: cs.effect_color || '#000000',
          position_x: capVidPos.x,
          position_y: capVidPos.y,
          letter_spacing: cs.letter_spacing || 0,
          word_spacing: cs.word_spacing || 1,
          background_padding: cs.background_padding ?? 6,
          background_h_multiplier: cs.background_h_multiplier ?? 1.05,
          template_id: cs.template_id || '',
          template_20_id: '',
          template_source: '',
          template_class: '',
          template_name: cs.template_name || '',
          template_layout: '',
          template_effect: '',
          template_markup: '',
          template_snapshot: templateSnapshot,
          secondary_color: cs.secondary_color || '',
          show_inactive: cs.show_inactive !== false,
          preview_width: geometry?.renderW || 0,
          preview_height: geometry?.renderH || 0,
          preview_container_width: geometry?.cw || 0,
          preview_container_height: geometry?.ch || 0,
          preview_template_font_px: 0,
        },
        word_layouts: wordLayouts,
      }

      setStatusMessage('Rendering captions onto video...')
      const progressInterval = setInterval(() => {
        setProgress(prev => (prev < 85 ? prev + 1.5 : prev))
      }, 800)

      let result
      try {
        result = await apiRequest('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exportData),
        })
      } finally {
        clearInterval(progressInterval)
      }

      if (!result.success) {
        const detail = result.detail || result.error || ''
        if (detail.includes('PLAN_EXPIRED') || detail.includes('UPGRADE_REQUIRED')) {
          onUpgradeClick?.()
          return
        }
        throw new Error(result.error || 'Export failed')
      }

      let resolvedResult = result
      if (result.export_job_id) {
        await pollExportStatus(result.export_job_id, authHeaders)
        if (!result.video_url) {
          resolvedResult = await apiRequest(`/api/export-result/${result.export_job_id}`, { headers: authHeaders })
        }
      }

      setProgress(92)
      setStatusMessage('Downloading...')
      const videoResponse = await fetch(resolvedResult.video_url)
      if (!videoResponse.ok) throw new Error(`Video download failed (${videoResponse.status})`)
      const blob = await videoResponse.blob()
      const url = URL.createObjectURL(blob)
      const baseName = originalFileName ? originalFileName.replace(/\.[^/.]+$/, '') : 'export'
      downloadBlobUrl(url, `${baseName}_captioned.mp4`)
      URL.revokeObjectURL(url)

      setProgress(100)
      setStatusMessage('Done! Check your downloads.')
      trackAnalytics('funnel.export.success', getClientContext({ stage: 'export', quality, surface: 'mobile' }))
      await new Promise(resolve => setTimeout(resolve, 1200))
    } catch (error) {
      console.error('Mobile export failed:', error)
      trackAnalytics('funnel.export.failed', getClientContext({ stage: 'export', quality, surface: 'mobile' }))
      notifyApiError(error, 'Export failed')
    } finally {
      inFlightRef.current = false
      setIsExporting(false)
      setProgress(0)
      setStatusMessage('')
    }
  }

  const handleDownloadSRT = () => {
    const srt = generateSRT(captions)
    const blob = new Blob([srt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    downloadBlobUrl(url, 'captions.srt')
    URL.revokeObjectURL(url)
  }

  return (
    <MobileBottomSheet open={open} onClose={isExporting ? () => {} : onClose} title="Export" height="55dvh">
      {isExporting ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="relative h-20 w-20">
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div className="absolute inset-1 animate-spin rounded-full border-t-2 border-[#F5A623]" />
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">{Math.round(progress)}%</div>
          </div>
          <p className="mt-4 text-sm font-semibold text-white">Rendering your video</p>
          <p className="mt-1 animate-pulse text-xs text-gray-400">{statusMessage}</p>
          <p className="mt-4 text-[11px] text-gray-500">Keep this tab open — renders take up to 2 minutes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {!isSignedIn && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
              <Lock className="mx-auto mb-2 h-6 w-6 text-white/60" />
              <p className="text-sm font-bold text-white">Sign up to export</p>
              <p className="mb-3 text-xs text-gray-400">Create a free account to get 3 export credits.</p>
              <button
                type="button"
                onClick={() => { window.location.href = '/login' }}
                className="w-full rounded-xl bg-white py-3 text-sm font-bold text-black active:bg-gray-200"
              >
                Sign up free
              </button>
            </div>
          )}
          {isSignedIn && !isPlanActive && (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="flex w-full items-center gap-3 rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4 text-left"
            >
              <Lock className="h-4 w-4 shrink-0 text-yellow-400" />
              <span className="flex-1">
                <span className="block text-sm font-bold text-yellow-300">No credits remaining</span>
                <span className="block text-xs text-yellow-400/70">Tap to upgrade and keep exporting</span>
              </span>
            </button>
          )}

          {[{ quality: '1080p', title: '1080p Full HD', desc: 'Best for Reels & Shorts' }, { quality: '720p', title: '720p HD', desc: 'Faster render' }].map(option => (
            <button
              key={option.quality}
              type="button"
              disabled={!isPlanActive}
              onClick={() => handleExportVideo(option.quality)}
              className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${isPlanActive
                ? 'border-white/10 bg-white/[0.045] active:bg-white/10'
                : 'border-white/5 bg-white/[0.02] opacity-50'}`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F5A623]/15">
                <Video className="h-5 w-5 text-[#F5A623]" />
              </span>
              <span>
                <span className="block text-sm font-bold text-white">{option.title}</span>
                <span className="block text-xs text-gray-500">{option.desc}</span>
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={handleDownloadSRT}
            className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left active:bg-white/10"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <FileText className="h-5 w-5 text-gray-300" />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">SRT subtitles</span>
              <span className="block text-xs text-gray-500">Free — no render needed</span>
            </span>
          </button>
        </div>
      )}
    </MobileBottomSheet>
  )
}
