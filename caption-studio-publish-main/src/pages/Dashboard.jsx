import React, { Suspense, lazy, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, Sparkles, Captions, Clock3, Layers, Layout, SlidersHorizontal, Type, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/lib/AuthContext';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import SidebarNav from '@/components/dashboard/SidebarNav';
import MobileDashboardDock from '@/components/dashboard/MobileDashboardDock';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { extractWaveformData } from '@/components/dashboard/audioUtils';
import { autoLoadFontForText, loadGoogleFont, resolveScriptFont } from '@/components/dashboard/fontUtils';
import { buildEmotionalCaptionPlan, EMOTIONAL_TEMPLATE_TIMING } from '@/components/dashboard/emotionalTemplateUtils';
import { apiRequest } from '@/lib/apiClient';
import { notifyApiError } from '@/lib/notifyApiError';
import { getClientContext, trackAnalytics } from '@/lib/analytics';
import { getEffectiveAuthToken } from '@/lib/devAuth';
import { resolveApiResourceUrl } from '@/components/dashboard/exportPipelineUtils';

const VideoPlayer = lazy(() => import('@/components/dashboard/VideoPlayer'));
const CaptionTimeline = lazy(() => import('@/components/dashboard/CaptionTimeline'));
const CaptionEditor = lazy(() => import('@/components/dashboard/CaptionEditor'));
const StyleControls = lazy(() => import('@/components/dashboard/StyleControls'));
const TextTab = lazy(() => import('@/components/dashboard/TextTab'));
const AnimateTab = lazy(() => import('@/components/dashboard/AnimateTab'));
const HistoryTab = lazy(() => import('@/components/dashboard/HistoryTab'));
const LayersTab = lazy(() => import('@/components/dashboard/LayersTab'));
const UploadModal = lazy(() => import('@/components/dashboard/UploadModal'));
const ExportPanel = lazy(() => import('@/components/dashboard/ExportPanel'));
const PricingModal = lazy(() => import('@/components/dashboard/PricingModal'));
const SidebarTemplateGallery20 = lazy(() => import('@/components/dashboard/SidebarTemplateGallery20'));
const WordClickPopup = lazy(() => import('@/components/dashboard/WordClickPopup'));

const PanelLoadingFallback = ({ label = 'Loading...' }) => (
  <div className="flex h-full min-h-[160px] items-center justify-center rounded-[14px] border border-white/[0.06] bg-white/[0.02] text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
    {label}
  </div>
);

const VideoLoadingFallback = () => (
  <div className="flex h-full min-h-[360px] items-center justify-center rounded-[18px] bg-black">
    <div className="h-9 w-9 animate-spin rounded-full border-4 border-white/15 border-t-white" />
  </div>
);

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
  scale: 1
};

const GENERATING_SCREEN_MIN_MS = 10000;

const TOP_UP_OFFERS = {
  starter: { credits: 10, price: 'Rs 99' },
  creator: { credits: 15, price: 'Rs 99' },
  pro: { credits: 25, price: 'Rs 149' },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeCaptionStyle = (style = {}) => {
  const merged = { ...defaultCaptionStyle, ...style };
  if (!merged.template_id && Number(merged.font_size) <= 18 && String(merged.font_weight || '500') === '500') {
    merged.font_size = defaultCaptionStyle.font_size;
    merged.font_weight = defaultCaptionStyle.font_weight;
    merged.has_shadow = true;
  }
  return merged;
};

const stripDetachedWordLayout = (wordStyles = {}) => Object.fromEntries(
  Object.entries(wordStyles).map(([styleKey, styleValue]) => {
    const nextStyle = { ...(styleValue || {}) };
    delete nextStyle.x;
    delete nextStyle.y;
    delete nextStyle.x_pct;
    delete nextStyle.y_pct;
    delete nextStyle.abs_x_pct;
    delete nextStyle.abs_y_pct;
    delete nextStyle.boxWidth;
    delete nextStyle.textScaleX;
    delete nextStyle.rotation;
    delete nextStyle.frozenFontSize;
    // Authored templates own entrance motion. Keeping a previous per-word
    // animation here forces multiple templates through the same generic effect.
    delete nextStyle.animation;
    delete nextStyle.animationSpeed;
    return [styleKey, nextStyle];
  }),
);

export default function Dashboard() {
  const { currentUser, userData } = useAuth();
  const location = useLocation();

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  // Once opened, ExportPanel stays mounted (hidden) so an in-flight export keeps
  // its progress state when the sheet is closed and reopened. Unmounting it
  // mid-export orphaned the running export and let users start a duplicate one.
  const [exportPanelMounted, setExportPanelMounted] = useState(false);
  const [isPlanExpiredModalOpen, setIsPlanExpiredModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [videoUrl, setVideoUrl] = useState('');
  const [fileId, setFileId] = useState(null);
  const [originalFileName, setOriginalFileName] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Lock body scroll while dashboard is mounted (prevents shrink when navigating back from UserAccount)
  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Video canvas fullscreen & resizable timeline
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(42);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(true);
  const [dividerSnapping, setDividerSnapping] = useState(false); // visual snap feedback
  const timelineDividerRef = useRef(null);
  const isDraggingDivider = useRef(false);
  const dividerStartY = useRef(0);
  const dividerStartHeight = useRef(204);
  const defaultTimelineHeight = useRef(204);

  // Resizer snap positions (timeline height values)
  // SNAP_MAX_CANVAS is dynamic — matches the actual rendered default
  const SNAP_BALANCED  = 148;
  const SNAP_MAX_TIMELINE = 300;
  const SNAP_THRESHOLD = 20;     // px distance to trigger a snap

  const [captions, setCaptions] = useState([]);
  const [selectedCaptionId, setSelectedCaptionId] = useState(null);
  const [captionStyle, setCaptionStyle] = useState(defaultCaptionStyle);

  // DEV-ONLY seed: load a sample video + Hindi captions instantly for verifying
  // template rendering without the upload/transcribe flow. Activate with ?devseed=1.
  // Guarded by import.meta.env.DEV so it is dropped from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('devseed')) return;
    const mkWords = (pairs) => pairs.map(([w, s, e]) => ({ word: w, text: w, start: s, end: e }));
    // Served from public/ (gitignored) — drop any small clip there. The old
    // /uploads/<id>.mov path 404s: uploads are now token-gated behind
    // /api/media/upload/<id>, which the seed cannot sign.
    setVideoUrl('/dev-sample.mov');
    setDuration(12);
    setFileId('devseed');
    setCaptions([
      { id: 'seed-hindi-0', text: 'ये आपको पढ़ना है', start_time: 0, end_time: 2.3, position_x: 50, position_y: null, wordStyles: {},
        words: mkWords([['ये', 0, 0.5], ['आपको', 0.5, 1.1], ['पढ़ना', 1.1, 1.8], ['है', 1.8, 2.3]]) },
      { id: 'seed-hindi-1', text: 'मुंबई की अपनी कहानी', start_time: 2.4, end_time: 4.7, position_x: 50, position_y: null, wordStyles: {},
        words: mkWords([['मुंबई', 2.4, 3.0], ['की', 3.0, 3.4], ['अपनी', 3.4, 4.0], ['कहानी', 4.0, 4.7]]) },
      { id: 'seed-hindi-2', text: 'हर शब्द अलग असर', start_time: 4.8, end_time: 7.1, position_x: 50, position_y: null, wordStyles: {},
        words: mkWords([['हर', 4.8, 5.3], ['शब्द', 5.3, 5.9], ['अलग', 5.9, 6.5], ['असर', 6.5, 7.1]]) },
      { id: 'seed-hindi-3', text: 'धीरे धीरे सामने आता', start_time: 7.2, end_time: 9.5, position_x: 50, position_y: null, wordStyles: {},
        words: mkWords([['धीरे', 7.2, 7.8], ['धीरे', 7.8, 8.3], ['सामने', 8.3, 8.9], ['आता', 8.9, 9.5]]) },
      { id: 'seed-hindi-4', text: 'और याद रह जाता है', start_time: 9.6, end_time: 12, position_x: 50, position_y: null, wordStyles: {},
        words: mkWords([['और', 9.6, 10.0], ['याद', 10.0, 10.5], ['रह', 10.5, 10.9], ['जाता', 10.9, 11.5], ['है', 11.5, 12]]) },
    ]);
    setIsLoaded(true);
  }, []);

  const [projectId, setProjectId] = useState(null);
  const [settings, setSettings] = useState({ language: 'english', style: 'viral_hook' });
  const [isLoaded, setIsLoaded] = useState(false);

  // Undo/Redo state. `history` holds PRE-change snapshots (history[historyIndex]
  // is what undo restores). Undone states live on `redoStack` — without it, redo
  // re-restored the snapshot the editor was already showing and the newest state
  // was unreachable.
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [redoStack, setRedoStack] = useState([]);
  const lastCoalescedPushRef = useRef(0);

  // Active tab for sidebar navigation
  const [activeTab, setActiveTab] = useState('captions');

  // Floating Word Popup state
  const [wordPopup, setWordPopup] = useState(null);
  const [wordPopupOpenCount, setWordPopupOpenCount] = useState(0);

  // Animation settings
  const selectedWordForAnimation = null;

  // Waveform data for timeline
  const [waveformData, setWaveformData] = useState(null);
  const initialEditorStateRef = useRef(null);
  const mediaRefreshInFlightRef = useRef(false);

  // External Video Sync Signal
  const [seekSignal, setSeekSignal] = useState(null);
  const [generationTicker, setGenerationTicker] = useState(0);

  const snapshotEditorState = useCallback((overrides = {}) => ({
    videoUrl,
    captions: JSON.parse(JSON.stringify(overrides.captions ?? captions)),
    captionStyle: JSON.parse(JSON.stringify(overrides.captionStyle ?? captionStyle)),
    duration: overrides.duration ?? duration,
    fileId: overrides.fileId ?? fileId,
    originalFileName: overrides.originalFileName ?? originalFileName,
    projectId: overrides.projectId ?? projectId,
    settings: JSON.parse(JSON.stringify(overrides.settings ?? settings)),
  }), [captionStyle, captions, duration, fileId, originalFileName, projectId, settings, videoUrl]);

  // Force a clean session natively on page load, unless navigating back from Account
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // DEV-ONLY: let the ?devseed effect own the session; don't wipe it here.
    if (import.meta.env.DEV && params.has('devseed')) {
      setIsLoaded(true);
      return;
    }
    const isNavigationRestore = location.state?.restoreSession || params.get('restoreSession') === '1';

    if (isNavigationRestore) {
      try {
        const savedState = localStorage.getItem('captionEditorState');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          if (parsed.videoUrl) setVideoUrl(parsed.videoUrl);
          if (parsed.captions) setCaptions(parsed.captions);
          if (parsed.captionStyle) setCaptionStyle(normalizeCaptionStyle(parsed.captionStyle));
          if (parsed.projectId) setProjectId(parsed.projectId);
          if (parsed.duration) setDuration(parsed.duration);
          if (parsed.fileId) setFileId(parsed.fileId);
          if (parsed.originalFileName) setOriginalFileName(parsed.originalFileName);
          if (parsed.settings) setSettings(parsed.settings);
          initialEditorStateRef.current = {
            videoUrl: parsed.videoUrl || '',
            captions: JSON.parse(JSON.stringify(parsed.captions || [])),
            captionStyle: JSON.parse(JSON.stringify(normalizeCaptionStyle(parsed.captionStyle || defaultCaptionStyle))),
            duration: parsed.duration || 0,
            fileId: parsed.fileId || null,
            originalFileName: parsed.originalFileName || '',
            projectId: parsed.projectId || null,
            settings: JSON.parse(JSON.stringify(parsed.settings || { language: 'english', style: 'viral_hook' })),
          };
          setIsLoaded(true);
          return; // Skip wiping logic
        }
      } catch (e) {
        console.warn('Restore failed:', e);
      }
    }

    localStorage.removeItem('captionEditorState');

    setVideoUrl('');
    setCaptions([]);
    setCaptionStyle(defaultCaptionStyle);
    setProjectId(null);
    setDuration(0);
    setCurrentTime(0);
    setHistory([]);
    setHistoryIndex(-1);
    setIsUploadModalOpen(false);

    // Clean up URL parameters if they exist
    if (params.get('action') || params.get('session_reset')) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!videoUrl) setWordPopup(null);
  }, [videoUrl]);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationTicker(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setGenerationTicker(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isGenerating]);

  useEffect(() => {
    if (!wordPopup) return;

    const targetId = wordPopup.type === 'element'
      ? wordPopup.elementId
      : wordPopup.caption?.id;
    if (!targetId) {
      setWordPopup(null);
      return;
    }

    const activeTarget = captions.find(c => c.id === targetId);
    if (!activeTarget) {
      setWordPopup(null);
      return;
    }

    const start = activeTarget.start_time ?? activeTarget.start ?? 0;
    const end = activeTarget.end_time ?? activeTarget.end ?? start;
    const stillInTime = currentTime >= start - 0.03 && currentTime <= end + 0.03;
    if (!stillInTime) {
      setWordPopup(null);
    }
  }, [captions, currentTime, wordPopup]);

  useEffect(() => {
    if (!wordPopup) return;

    const handleOutsideWordEditPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (
        target.closest('.lekha-video-frame')
        || target.closest('[data-selected-word-box="true"]')
        || target.closest('[data-word-popup-panel="true"]')
        || target.closest('[data-video-control]')
      ) {
        return;
      }

      setWordPopup(null);
    };

    document.addEventListener('pointerdown', handleOutsideWordEditPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideWordEditPointerDown, true);
    };
  }, [wordPopup]);

  useEffect(() => {
    const handleGlobalSelectionClear = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (
        target.closest('[data-caption-layer="true"]')
        || target.closest('[data-text-element-layer="true"]')
        || target.closest('.resize-handle')
        || target.closest('.text-resize-handle')
        || target.closest('[data-selected-word-box="true"]')
        || target.closest('[data-word-popup-panel="true"]')
        || target.closest('[data-video-control]')
        || target.closest('[contenteditable="true"]')
        || target.closest('[data-word-key]')
      ) {
        return;
      }

      setSelectedCaptionId(null);
      setWordPopup(null);
    };

    document.addEventListener('pointerdown', handleGlobalSelectionClear, true);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalSelectionClear, true);
    };
  }, []);

  // Auto-save to localStorage whenever state changes (debounced)
  useEffect(() => {
    if (!isLoaded) return;

    const timeoutId = setTimeout(() => {
      const stateToSave = {
        videoUrl,
        captions,
        captionStyle,
        projectId,
        settings,
        duration,
        fileId,
        originalFileName,
        // Note: modal states (isUploadModalOpen etc.) are intentionally NOT saved
        // so modals don't re-open unexpectedly on page reload
        savedAt: Date.now()
      };

      try {
        const serialized = JSON.stringify(stateToSave);
        // Only save if under 5MB to prevent quota errors
        if (serialized.length < 5 * 1024 * 1024) {
          localStorage.setItem('captionEditorState', serialized);
        }
      } catch (e) {
        console.warn('Failed to save state:', e);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [videoUrl, captions, captionStyle, projectId, settings, duration, fileId, originalFileName, isLoaded]);

  const handleUpload = async (file, uploadSettings) => {
    setWordPopup(null);
    setIsUploading(true);
    setSettings(uploadSettings);
    setIsUploadModalOpen(false);
    setIsGenerating(true);
    setHistory([]);
    setHistoryIndex(-1);
    setRedoStack([]);
    initialEditorStateRef.current = null;
    const generationStart = Date.now();
    setGenerationStartedAt(generationStart);

    try {
      const mediaAuthToken = await getEffectiveAuthToken(currentUser);
      let uploadData = null;
      if (uploadSettings?.preUploadedFileId && uploadSettings?.preUploadedRawUrl) {
        uploadData = {
          success: true,
          file_id: uploadSettings.preUploadedFileId,
          raw_url: uploadSettings.preUploadedRawUrl
        };
      } else {
        const formData = new FormData();
        formData.append('file', file);
        uploadData = await apiRequest('/api/upload', {
          method: 'POST',
          headers: mediaAuthToken ? { Authorization: `Bearer ${mediaAuthToken}` } : {},
          body: formData,
          dedupeKey: 'upload-video',
          cancelPrevious: true,
        });
        if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');
        trackAnalytics('funnel.upload.success', getClientContext({ stage: 'upload', fileId: uploadData.file_id || '' }));
      }

      // Parse wordsPerLine range for backend (e.g., "1-2" -> min=1, max=2).
      // "dynamic" (or unset) -> min=5, max=6 so animated templates receive full phrases.
      let minWords = 5, maxWordsVal = 6;
      const wpl = uploadSettings?.wordsPerLine;
      if (wpl && wpl !== 'dynamic') {
        const rangeParts = wpl.split('-').map(Number);
        if (rangeParts.length === 2) {
          minWords = rangeParts[0];
          maxWordsVal = rangeParts[1];
        } else if (rangeParts.length === 1 && !isNaN(rangeParts[0]) && rangeParts[0] > 0) {
          // Single value like "1" → exactly N words per caption
          minWords = rangeParts[0];
          maxWordsVal = rangeParts[0];
        }
      }

      const processData = await apiRequest('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: uploadData.file_id,
          language: 'auto',
          min_words: minWords,
          max_words: maxWordsVal,
          id_token: mediaAuthToken,
        }),
        dedupeKey: 'process-video',
        cancelPrevious: true,
      });
      if (!processData.success) throw new Error(processData.error || 'Processing failed');
      trackAnalytics('funnel.process.success', getClientContext({ stage: 'process', language: uploadSettings?.language || 'auto' }));

      let generatedCaptions = (processData.captions || []).map((cap, idx) => ({
        text: cap?.text || '',
        start_time: cap?.start_time || 0,
        end_time: cap?.end_time || 3,
        id: `${Date.now()}-${idx}`,
        words: cap?.words || []
      }));
      if (generatedCaptions.length === 0) {
        throw new Error('No speech with usable word timestamps was detected. Try another video or add captions manually.');
      }

      // Auto-translate if user selected a specific caption language (not 'auto')
      const targetLang = uploadSettings?.language;
      if (targetLang && targetLang !== 'auto' && generatedCaptions.length > 0) {
        try {
          const translateToken = await getEffectiveAuthToken(currentUser);
          const translateData = await apiRequest('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              captions: generatedCaptions.filter(c => !c.isTextElement),
              target_language: targetLang,
              id_token: translateToken || '',
            }),
            dedupeKey: 'translate-captions',
            cancelPrevious: true,
          });
          if (translateData.success && translateData.captions) {
            trackAnalytics('funnel.translate.success', getClientContext({ stage: 'translate', targetLanguage: targetLang }));
            const translatedMap = new Map();
            translateData.captions.forEach(tc => { if (tc.id) translatedMap.set(tc.id, tc.text); });
            generatedCaptions = generatedCaptions.map(c => {
              if (c.isTextElement || !translatedMap.has(c.id)) return c;
              return { ...c, text: translatedMap.get(c.id) };
            });
          } else {
            throw new Error(translateData.error || `Translation to ${targetLang} failed`);
          }
        } catch (translateErr) {
          trackAnalytics('funnel.translate.failed', getClientContext({ stage: 'translate', targetLanguage: targetLang }));
          throw new Error(`Could not translate captions to ${targetLang}. Please retry.`, { cause: translateErr });
        }
      }

      const playableVideoUrl = resolveApiResourceUrl(
        uploadData.raw_url,
        import.meta.env.VITE_API_BASE_URL,
      );
      if (!playableVideoUrl) throw new Error('Upload completed without a playable media URL');
      setVideoUrl(playableVideoUrl);
      setFileId(uploadData.file_id);
      setOriginalFileName(file.name);

      // If style is 'double_line', merge consecutive caption pairs into 2-line captions
      const captionLines = uploadSettings?.style;
      if (captionLines === 'double_line' && generatedCaptions.length > 1) {
        const merged = [];
        for (let i = 0; i < generatedCaptions.length; i += 2) {
          if (i + 1 < generatedCaptions.length) {
            merged.push({
              text: generatedCaptions[i].text + '\n' + generatedCaptions[i + 1].text,
              start_time: generatedCaptions[i].start_time,
              end_time: generatedCaptions[i + 1].end_time,
              id: `${Date.now()}-${merged.length}`,
              words: [...(generatedCaptions[i].words || []), ...(generatedCaptions[i + 1].words || [])]
            });
          } else {
            merged.push(generatedCaptions[i]);
          }
        }
        generatedCaptions = merged;
      }

      setCaptions(generatedCaptions);

      let nextCaptionStyle = {
        ...defaultCaptionStyle,
        wordsPerLine: uploadSettings?.wordsPerLine || 'dynamic'
      };
      if (generatedCaptions.length > 0) {
        const sampleText = generatedCaptions.map(c => c.text).join(' ');
        const { fontFamily, script, fontOptions } = await autoLoadFontForText(sampleText);
        nextCaptionStyle = {
          ...nextCaptionStyle,
          font_family: fontFamily,
          detected_script: script,
          available_fonts: fontOptions?.map(f => f.name) || [],
        };
      }
      setCaptionStyle(nextCaptionStyle);

      const nextProjectId = `local_${Date.now()}`;
      setProjectId(nextProjectId);
      initialEditorStateRef.current = {
        videoUrl: playableVideoUrl,
        captions: JSON.parse(JSON.stringify(generatedCaptions)),
        captionStyle: JSON.parse(JSON.stringify(nextCaptionStyle)),
        duration: 0,
        fileId: uploadData.file_id,
        originalFileName: file.name,
        projectId: nextProjectId,
        settings: JSON.parse(JSON.stringify(uploadSettings)),
      };

      try {
        const waveform = await extractWaveformData(playableVideoUrl);
        setWaveformData(waveform);
      } catch (e) {
        console.warn('Waveform extraction failed:', e);
      }

    } catch (error) {
      console.error('Upload failed:', error);
      setVideoUrl('');
      setFileId(null);
      setOriginalFileName('');
      setCaptions([]);
      setProjectId(null);
      setDuration(0);
      setCurrentTime(0);
      setWaveformData(null);
      trackAnalytics('funnel.upload.failed', getClientContext({ stage: 'upload' }));
      notifyApiError(error, 'Failed to process video')
    } finally {
      const elapsedMs = Date.now() - generationStart;
      const remainingMinDurationMs = Math.max(0, GENERATING_SCREEN_MIN_MS - elapsedMs);
      if (remainingMinDurationMs > 0) {
        await sleep(remainingMinDurationMs);
      }
      setIsUploading(false);
      setIsGenerating(false);
      setGenerationStartedAt(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('captionEditorState', JSON.stringify({
        videoUrl, captions, captionStyle, projectId, settings, duration,
        fileId, originalFileName
      }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeek = (time) => {
    setCurrentTime(time);
    setSeekSignal(time);
  };

  const handlePlayCaption = (caption) => {
    const startTime = Number(caption?.start_time || 0);
    handleSeek(startTime);
    setIsPlaying(true);
  };

  const refreshVideoPlaybackUrl = useCallback(async (event) => {
    if (!fileId || mediaRefreshInFlightRef.current) return;

    const videoEl = event?.currentTarget || event?.target || null;
    const resumeAt = Number(videoEl?.currentTime || currentTime || 0);
    const shouldResume = Boolean(isPlaying);
    mediaRefreshInFlightRef.current = true;

    try {
      const mediaAuthToken = await getEffectiveAuthToken(currentUser);
      const data = await apiRequest('/api/media/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          id_token: mediaAuthToken || '',
        }),
        dedupeKey: 'refresh-upload-media-url',
        cancelPrevious: true,
      });

      const refreshedVideoUrl = resolveApiResourceUrl(
        data?.raw_url,
        import.meta.env.VITE_API_BASE_URL,
      );
      if (data?.success && refreshedVideoUrl && refreshedVideoUrl !== videoUrl) {
        setVideoUrl(refreshedVideoUrl);
        setCurrentTime(resumeAt);
        setSeekSignal(resumeAt);
        if (shouldResume) setIsPlaying(true);
      }
    } catch (error) {
      console.warn('Failed to refresh video playback URL:', error);
    } finally {
      mediaRefreshInFlightRef.current = false;
    }
  }, [currentTime, currentUser, fileId, isPlaying, videoUrl]);

  // Push current state to history, then apply new state.
  // options.coalesce: rapid consecutive pushes (e.g. per-keystroke text edits)
  // record only ONE snapshot per burst — without this, typing a sentence pushed
  // ~50 single-character entries and flushed the entire useful undo history.
  const pushHistory = (newCaptions, newStyle, options = {}) => {
    const now = Date.now();
    const coalesce = options.coalesce === true;
    const withinBurst = coalesce && (now - lastCoalescedPushRef.current < 1200);
    lastCoalescedPushRef.current = coalesce ? now : 0;
    if (!withinBurst) {
      const snapshot = {
        captions: JSON.parse(JSON.stringify(captions)),
        captionStyle: JSON.parse(JSON.stringify(captionStyle))
      };
      const trimmed = history.slice(0, historyIndex + 1);
      const newHistory = [...trimmed, snapshot];
      // Cap history at 50 entries
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    // Any new change invalidates the redo branch.
    setRedoStack([]);
    if (newCaptions !== undefined) setCaptions(newCaptions);
    if (newStyle !== undefined) setCaptionStyle(newStyle);
  };

  const updateCaptions = (newCaptions, options) => pushHistory(newCaptions, undefined, options);
  const updateCaptionStyle = (newStyle) => pushHistory(undefined, newStyle);

  const handleWordStyleChange = (key, value) => {
    if (!wordPopup) return;

    // Always use raw setCaptions — never updateCaptions here.
    // History is recorded separately via onHistoryRecord (onPointerDown on sliders).
    // Using updateCaptions causes stale closure snapshots and corrupts other words.
    setCaptions(prev => prev.map(c => {
      if (wordPopup.type === 'element') {
        if (c.id !== wordPopup.elementId) return c;
      } else {
        if (c.id !== wordPopup.caption?.id) return c;
      }
      const wordStyles = c.wordStyles || {};
      const styleKey = wordPopup.type === 'element'
        ? `${wordPopup.elementId}-${wordPopup.wordIndex}`
        : `${wordPopup.caption?.id}-${wordPopup.wordIndex}`;
      const existingStyle = wordStyles[styleKey] || {};
      const updatedStyle = { ...existingStyle, [key]: value };
      if (key === 'textGradient') {
        updatedStyle.textGradient = typeof value === 'string' ? value.trim() : '';
      }
      // Slider size changes should grow the word normally, not keep a narrow side-resize box.
      if (key === 'fontSize') {
        delete updatedStyle.frozenFontSize;
        delete updatedStyle.boxWidth;
        delete updatedStyle.textScaleX;
      }
      if (key === 'x') delete updatedStyle.x_pct;
      if (key === 'y') delete updatedStyle.y_pct;

      return {
        ...c,
        wordStyles: {
          ...wordStyles,
          [styleKey]: updatedStyle
        }
      };
    }));

    setWordPopup(prev => {
      if (!prev?.caption || prev.type === 'element') return prev;
      const styleKey = `${prev.caption.id}-${prev.wordIndex}`;
      const existingStyle = prev.caption.wordStyles?.[styleKey] || {};
      const updatedStyle = { ...existingStyle, [key]: value };
      if (key === 'textGradient') {
        updatedStyle.textGradient = typeof value === 'string' ? value.trim() : '';
      }
      if (key === 'fontSize') {
        delete updatedStyle.frozenFontSize;
        delete updatedStyle.boxWidth;
        delete updatedStyle.textScaleX;
      }
      if (key === 'x') delete updatedStyle.x_pct;
      if (key === 'y') delete updatedStyle.y_pct;
      return {
        ...prev,
        caption: {
          ...prev.caption,
          wordStyles: {
            ...(prev.caption.wordStyles || {}),
            [styleKey]: updatedStyle,
          },
        },
      };
    });
  };

  const handleApplyTemplate = async (templateStyle) => {
    // Hard Reset: properties that templates fully control are cleared before applying
    // so Template B never inherits BG, color, font, spacing, phase, or animation
    // from Template A. Non-template properties (effects, position_x) are preserved.
    const TEMPLATE_OWNED_RESET = {
      template_id: '',
      template_20_id: '',
      template_source: '',
      template_class: '',
      template_name: '',
      template_layout: '',
      template_effect: '',
      template_markup: '',
      template_color_customized: false,
      // Both galleries set these (the left set extracts letter/line spacing
      // from its authored CSS; the advanced pack sets line/word spacing and a
      // default phase index), so they are template-owned and must reset too —
      // otherwise Template B inherits Template A's spacing or phase selection.
      template_phase_index: 0,
      letter_spacing: 0,
      line_spacing: defaultCaptionStyle.line_spacing,
      word_spacing: defaultCaptionStyle.word_spacing,
      font_family: 'Inter',
      font_size: 17,
      font_weight: '800',
      font_style: 'normal',
      text_color: '#ffffff',
      text_gradient: '',
      text_opacity: 1,
      text_case: 'none',
      secondary_color: '',
      highlight_color: '',
      highlight_gradient: '',
      emphasis_color: '',
      karaoke_color_1: '',
      karaoke_color_2: '',
      karaoke_color_3: '',
      has_background: true,
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
      display_mode: 'sentence',
      position_y: 75,
    };
    const {
      template_snapshot: _previousTemplateSnapshot,
      template_applied_at: _previousTemplateAppliedAt,
      ...templateStyleForSnapshot
    } = templateStyle || {};
    const hasTemplateSelection = !!(
      templateStyleForSnapshot?.template_id
      || templateStyleForSnapshot?.template_20_id
    );
    const templateSnapshot = hasTemplateSelection
      ? JSON.parse(JSON.stringify({
        ...templateStyleForSnapshot,
        emotional_intelligence: true,
        emotional_timing: EMOTIONAL_TEMPLATE_TIMING,
      }))
      : null;
    const merged = {
      ...captionStyle,
      ...TEMPLATE_OWNED_RESET,
      ...templateStyleForSnapshot,
      template_snapshot: templateSnapshot,
      template_applied_at: templateSnapshot ? Date.now() : null,
    };
    // Indic-script safety net: a template's Latin display font (Bodoni, Bebas Neue,
    // Oxanium, …) has no Devanagari glyphs, so on Hindi/Marathi captions it silently
    // falls back to a default face and the template looks like it "didn't apply".
    // Swap in a Devanagari font of matching character so the template visibly lands.
    //
    // IMPORTANT: do NOT decide this from the *dominant* script of all captions joined.
    // A project can be Latin-dominant overall (English hooks, numbers, @handles, 8+
    // mixed elements) yet still contain Hindi caption lines. Aggregate detection then
    // returns 'latin', the Latin template font is kept, and every Hindi line renders in
    // a glyphless fallback = "template not applied / plain white". Instead remap as soon
    // as ANY non-text caption needs a different (script-appropriate) face. resolveScriptFont
    // is a no-op on captions that don't need swapping, so the first one that DOES need it
    // (e.g. the Hindi line) wins. Render-time per-caption resolution in VideoPlayer still
    // handles genuinely mixed projects line-by-line; this just makes the stored font (and
    // the font we eagerly load) correct for the script actually present.
    let _mappedFont = merged.font_family
    if (merged.font_family) {
      for (const c of captions) {
        if (!c || c.isTextElement) continue
        const m = resolveScriptFont(merged.font_family, String(c.text || ''))
        if (m && m !== merged.font_family) { _mappedFont = m; break }
      }
      if (_mappedFont !== merged.font_family) merged.font_family = _mappedFont
      if (templateSnapshot) templateSnapshot.font_family = merged.font_family
    }
    const emotionalPlan = templateSnapshot
      ? buildEmotionalCaptionPlan(captions, waveformData, duration, templateSnapshot.template_markup)
      : [];
    const emotionalByCaptionId = new Map(emotionalPlan.map((entry) => [entry.captionId, entry]));
    const nextCaptions = captions.map(cap => {
      if (!cap || cap.isTextElement) return cap;
      if (!templateSnapshot) {
        const {
          applied_template_style: _appliedTemplateStyle,
          template_id: _captionTemplateId,
          template_20_id: _captionTemplate20Id,
          template_source: _captionTemplateSource,
          template_class: _captionTemplateClass,
          template_name: _captionTemplateName,
          template_layout: _captionTemplateLayout,
          template_effect: _captionTemplateEffect,
          template_markup: _captionTemplateMarkup,
          emotional_mode: _emotionalMode,
          template_phase_index: _templatePhaseIndex,
          imp_word_index: _impWordIndex,
          imp_word_indices: _impWordIndices,
          emphasis_color: _emphasisColor,
          audio_emotion_metrics: _audioEmotionMetrics,
          ...rest
        } = cap;
        return rest;
      }
      const emotional = emotionalByCaptionId.get(cap.id);
      const templatePhaseIndex = templateSnapshot.template_id === 't17'
        ? 1
        : emotional?.phaseIndex ?? 0;
      const templateEmphasisColor = templateSnapshot.highlight_color
        || templateSnapshot.emphasis_color
        || templateSnapshot.secondary_color
        || emotional?.emphasisColor
        || '';
      return {
        ...cap,
        wordStyles: stripDetachedWordLayout(cap.wordStyles || {}),
        animation: 'none',
        animationSpeed: 1,
        template_id: templateSnapshot.template_id || '',
        template_20_id: templateSnapshot.template_20_id || '',
        template_source: templateSnapshot.template_source || '',
        template_class: templateSnapshot.template_class || '',
        template_name: templateSnapshot.template_name || '',
        template_layout: templateSnapshot.template_layout || '',
        template_effect: templateSnapshot.template_effect || '',
        template_markup: templateSnapshot.template_markup || '',
        applied_template_style: templateSnapshot,
        emotional_mode: emotional?.mode || 'normal',
        template_phase_index: templatePhaseIndex,
        imp_word_index: emotional?.impWordIndex ?? -1,
        imp_word_indices: emotional?.impWordIndices || [],
        emphasis_color: templateEmphasisColor,
        audio_emotion_metrics: emotional?.audio || null,
      };
    });
    // Load the font that will actually render (merged.font_family — already remapped
    // to a Devanagari family above when the captions are Indic) so it's ready on apply.
    if (merged.font_family) {
      loadGoogleFont(merged.font_family, [300, 400, 500, 600, 700, 800, 900]).catch(() => {});
    }
    pushHistory(nextCaptions, merged);
  };
  const addToHistory = () => pushHistory(undefined, undefined);

  const handleResetWordFontSize = useCallback(() => {
    if (!wordPopup) return;
    addToHistory();

    setCaptions(prev => prev.map(c => {
      const targetId = wordPopup.type === 'element' ? wordPopup.elementId : wordPopup.caption?.id;
      if (c.id !== targetId) return c;

      const wordStyles = c.wordStyles || {};
      const styleKey = wordPopup.type === 'element'
        ? `${wordPopup.elementId}-${wordPopup.wordIndex}`
        : `${wordPopup.caption?.id}-${wordPopup.wordIndex}`;
      const existingStyle = wordStyles[styleKey] || {};
      const updatedStyle = { ...existingStyle };

      delete updatedStyle.fontSize;
      delete updatedStyle.frozenFontSize;

      return {
        ...c,
        wordStyles: {
          ...wordStyles,
          [styleKey]: updatedStyle,
        },
      };
    }));
  }, [addToHistory, wordPopup]);

  const handleUndo = () => {
    if (historyIndex >= 0) {
      const prevState = history[historyIndex];
      // Save the state being undone so redo can bring it back — history only
      // holds pre-change snapshots, never the state after a change.
      setRedoStack(stack => [...stack, {
        captions: JSON.parse(JSON.stringify(captions)),
        captionStyle: JSON.parse(JSON.stringify(captionStyle))
      }]);
      setCaptions(prevState.captions);
      setCaptionStyle(prevState.captionStyle);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextState = redoStack[redoStack.length - 1];
      setRedoStack(stack => stack.slice(0, -1));
      // The state being replaced becomes the pre-change snapshot again.
      setHistory(h => [...h.slice(0, historyIndex + 1), {
        captions: JSON.parse(JSON.stringify(captions)),
        captionStyle: JSON.parse(JSON.stringify(captionStyle))
      }]);
      setHistoryIndex(historyIndex + 1);
      setCaptions(nextState.captions);
      setCaptionStyle(nextState.captionStyle);
    }
  };

  // Global keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y / Ctrl+Shift+Z (redo)
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      // Don't intercept if user is typing in an input/textarea/contenteditable
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); handleRedo(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);

  }, [historyIndex, history, redoStack, captions, captionStyle]);

  const handleRefresh = () => {
    const initialState = initialEditorStateRef.current || snapshotEditorState();

    if (!initialState) {
      handleNewProject();
      return;
    }

    setWordPopup(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setSelectedCaptionId(null);
    setIsVideoFullscreen(false);
    setIsTimelineCollapsed(true);
    setTimelineHeight(42);
    setSettings(JSON.parse(JSON.stringify(initialState.settings)));
    setVideoUrl(initialState.videoUrl || '');
    setCaptions(JSON.parse(JSON.stringify(initialState.captions || [])));
    setCaptionStyle(JSON.parse(JSON.stringify(initialState.captionStyle || defaultCaptionStyle)));
    setProjectId(initialState.projectId || null);
    setDuration(initialState.duration || 0);
    setFileId(initialState.fileId || null);
    setOriginalFileName(initialState.originalFileName || '');
    setHistory([]);
    setHistoryIndex(-1);
    setRedoStack([]);
  };

  const handleNewProject = () => {
    localStorage.removeItem('captionEditorState');
    initialEditorStateRef.current = null;
    setVideoUrl('');
    setCaptions([]);
    setCaptionStyle(defaultCaptionStyle);
    setProjectId(null);
    setDuration(0);
    setCurrentTime(0);
    setSelectedCaptionId(null);
    setHistory([]);
    setHistoryIndex(-1);
    setRedoStack([]);
  };

  const handleSelectPlan = async () => {
    // Server-verified payment updates are refreshed by PricingModal. Never
    // persist a client-selected plan as an authorization signal.
    setIsPricingModalOpen(false);
  };

  const openWordPopup = useCallback((popup) => {
    setWordPopupOpenCount(prev => prev + 1);
    setWordPopup({
      ...popup,
      _openKey: Date.now() + Math.random(),
    });
  }, []);

  // Capture the immutable reset point once the initial project has loaded.
  useEffect(() => {
    if (!videoUrl || !captions.length) return;
    if (initialEditorStateRef.current) return;

    initialEditorStateRef.current = snapshotEditorState();
  }, [captionStyle, captions.length, snapshotEditorState, videoUrl]);

  // Auto-Center: when the font changes (or 'None' is selected), load the new font and
  // trigger a style refresh so the preview re-measures word bounding boxes with the
  // correct font metrics.  This also ensures Indic ↔ Latin switches re-anchor correctly.
  useEffect(() => {
    const fontFamily = captionStyle?.font_family;
    if (!fontFamily) return;
    loadGoogleFont(fontFamily, [300, 400, 500, 600, 700, 800]).catch(() => {});
  }, [captionStyle?.font_family]);

  const navigate = useNavigate();

  const [pricingMessage, setPricingMessage] = useState('');

  const handleExportClick = () => {
    // Always open the Export Panel — auth/credit checks are handled inside
    setExportPanelMounted(true);
    setIsExportPanelOpen(true);
  };

  const renderEditorPanel = () => {
    if (activeTab === 'captions') {
      return (
        <Suspense fallback={<PanelLoadingFallback label="Loading captions" />}>
          <CaptionEditor
            captions={captions}
            setCaptions={updateCaptions}
            selectedCaptionId={selectedCaptionId}
            setSelectedCaptionId={setSelectedCaptionId}
            onSeek={handleSeek}
            onPlayCaption={handlePlayCaption}
            onOpenWordPopup={(caption, wordIndex, position, word) => openWordPopup({ caption, wordIndex, position, word })}
            wordPopup={wordPopup}
            user={currentUser}
          />
        </Suspense>
      );
    }

    if (activeTab === 'text') {
      return (
        <Suspense fallback={<PanelLoadingFallback label="Loading text tools" />}>
          <TextTab
            captions={captions}
            setCaptions={updateCaptions}
            currentTime={currentTime}
            setSelectedCaptionId={setSelectedCaptionId}
            captionStyle={captionStyle}
          />
        </Suspense>
      );
    }

    if (activeTab === 'templates') {
      return (
        <Suspense fallback={<PanelLoadingFallback label="Loading templates" />}>
          <SidebarTemplateGallery20
            currentStyle={captionStyle}
            onApplyTemplate={handleApplyTemplate}
            onBack={() => setActiveTab('captions')}
          />
        </Suspense>
      );
    }

    if (activeTab === 'animate') {
      return (
        <Suspense fallback={<PanelLoadingFallback label="Loading animation" />}>
          <AnimateTab
            selectedWord={selectedWordForAnimation}
            selectedCaption={
              captions.find(c => c.id === selectedCaptionId) ||
              captions.find(c => currentTime >= c.start_time && currentTime <= c.end_time)
            }
            captions={captions}
            setCaptions={updateCaptions}
          />
        </Suspense>
      );
    }

    if (activeTab === 'history') {
      return (
        <Suspense fallback={<PanelLoadingFallback label="Loading history" />}>
          <HistoryTab user={currentUser} userData={userData} />
        </Suspense>
      );
    }

    if (activeTab === 'layers') {
      return (
        <Suspense fallback={<PanelLoadingFallback label="Loading layers" />}>
          <LayersTab
            captions={captions}
            selectedCaptionId={selectedCaptionId}
            setSelectedCaptionId={setSelectedCaptionId}
            onSeek={handleSeek}
            captionStyle={captionStyle}
            setCaptionStyle={updateCaptionStyle}
            addToHistory={addToHistory}
          />
        </Suspense>
      );
    }

    return null;
  };

  const renderStylePanel = () => (
    <Suspense fallback={<PanelLoadingFallback label="Loading style tools" />}>
      <StyleControls
        captionStyle={captionStyle}
        setCaptionStyle={updateCaptionStyle}
        setCaptionStyleRaw={setCaptionStyle}
        addToHistory={addToHistory}
        selectedCaption={captions.find(c => c.id === selectedCaptionId)}
        captions={captions}
        setCaptions={updateCaptions}
        setCaptionsRaw={setCaptions}
        onApplyTemplate={handleApplyTemplate}
      />
    </Suspense>
  );

  const renderTimelinePanel = () => (
    <Suspense fallback={<PanelLoadingFallback label="Loading timeline" />}>
      <CaptionTimeline
        captions={captions}
        duration={duration}
        currentTime={currentTime}
        selectedCaptionId={selectedCaptionId}
        onSelectCaption={setSelectedCaptionId}
        onSeek={handleSeek}
        setCaptions={updateCaptions}
        setCaptionsRaw={setCaptions}
        addToHistory={addToHistory}
        waveformData={waveformData}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        collapsed={isTimelineCollapsed}
        onToggleCollapsed={() => {
          setIsTimelineCollapsed(prev => {
            const next = !prev;
            setTimelineHeight(next ? 42 : 204);
            return next;
          });
        }}
      />
    </Suspense>
  );

  const generationElapsedSeconds = generationStartedAt
    ? Math.max(0, Math.floor(((generationTicker || Date.now()) - generationStartedAt) / 1000))
    : 0;
  const renderGeneratingState = () => {
    const step2Ready = generationElapsedSeconds >= 3;
    const step3Ready = generationElapsedSeconds >= 6;
    const step4Ready = generationElapsedSeconds >= 9;
    const progressSteps = [
      { label: 'Transcribing your audio', status: step2Ready ? 'complete' : 'active' },
      { label: 'Syncing word-level timing', status: step3Ready ? 'complete' : step2Ready ? 'active' : 'upcoming' },
      { label: 'Highlighting key moments', status: step4Ready ? 'complete' : step3Ready ? 'active' : 'upcoming' },
      { label: 'Rendering your preview', status: step4Ready ? 'active' : 'upcoming' },
    ];
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#050505] p-5">
        <div className="absolute inset-x-0 top-0 h-px bg-white/[0.06]" />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-[560px]"
        >
          <div className="px-5 py-4 sm:px-7">
            <div className="flex items-center justify-between gap-3 text-zinc-400">
              <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase text-[#ffd7a4]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f6a54b] shadow-[0_0_14px_rgba(246,165,75,0.9)]" />
                Processing
              </div>
            </div>
          </div>

          <div className="px-5 py-6 sm:px-7 sm:py-8">
            <div className="flex items-start gap-4">
              <div className="relative mt-1 flex h-[52px] w-[52px] shrink-0 items-center justify-center">
                <motion.span
                  animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full border border-[#f6a54b]/25"
                />
                <Sparkles className="relative h-6 w-6 text-[#f6a54b]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[30px] font-semibold leading-[1.12] text-white sm:text-[36px]">
                  Crafting your captions
                </h2>
                <p className="mt-3 max-w-[410px] text-sm leading-6 text-zinc-400">
                  Lekha is transcribing your audio, syncing each word to the timeline, and styling your first preview.
                </p>
              </div>
            </div>

            <div className="mt-7 px-1">
              <p className="text-xs font-medium text-zinc-400">
                Step {Math.min(completedSteps + 1, progressSteps.length)} of {progressSteps.length}
              </p>
            </div>

            <div className="mt-6 px-1">
              <div className="space-y-3">
                {progressSteps.map((step, index) => {
                  const isComplete = step.status === 'complete';
                  const isActive = step.status === 'active';

                  return (
                    <motion.div
                      key={step.label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="grid grid-cols-[30px_1fr] gap-3"
                    >
                      <div className="relative flex justify-center">
                        {index < progressSteps.length - 1 && (
                          <span className={`absolute top-8 h-[calc(100%+12px)] w-px ${
                            isComplete ? 'bg-[#f6a54b]/55' : 'bg-white/[0.12]'
                          }`} />
                        )}
                        <span className={`relative flex h-7 w-7 items-center justify-center rounded-full border ${
                          isComplete
                            ? 'border-[#f6a54b]/70 text-[#ffd7a4]'
                            : isActive
                              ? 'border-[#f6a54b]/70 text-[#ffd7a4]'
                              : 'border-white/[0.16] text-zinc-500'
                        }`}>
                          {isComplete ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          ) : isActive ? (
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          )}
                        </span>
                      </div>
                      <div className="pb-2">
                        <p className={`text-sm font-medium ${
                          isActive || isComplete ? 'text-white' : 'text-zinc-500'
                        }`}>
                          {step.label}
                        </p>
                        <p className={`mt-1 text-[11px] uppercase ${
                          isComplete
                            ? 'text-[#ffd7a4]'
                            : isActive
                              ? 'text-[#ffd7a4]'
                              : 'text-zinc-600'
                        }`}>
                          {isComplete ? 'Complete' : isActive ? 'Now processing' : 'Next'}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  const mobileTabs = [
    { id: 'captions', label: 'Captions', icon: Captions },
    { id: 'style', label: 'Style', icon: SlidersHorizontal },
    { id: 'templates', label: 'Templates', icon: Layout },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'animate', label: 'Animate', icon: Sparkles },
    { id: 'layers', label: 'Layers', icon: Layers },
    { id: 'timeline', label: 'Timeline', icon: Clock3 },
  ];
  const subscriptionBaseTier = String(userData?.subscription_tier || '')
    .replace(/_yearly$/, '');
  const lowCreditTopUpOffer = TOP_UP_OFFERS[subscriptionBaseTier] || null;

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-[#050505] flex flex-col overflow-hidden text-white">
      <DashboardHeader
        onUploadClick={() => setIsUploadModalOpen(true)}
        onExportClick={handleExportClick}
        onSaveClick={handleSave}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        hasVideo={!!videoUrl}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex >= 0}
        canRedo={redoStack.length > 0}
        onRefresh={handleRefresh}
        user={currentUser}
        userData={userData}
        onLogin={() => navigate('/login')}
        onUpgradeClick={() => setIsPricingModalOpen(true)}
      />

      {/* Main content */}
      <div className="flex-1 overflow-hidden lekha-editor-shell">
        {isGenerating ? (
          renderGeneratingState()
        ) : !videoUrl ? (
          <div className="h-full flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md"
            >
              <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-6">
                <Upload className="w-8 h-8 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Start Creating Captions
              </h2>
              <p className="text-gray-500 mb-6">
                Upload your short-form video (best for 15-180 seconds) and we'll generate professional captions instantly.
              </p>
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                size="lg"
                className="bg-white hover:bg-gray-100 text-black font-semibold px-8 rounded-[4px]"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Video
              </Button>
            </motion.div>
          </div>
        ) : (
          // Editor layout
          <div className="h-full flex flex-col overflow-hidden">
            {/* Low-credits top-up banner */}
            {lowCreditTopUpOffer &&
              (userData.credits_remaining ?? 999) <= 5 && (
              <div className="px-4 pt-2 shrink-0">
                <div className="flex items-center justify-between gap-3 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5">
                  <p className="text-sm text-white font-medium">
                    Low credits? Add {lowCreditTopUpOffer.credits} credits for {lowCreditTopUpOffer.price} - no plan change needed.
                  </p>
                  <button
                    onClick={() => setIsPricingModalOpen(true)}
                    className="shrink-0 text-xs font-semibold bg-white text-black px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    Top Up
                  </button>
                </div>
              </div>
            )}
          <div className={`flex-1 overflow-hidden ${isVideoFullscreen ? 'relative p-0' : 'flex flex-col md:grid md:grid-cols-[minmax(0,1fr)] lg:grid-cols-[48px_285px_minmax(0,1fr)_285px] xl:grid-cols-[48px_300px_minmax(0,1fr)_300px] p-2 md:p-3 gap-2 md:gap-3'}`}>
            {!isVideoFullscreen && (
              <>
                {/* Vertical Sidebar Navigation */}
                <div className="hidden lg:block min-h-0">
                <SidebarNav
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  onOpenPricing={(action) => {
                    if (action === 'logout') {
                      // Handled by AuthContext logout 
                    } else {
                      setIsPricingModalOpen(true)
                    }
                  }}
                />
                </div>

                {/* Left Panel - Content based on active tab */}
                <div className="hidden lg:block w-full rounded-[18px] lekha-panel lekha-panel-corners p-3 overflow-hidden min-h-0">
                  {renderEditorPanel()}
                </div>
              </>
            )}

            {/* Center Panel - Video Player & Timeline */}
            <div className={`${isVideoFullscreen ? 'absolute inset-0 z-30 bg-[#050505] px-6 py-5' : 'flex-1 px-1 py-2 md:py-3'} flex flex-col overflow-hidden min-h-0`} style={{ position: isVideoFullscreen ? 'absolute' : 'relative', zIndex: 50 }}>
              {!isVideoFullscreen && (
              <div className="relative z-10 shrink-0 flex items-center justify-between px-1 pb-2">
                <div className="flex items-center gap-3">
                  <span className="lekha-micro-label">Preview <span className="text-white">9:16</span></span>
                  <span className="lekha-micro-label">FPS <span className="text-white">24</span></span>
                  <span className="lekha-micro-label">Safe <span className="text-sky-200">On</span></span>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="lekha-glass-chip rounded-md px-3 py-1 text-[10px] font-black text-white">100%</span>
                  <span className="lekha-glass-chip rounded-md px-3 py-1 text-[10px] font-black text-white">FIT</span>
                </div>
              </div>
              )}

              <div
                className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ paddingBottom: isVideoFullscreen || isTimelineCollapsed ? 0 : `${Math.max(72, timelineHeight - 24)}px` }}
              >
                <div className="transition-transform duration-200">
                  <Suspense fallback={<VideoLoadingFallback />}>
                    <VideoPlayer
                      videoUrl={videoUrl}
                      currentTime={currentTime}
                      setCurrentTime={setCurrentTime}
                      seekSignal={seekSignal}
                      isPlaying={isPlaying}
                      setIsPlaying={setIsPlaying}
                      captions={captions}
                      waveformData={waveformData}
                      setCaptions={updateCaptions}
                      setCaptionsRaw={setCaptions}
                      captionStyle={captionStyle}
                      setCaptionStyle={updateCaptionStyle}
                      setCaptionStyleRaw={setCaptionStyle}
                      addToHistory={addToHistory}
                      duration={duration}
                      setDuration={setDuration}
                      selectedCaptionId={selectedCaptionId}
                      setSelectedCaptionId={setSelectedCaptionId}
                      wordPopup={wordPopup}
                      setWordPopup={openWordPopup}
                      onVideoLoaded={async (videoEl) => {
                        if (videoEl && !waveformData) {
                          const data = await extractWaveformData(videoEl, 400);
                          if (data) setWaveformData(data);
                        }
                      }}
                      onVideoError={refreshVideoPlaybackUrl}
                      isVideoFullscreen={isVideoFullscreen}
                      setIsVideoFullscreen={setIsVideoFullscreen}
                    />
                  </Suspense>
                </div>
              </div>

              {/* Resizable Divider Bar (Premiere Pro style) */}
              {!isVideoFullscreen && !isTimelineCollapsed && (
                <div
                  ref={timelineDividerRef}
                  className="absolute left-0 right-0 z-[80] hidden h-1.5 cursor-ns-resize items-center justify-center group lg:flex"
                  style={{ bottom: `${timelineHeight + 28}px` }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    isDraggingDivider.current = true;
                    dividerStartY.current = e.clientY;
                    dividerStartHeight.current = timelineHeight;
                    const SNAPS = [defaultTimelineHeight.current, SNAP_BALANCED, SNAP_MAX_TIMELINE];
                    const onMove = (ev) => {
                      if (!isDraggingDivider.current) return;
                      // delta > 0 = dragging up = growing timeline
                      const delta = dividerStartY.current - ev.clientY;
                      const floor = defaultTimelineHeight.current;
                      let raw = Math.max(floor, Math.min(400, dividerStartHeight.current + delta));
                      // Check snap proximity
                      let snapped = false;
                      for (const s of SNAPS) {
                        if (Math.abs(raw - s) <= SNAP_THRESHOLD) {
                          raw = s;
                          snapped = true;
                          break;
                        }
                      }
                      setDividerSnapping(snapped);
                      setTimelineHeight(raw);
                    };
                    const onUp = () => {
                      isDraggingDivider.current = false;
                      setDividerSnapping(false);
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  }}
                  onDoubleClick={() => {
                    setIsTimelineCollapsed(true);
                    setTimelineHeight(42);
                  }}
                >
                  {/* Divider line */}
                  <div className={`w-full h-px transition-colors ${dividerSnapping ? 'bg-yellow-400/60' : 'bg-white/5 group-hover:bg-white/15'}`} />
                  {/* Drag handle indicator */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-8 h-1 rounded-full transition-colors ${dividerSnapping ? 'bg-yellow-400/80' : 'bg-white/10 group-hover:bg-white/25'}`} />
                  </div>
                </div>
              )}
              {!isVideoFullscreen && (
                <div
                  className="hidden lg:block"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: '20px',
                    height: '42px',
                    zIndex: 70,
                    pointerEvents: 'none'
                  }}
                >
                  <div
                    style={{
                      position: isTimelineCollapsed ? 'relative' : 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: `${isTimelineCollapsed ? 42 : timelineHeight}px`,
                      zIndex: 70,
                      pointerEvents: 'auto'
                    }}
                  >
                  {renderTimelinePanel()}
                  </div>
                </div>
              )}
            </div>

            {!isVideoFullscreen && (
              <div className="hidden lg:block w-full overflow-hidden min-h-0">
                {renderStylePanel()}
              </div>
            )}

            {!isVideoFullscreen && (
              <MobileDashboardDock
                activeTab={activeTab}
                tabs={mobileTabs}
                setActiveTab={setActiveTab}
                renderEditorPanel={renderEditorPanel}
                renderStylePanel={renderStylePanel}
                renderTimelinePanel={renderTimelinePanel}
              />
            )}
          </div>
          </div>
        )}
      </div>

      {/* Word Click Popup: fixed at Dashboard root, above EVERYTHING including navbar */}
      {wordPopup && (
        <>
          <div
            className="pointer-events-none fixed inset-0 z-[9998]"
            onClick={() => setWordPopup(null)}
          />
          <Suspense fallback={null}>
            <WordClickPopup
              key={wordPopup._openKey ?? wordPopupOpenCount}
              word={wordPopup.word}
              position={wordPopup.position}
              onStyleChange={handleWordStyleChange}
              currentStyle={(() => {
                const c = captions.find(cap =>
                  wordPopup.type === 'element'
                    ? cap.id === wordPopup.elementId
                    : cap.id === wordPopup.caption?.id
                );
                const key = wordPopup.type === 'element'
                  ? `${wordPopup.elementId}-${wordPopup.wordIndex}`
                  : `${wordPopup.caption?.id}-${wordPopup.wordIndex}`;
                return c?.wordStyles?.[key] || {};
              })()}
              onEdit={() => setWordPopup(null)}
              onClose={() => setWordPopup(null)}
              onResetPosition={() => {
                if (addToHistory) addToHistory();
                const key = wordPopup.type === 'element'
                  ? `${wordPopup.elementId}-${wordPopup.wordIndex}`
                  : `${wordPopup.caption?.id}-${wordPopup.wordIndex}`;
                setCaptions(prev => prev.map(c => {
                  const id = wordPopup.type === 'element' ? wordPopup.elementId : wordPopup.caption?.id;
                  if (c.id !== id) return c;
                  const ws = c.wordStyles || {};
                  return {
                    ...c,
                    wordStyles: {
                      ...ws,
                      [key]: {
                        ...(ws[key] || {}),
                        x: 0,
                        y: 0,
                        x_pct: 0,
                        y_pct: 0,
                        abs_x_pct: 0,
                        abs_y_pct: 0,
                      }
                    }
                  };
                }));
              }}
              onResetFontSize={handleResetWordFontSize}
              onHistoryRecord={addToHistory}
            />
          </Suspense>
        </>
      )}

      {/* Modals */}
      {isUploadModalOpen && (
        <Suspense fallback={null}>
          <UploadModal
            open={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUpload={handleUpload}
            isUploading={isUploading}
          />
        </Suspense>
      )}

      {exportPanelMounted && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <ExportPanel
              open={isExportPanelOpen}
              onClose={() => setIsExportPanelOpen(false)}
              captions={captions}
              captionStyle={captionStyle}
              waveformData={waveformData}
              duration={duration}
              videoUrl={videoUrl}
              projectId={projectId}
              fileId={fileId}
              originalFileName={originalFileName}
              onUpgradeClick={() => { setIsExportPanelOpen(false); setIsPricingModalOpen(true); }}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {isPricingModalOpen && (
        <Suspense fallback={null}>
          <PricingModal
            isOpen={isPricingModalOpen}
            onClose={() => { setIsPricingModalOpen(false); setPricingMessage(''); }}
            onSelectPlan={handleSelectPlan}
            user={currentUser}
            message={pricingMessage}
            userData={userData}
          />
        </Suspense>
      )}

      {/* Plan Expired Modal */}
      {isPlanExpiredModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-md mx-4 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Your Plan Has Expired</h2>
            <p className="text-gray-400 mb-6">
              You've used all your credits this month. Upgrade your plan to continue creating amazing captions!
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsPlanExpiredModalOpen(false)}
                className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                Maybe Later
              </Button>
              <Button
                onClick={() => {
                  setIsPlanExpiredModalOpen(false);
                  setIsPricingModalOpen(true);
                }}
                className="flex-1 bg-gradient-to-r from-[#F5A623] to-blue-600 hover:from-[#F5A623] hover:to-blue-700 text-white"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade Now
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom scrollbar styles */}
      <style>{`
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`}</style>
    </div>
  );
}
