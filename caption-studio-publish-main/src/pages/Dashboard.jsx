import React, { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sparkles, Captions, Clock3, Layers, Layout, SlidersHorizontal, Type } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/lib/AuthContext';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import SidebarNav from '@/components/dashboard/SidebarNav';
import MobileDashboardDock from '@/components/dashboard/MobileDashboardDock';
import EditorNotices from '@/components/dashboard/EditorNotices';
import EditorStatusBanners from '@/components/dashboard/EditorStatusBanners';
import EditorEmptyState from '@/components/dashboard/EditorEmptyState';
import GeneratingCaptionsScreen from '@/components/dashboard/GeneratingCaptionsScreen';
import TimelineResizeHandle from '@/components/dashboard/TimelineResizeHandle';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { extractWaveformData } from '@/components/dashboard/audioUtils';
import { autoLoadFontForText, loadGoogleFont } from '@/components/dashboard/fontUtils';
import { recordRecentTemplate } from '@/components/dashboard/templateBrowserUtils';
import { apiRequest } from '@/lib/apiClient';
import { notifyApiError } from '@/lib/notifyApiError';
import { toast } from '@/components/ui/use-toast';
import { getClientContext, trackAnalytics } from '@/lib/analytics';
import { getEffectiveAuthToken } from '@/lib/devAuth';
import { resolveApiResourceUrl } from '@/components/dashboard/exportPipelineUtils';
import { lazyWithRefresh } from '@/lib/lazyWithRefresh';
import { isRetryableUploadError, uploadFileWithRecovery } from '@/lib/resilientUpload';
import { processVideoWithRecovery } from '@/lib/resilientProcess';
import { useEditorPreferences } from '@/hooks/useEditorPreferences'
import { useEditorDocument } from '@/hooks/useEditorDocument'
import { useEditorHistory } from '@/hooks/useEditorHistory'
import { useDraftPersistence } from '@/hooks/useDraftPersistence'
import { DESKTOP_EDITOR_QUERY, useMediaQuery } from '@/hooks/useMediaQuery'
import {
  defaultCaptionStyle,
  getLanguageDisplayName,
  getLanguageIdentity,
  restoreEditorDocument,
} from '@/lib/editorDocument'
import { downloadDraft } from '@/lib/localDraftStorage'
import { buildTemplateApplication, getTemplateRecentEntry } from '@/lib/templateApplication'
import {
  applyWordStyleChange,
  getPopupWordStyle,
  getPopupWordText,
  resetWordFontSize,
  resetWordPosition,
  updatePopupWordStyle,
  wordPopupStyleKey,
  wordPopupTargetId,
} from '@/lib/wordStyleEdits'
import {
  applyTranslation,
  buildCaptionTracks,
  captionsFromTranscript,
  mergeCaptionPairs,
  parseWordsPerLine,
  upsertTranslationTrack,
} from '@/lib/transcriptTracks'
import planCatalog from '../../shared/planCatalog.json';

// Dashboard panels are independently code-split. Recover an outdated browser
// shell once when a deployment replaces their content-hashed files; otherwise
// the right-side Styling/Templates panel can fail to mount after a release.
const VideoPlayer = lazyWithRefresh(() => import('@/components/dashboard/VideoPlayer'), 'VideoPlayer');
const CaptionTimeline = lazyWithRefresh(() => import('@/components/dashboard/CaptionTimeline'), 'CaptionTimeline');
const CaptionEditor = lazyWithRefresh(() => import('@/components/dashboard/CaptionEditor'), 'CaptionEditor');
const StyleControls = lazyWithRefresh(() => import('@/components/dashboard/StyleControls'), 'StyleControls');
const TextTab = lazyWithRefresh(() => import('@/components/dashboard/TextTab'), 'TextTab');
const AnimateTab = lazyWithRefresh(() => import('@/components/dashboard/AnimateTab'), 'AnimateTab');
const HistoryTab = lazyWithRefresh(() => import('@/components/dashboard/HistoryTab'), 'HistoryTab');
const LayersTab = lazyWithRefresh(() => import('@/components/dashboard/LayersTab'), 'LayersTab');
const UploadModal = lazyWithRefresh(() => import('@/components/dashboard/UploadModal'), 'UploadModal');
const ExportPanel = lazyWithRefresh(() => import('@/components/dashboard/ExportPanel'), 'ExportPanel');
const PricingModal = lazyWithRefresh(() => import('@/components/dashboard/PricingModal'), 'PricingModal');
const SidebarTemplateGallery20 = lazyWithRefresh(() => import('@/components/dashboard/SidebarTemplateGallery20'), 'SidebarTemplateGallery20');
const WordClickPopup = lazyWithRefresh(() => import('@/components/dashboard/WordClickPopup'), 'WordClickPopup');

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

const GENERATING_SCREEN_MIN_MS = 10000;
// Spoken languages Sarvam transcribes; mirrors sarvam_langs in backend/processor.py.
// Anything else is sent as "auto" and the server picks the provider.
const SARVAM_SPOKEN_LANGUAGES = new Set([
  'hindi', 'bengali', 'kannada', 'malayalam', 'marathi', 'odia',
  'punjabi', 'tamil', 'telugu', 'gujarati', 'assamese',
]);
const COLLAPSED_TIMELINE_HEIGHT = 42;
const EXPANDED_TIMELINE_HEIGHT = 204;

const formatTopUpPrice = (paise) => `Rs ${Math.round(Number(paise || 0) / 100)}`;

const TOP_UP_OFFERS = {
  starter: {
    credits: planCatalog.topup_starter.credits,
    price: formatTopUpPrice(planCatalog.topup_starter.inr_paise),
  },
  creator: {
    credits: planCatalog.topup_creator.credits,
    price: formatTopUpPrice(planCatalog.topup_creator.inr_paise),
  },
  pro: {
    credits: planCatalog.topup_pro.credits,
    price: formatTopUpPrice(planCatalog.topup_pro.inr_paise),
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Dashboard() {
  const { currentUser, userData, isLoadingAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [pricingMessage, setPricingMessage] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleUploadModalOpen = () => {
    if (!currentUser) {
      navigate(`/login?mode=signup&returnTo=${encodeURIComponent('/Dashboard?entry=editor')}`);
      return;
    }
    setIsUploadModalOpen(true);
  };
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  // Once opened, ExportPanel stays mounted (hidden) so an in-flight export keeps
  // its progress state when the sheet is closed and reopened. Unmounting it
  // mid-export orphaned the running export and let users start a duplicate one.
  const [exportPanelMounted, setExportPanelMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState(null);
  const [generationTicker, setGenerationTicker] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const editorDocument = useEditorDocument();
  const {
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
  } = editorDocument;

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // External video sync signal
  const [seekSignal, setSeekSignal] = useState(null);

  // Lock body scroll while dashboard is mounted (prevents shrink when navigating back from UserAccount)
  React.useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Video canvas fullscreen & resizable timeline
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const exitFullscreenForWordEditor = useCallback(() => setIsVideoFullscreen(false), []);
  const [timelineHeight, setTimelineHeight] = useState(COLLAPSED_TIMELINE_HEIGHT);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(true);
  const collapseTimeline = () => {
    setIsTimelineCollapsed(true);
    setTimelineHeight(COLLAPSED_TIMELINE_HEIGHT);
  };

  const [selectedCaptionId, setSelectedCaptionId] = useState(null);
  const {
    brandKits,
    setBrandKits,
    syncStatus: editorPreferenceSyncStatus,
    reloadCloudPreferences, retryPreferenceSync,
  } = useEditorPreferences(currentUser)

  const [isLoaded, setIsLoaded] = useState(false);

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
  }, [setCaptions, setDuration, setFileId, setVideoUrl]);

  const { pushHistory, undo: handleUndo, redo: handleRedo, resetHistory, canUndo, canRedo } = useEditorHistory({
    captions,
    captionStyle,
    setCaptions,
    setCaptionStyle,
  });

  // Active tab for sidebar navigation
  const [activeTab, setActiveTab] = useState('captions');
  // Desktop shows the side panels; phones and tablets get the bottom dock.
  // Mount only one of them so panels are not rendered twice (once hidden).
  const isDesktopLayout = useMediaQuery(DESKTOP_EDITOR_QUERY);
  // Style and Timeline are dock-only tabs; the desktop side panel has no view
  // for them, so rotating a tablet to landscape returns to Captions.
  useEffect(() => {
    if (isDesktopLayout && (activeTab === 'style' || activeTab === 'timeline')) setActiveTab('captions');
  }, [activeTab, isDesktopLayout]);
  // Mobile dock: whether the active tool's sheet is open. Closed by default
  // so phones open on a large preview.
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // Floating Word Popup state
  const [wordPopup, setWordPopup] = useState(null);
  const [wordPopupOpenCount, setWordPopupOpenCount] = useState(0);

  // A word remains the current animation target while its floating editor is
  // open, including after it has been dragged to a custom canvas position.
  const selectedWordForAnimation = useMemo(() => (wordPopup ? {
    type: wordPopup.type,
    captionId: wordPopupTargetId(wordPopup),
    wordIndex: wordPopup.wordIndex,
    word: wordPopup.word,
  } : null), [wordPopup]);

  // Waveform data for timeline
  const [waveformData, setWaveformData] = useState(null);
  const mediaRefreshInFlightRef = useRef(false);
  const lastMediaRefreshRef = useRef({ fileId: null, at: 0, reported: false });
  // The preview <video>, for the mobile dock's live scrubbing.
  const previewVideoElRef = useRef(null);
  const [showCaptionRetryNotice, setShowCaptionRetryNotice] = useState(false)
  const [showLowCreditNotice, setShowLowCreditNotice] = useState(false)
  const [translationNotice, setTranslationNotice] = useState('')
  const [sourceUnavailable, setSourceUnavailable] = useState(false)
  // While the person still has the file they just uploaded, play it from
  // their device: instant, and no storage download. The storage link stays
  // in videoUrl for saving, reloads and other devices.
  const [localPlayback, setLocalPlayback] = useState(null)
  const localPlaybackRef = useRef(null)
  const replaceLocalPlayback = useCallback((file, forFileId) => {
    const previous = localPlaybackRef.current
    const canCreate = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    const next = file && forFileId && canCreate ? { url: URL.createObjectURL(file), fileId: forFileId } : null
    localPlaybackRef.current = next
    setLocalPlayback(next)
    if (previous?.url) URL.revokeObjectURL(previous.url)
  }, [])
  useEffect(() => () => {
    if (localPlaybackRef.current?.url) URL.revokeObjectURL(localPlaybackRef.current.url)
  }, [])
  const [isRelinking, setIsRelinking] = useState(false)

  // Editor UI owned here is cleared whenever the document is emptied for a new
  // session or account, so no selection, playback or undo history leaks across.
  const resetEditorUi = useCallback(() => {
    setWordPopup(null)
    setSelectedCaptionId(null)
    setCurrentTime(0)
    setIsUploadModalOpen(false)
    resetHistory()
  }, [resetHistory])

  const {
    cloudReady,
    cloudDraft,
    cloudSaveMessage,
    setCloudSaveMessage,
    setCloudSaveConflict,
    showCloudSaveConflictNotice,
    localRecoveryDraft,
    applyLocalDraft,
    continueAccountDraft,
    discardLocalDraft,
    saveNow,
  } = useDraftPersistence({
    currentUser,
    isLoadingAuth,
    restoreRequested: location.state?.restoreSession,
    doc: editorDocument,
    isLoaded,
    setIsLoaded,
    setSourceUnavailable,
    onEditorReset: resetEditorUi,
    pauseAutosave: isGenerating && captions.length === 0,
  })

  useEffect(() => {
    // A source file is stored before its asynchronous transcription finishes.
    // Do not present that normal in-progress state as a failed transcription.
    // Once generation has ended without captions, retain the useful retry
    // action without asking the customer to upload the same video again.
    if (fileId && captions.length === 0 && !isGenerating) setShowCaptionRetryNotice(true)
    else setShowCaptionRetryNotice(false)
  }, [fileId, captions.length, isGenerating])

  useEffect(() => {
    if (!showCaptionRetryNotice) return undefined
    const timer = window.setTimeout(() => setShowCaptionRetryNotice(false), 10000)
    return () => window.clearTimeout(timer)
  }, [showCaptionRetryNotice])

  const selectCaptionTrack = useCallback((trackId) => {
    const track = captionTracks.find((item) => item.id === trackId)
    if (!track) return
    setActiveCaptionTrackId(track.id)
    setCaptions(JSON.parse(JSON.stringify(track.captions || [])))
    setSelectedCaptionId(null)
    setWordPopup(null)
    resetHistory()
  }, [captionTracks, resetHistory, setActiveCaptionTrackId, setCaptions])

  // Translate after upload: always from the original transcript (never a
  // translation of a translation) into its own language track.
  const [isTranslatingCaptions, setIsTranslatingCaptions] = useState(false)
  const handleTranslateCaptions = async (targetLanguage, targetLabel) => {
    if (!targetLanguage || isTranslatingCaptions) return
    if (!currentUser) {
      navigate(`/login?mode=signup&returnTo=${encodeURIComponent('/Dashboard?entry=editor')}`)
      return
    }
    const sourceTrack = captionTracks.find((track) => track.id === 'source')
    if (sourceTrack && getLanguageIdentity(sourceTrack.language) === getLanguageIdentity(targetLanguage)) {
      selectCaptionTrack('source')
      return
    }
    const sourceCaptions = activeCaptionTrackId === 'source' || !sourceTrack ? captions : sourceTrack.captions
    const transcriptLines = (sourceCaptions || [])
      .filter((caption) => caption && !caption.isTextElement)
      .map((caption) => ({ id: caption.id, text: caption.text || '' }))
    if (transcriptLines.length === 0) {
      toast({ title: 'Nothing to translate', description: 'Add or generate captions first.' })
      return
    }
    if (transcriptLines.length > 500) {
      toast({ title: 'Too many captions', description: 'Translation supports up to 500 captions at a time.', variant: 'destructive' })
      return
    }
    setIsTranslatingCaptions(true)
    setTranslationNotice('')
    try {
      const translateToken = await getEffectiveAuthToken(currentUser)
      const translateData = await apiRequest('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captions: transcriptLines,
          target_language: targetLanguage,
          id_token: translateToken || '',
        }),
        dedupeKey: 'translate-captions',
        cancelPrevious: true,
      })
      if (!translateData.success || !translateData.captions) {
        throw new Error(translateData.error || `Translation to ${targetLabel || targetLanguage} failed`)
      }
      // A draft made before language tracks existed has no source track yet.
      const baseTracks = sourceTrack ? captionTracks : [
        { id: 'source', language: 'Original', label: 'Original', captions: sourceCaptions },
        ...captionTracks,
      ]
      const trackState = upsertTranslationTrack(baseTracks, {
        sourceCaptions,
        translatedItems: translateData.captions,
        targetLanguage,
        label: getLanguageDisplayName(targetLanguage),
      })
      setCaptionTracks(trackState.tracks)
      setActiveCaptionTrackId(trackState.activeTrackId)
      setCaptions(JSON.parse(JSON.stringify(trackState.captions)))
      setSelectedCaptionId(null)
      setWordPopup(null)
      resetHistory()
      trackAnalytics('funnel.translate.success', getClientContext({ stage: 'editor_translate', targetLanguage }))
      toast({ title: 'Captions translated', description: `Switched to ${targetLabel || targetLanguage}. The original stays in Language track.` })
    } catch (error) {
      if (error?.name === 'AbortError') return
      trackAnalytics('funnel.translate.failed', getClientContext({ stage: 'editor_translate', targetLanguage }))
      notifyApiError(error, 'Translation failed')
    } finally {
      setIsTranslatingCaptions(false)
    }
  }

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

  // Close the word popup when its caption or text element is deleted.
  useEffect(() => {
    if (!wordPopup) return;
    const targetId = wordPopupTargetId(wordPopup);
    if (!targetId || !captions.some(c => c.id === targetId)) setWordPopup(null);
  }, [captions, wordPopup]);

  useEffect(() => {
    if (!wordPopup) return;

    const handleOutsideWordEditPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // Dropdowns opened from the popup (the font list) render in a portal
      // outside it; the editor panels and dock act on the selected word.
      if (
        target.closest('.lekha-video-frame')
        || target.closest('[data-caption-editor="true"]')
        || target.closest('[data-caption-editor-nav="true"]')
        || target.closest('[data-selected-word-box="true"]')
        || target.closest('[data-word-popup-panel="true"]')
        || target.closest('[data-radix-popper-content-wrapper]')
        || target.closest('[data-editor-panel="true"]')
        || target.closest('[data-style-panel="true"]')
        || target.closest('[data-mobile-dock="true"]')
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

  // Clicking empty space clears the selection. The Styling panel, the mobile
  // dock (its toolbar and sheets act on the selection) and their dropdown
  // popups edit the selected caption or text box, so clicks there must keep
  // it selected (otherwise the edit lands on the captions instead).
  useEffect(() => {
    const handleGlobalSelectionClear = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (
        target.closest('[data-style-panel="true"]')
        || target.closest('[data-editor-panel="true"]')
        || target.closest('[data-mobile-dock="true"]')
        || target.closest('[data-radix-popper-content-wrapper]')
        || target.closest('[data-caption-layer="true"]')
        || target.closest('[data-caption-editor="true"]')
        || target.closest('[data-caption-editor-nav="true"]')
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

  const handleUpload = async (file, uploadSettingsWithTask, { isRetry = false } = {}) => {
    if (!currentUser) {
      navigate(`/login?mode=signup&returnTo=${encodeURIComponent('/Dashboard?entry=editor')}`);
      return;
    }
    // The upload window may hand over an upload it already started; it is a
    // live object, so it never goes into saved settings.
    const { uploadTask = null, ...uploadSettings } = uploadSettingsWithTask || {};
    setWordPopup(null);
    setIsUploading(true);
    setUploadProgress(uploadTask?.progress || null);
    setIsUploadModalOpen(false);
    setIsGenerating(true);
    setTranslationNotice('');
    // The open project is left untouched until the new upload is accepted, so
    // a refused or failed upload never clears it.
    const generationStart = Date.now();
    setGenerationStartedAt(generationStart);
    const selectedFileName = file?.name || originalFileName || 'video';
    let acceptedUpload = null;
    let acceptedPlayableVideoUrl = '';
    let newProjectId = null;
    let captionsReady = false;

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
        let backgroundOutcome = null;
        if (uploadTask) {
          const unsubscribe = uploadTask.subscribe(setUploadProgress);
          try {
            backgroundOutcome = await uploadTask.promise;
          } finally {
            unsubscribe();
          }
        }
        if (backgroundOutcome?.ok) {
          uploadData = backgroundOutcome.data;
        } else {
          const backgroundError = backgroundOutcome?.error;
          // A refusal (plan limit, quota, file type) will not change on retry.
          if (backgroundError && backgroundError.name !== 'AbortError'
              && Number(backgroundError.status || 0) !== 0 && !isRetryableUploadError(backgroundError)) {
            throw backgroundError;
          }
          // Otherwise upload now; the resume receipt continues any partial upload.
          uploadData = await uploadFileWithRecovery(file, {
            authorization: mediaAuthToken,
            dedupeKey: 'upload-video',
            onProgress: setUploadProgress,
          });
        }
        if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');
        trackAnalytics('funnel.upload.success', getClientContext({ stage: 'upload', fileId: uploadData.file_id || '' }));
      }

      acceptedUpload = uploadData;
      setIsUploading(false);
      // The waiting screen's caption steps count from here, after the upload.
      setGenerationStartedAt(Date.now());
      acceptedPlayableVideoUrl = resolveApiResourceUrl(
        uploadData.raw_url,
        import.meta.env.VITE_API_BASE_URL,
      );
      if (!acceptedPlayableVideoUrl) throw new Error('Upload completed without a playable media URL');

      // Commit the accepted upload before the longer transcription request.
      // If the connection changes or transcription is temporarily unavailable,
      // the editor still opens with the user's video instead of discarding it
      // and returning to Start Creating Captions.
      newProjectId = isRetry ? null : `local_${Date.now()}`;
      // The upload starts a new project here, in one step: keeping the old
      // project ID (or captions) while the new video was attached let autosave
      // overwrite the previous project with the new video.
      if (newProjectId) {
        setProjectId(newProjectId);
        setCaptions([]);
        setCaptionTracks([]);
        setActiveCaptionTrackId('source');
        setDuration(0);
        resetHistory();
        resetPointRef.current = null;
        if (localRecoveryDraft) discardLocalDraft();
      }
      setSettings(uploadSettings);
      setCloudSaveConflict(false);
      // The previous video's waveform and playhead must not carry over.
      setWaveformData(null);
      setCurrentTime(0);
      setSeekSignal(null);
      setSourceUnavailable(false)
      setVideoUrl(acceptedPlayableVideoUrl);
      setFileId(uploadData.file_id);
      setOriginalFileName(selectedFileName);
      if (file) replaceLocalPlayback(file, uploadData.file_id);

      const { minWords, maxWords } = parseWordsPerLine(uploadSettings?.wordsPerLine);
      // A known Indian spoken language goes straight to Sarvam; otherwise the
      // server detects the language itself before choosing a provider.
      const spokenLanguage = String(uploadSettings?.spokenLanguage || '').toLowerCase();
      const processData = await processVideoWithRecovery({
        file_id: uploadData.file_id,
        language: SARVAM_SPOKEN_LANGUAGES.has(spokenLanguage) ? spokenLanguage : 'auto',
        min_words: minWords,
        max_words: maxWords,
        id_token: mediaAuthToken,
      });
      if (!processData.success) throw new Error(processData.error || 'Processing failed');
      trackAnalytics('funnel.process.success', getClientContext({ stage: 'process', language: uploadSettings?.language || 'auto' }));

      let sourceCaptions = captionsFromTranscript(processData.captions);
      if (sourceCaptions.length === 0) {
        throw new Error('No speech with usable word timestamps was detected. Try another video or add captions manually.');
      }

      const targetLang = uploadSettings?.language;
      const detectedLanguage = processData.detected_language || processData.language || 'Original';
      const sourceLanguage = getLanguageDisplayName(detectedLanguage);
      const sameLanguage = getLanguageIdentity(detectedLanguage) === getLanguageIdentity(targetLang);
      let translatedCaptions = null;
      if (targetLang && targetLang !== 'auto' && !sameLanguage) {
        try {
          const translateToken = await getEffectiveAuthToken(currentUser);
          const translateData = await apiRequest('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              captions: sourceCaptions.filter(c => !c.isTextElement),
              target_language: targetLang,
              id_token: translateToken || '',
            }),
            dedupeKey: 'translate-captions',
            cancelPrevious: true,
          });
          if (!translateData.success || !translateData.captions) {
            throw new Error(translateData.error || `Translation to ${targetLang} failed`);
          }
          trackAnalytics('funnel.translate.success', getClientContext({ stage: 'translate', targetLanguage: targetLang }));
          translatedCaptions = applyTranslation(sourceCaptions, translateData.captions);
        } catch (translateErr) {
          trackAnalytics('funnel.translate.failed', getClientContext({ stage: 'translate', targetLanguage: targetLang }));
          console.warn(`Translation to ${targetLang} failed; keeping the original language track.`, translateErr);
          setTranslationNotice(`Original captions are ready. Translation to ${targetLang} failed; retry with Translate in the Captions tab.`);
        }
      }

      if (uploadSettings?.style === 'double_line' && sourceCaptions.length > 1) {
        const sharedIdPrefix = `${Date.now()}-merged`;
        sourceCaptions = mergeCaptionPairs(sourceCaptions, sharedIdPrefix);
        if (translatedCaptions) translatedCaptions = mergeCaptionPairs(translatedCaptions, sharedIdPrefix);
      }

      const trackState = buildCaptionTracks({
        sourceCaptions,
        sourceLanguage,
        translatedCaptions,
        targetLanguage: targetLang,
      });
      setCaptions(trackState.captions);
      setCaptionTracks(trackState.tracks);
      setActiveCaptionTrackId(trackState.activeTrackId);

      let nextCaptionStyle = {
        ...defaultCaptionStyle,
        wordsPerLine: uploadSettings?.wordsPerLine || 'dynamic'
      };
      const sampleText = trackState.captions.map(c => c.text).join(' ');
      const { fontFamily, script, fontOptions } = await autoLoadFontForText(sampleText);
      nextCaptionStyle = {
        ...nextCaptionStyle,
        font_family: fontFamily,
        detected_script: script,
        available_fonts: fontOptions?.map(f => f.name) || [],
      };
      setCaptionStyle(nextCaptionStyle);
      captionsReady = true;

      const nextProjectId = newProjectId || projectId || `local_${Date.now()}`;
      setProjectId(nextProjectId);
      resetPointRef.current = restoreEditorDocument({
        videoUrl: acceptedPlayableVideoUrl,
        captions: trackState.captions,
        captionTracks: trackState.tracks,
        activeCaptionTrackId: trackState.activeTrackId,
        captionStyle: nextCaptionStyle,
        duration: 0,
        fileId: uploadData.file_id,
        originalFileName: selectedFileName,
        projectId: nextProjectId,
        settings: uploadSettings,
      });

      // The waveform is built by the editor's onVideoLoaded once this screen
      // closes (from the local file when there is one), so decoding the whole
      // file never keeps the finished captions waiting.

    } catch (error) {
      console.error('Upload failed:', error);
      const uploadWasAccepted = Boolean(acceptedUpload?.file_id && acceptedPlayableVideoUrl);
      if (uploadWasAccepted) {
        // The video is kept in the editor (already committed above) so
        // transcription can be retried without another upload.
        setCaptions([]);
        setCaptionTracks([]);
        setActiveCaptionTrackId('source');
      }
      setShowCaptionRetryNotice(uploadWasAccepted);
      trackAnalytics('funnel.upload.failed', getClientContext({
        stage: uploadWasAccepted ? 'transcription' : 'upload',
        status: Number(error?.status || 0),
        requestReference: error?.requestId || '',
        uploadAccepted: uploadWasAccepted,
      }));
      if (Number(error?.status) === 402) {
        // Free trial used up: this is an upgrade moment, not a failure.
        setShowCaptionRetryNotice(false);
        setPricingMessage(uploadWasAccepted
          ? "You've used your free transcriptions. Pick a plan to keep captioning — your video stays in the editor."
          : "You've used your free transcriptions. Pick a plan to keep captioning.");
        setIsPricingModalOpen(true);
      } else {
        notifyApiError(
          error,
          uploadWasAccepted ? 'Transcription failed — video kept in editor' : 'Failed to process video',
        )
      }
    } finally {
      const elapsedMs = Date.now() - generationStart;
      const remainingMinDurationMs = Math.max(0, GENERATING_SCREEN_MIN_MS - elapsedMs);
      if (remainingMinDurationMs > 0) {
        await sleep(remainingMinDurationMs);
      }
      setIsUploading(false);
      setUploadProgress(null);
      setIsGenerating(false);
      setGenerationStartedAt(null);
      if (captionsReady) {
        // Measured when the captions actually appear, so it includes the
        // upload and the waiting screen; the clock starts when the file was picked.
        const shownAt = Date.now();
        trackAnalytics('funnel.captions.ready', getClientContext({
          stage: 'captions',
          timeToFirstCaptionMs: shownAt - (uploadTask?.pickedAt || generationStart),
          fromGenerateMs: shownAt - generationStart,
        }));
      }
    }
  };

  const handleRetryTranscription = () => {
    if (!fileId || !videoUrl || isGenerating) return;
    setShowCaptionRetryNotice(false);
    // The source upload is already owned by this account. Reuse it instead of
    // asking the customer to upload again (or consuming another upload slot).
    handleUpload(null, {
      ...(settings || {}),
      preUploadedFileId: fileId,
      preUploadedRawUrl: videoUrl,
    }, { isRetry: true });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const saved = await saveNow();
    setIsSaving(false);
    if (!saved) return;
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Each seek is a new object so seeking to the same time twice (clicking the
  // same caption again after playback moved on) still moves the video.
  const handleSeek = useCallback((time) => {
    setCurrentTime(time);
    setSeekSignal({ time: Number(time) || 0 });
  }, []);

  const handlePlayCaption = useCallback((caption) => {
    const startTime = Number(caption?.start_time || 0);
    handleSeek(startTime);
    setIsPlaying(true);
  }, [handleSeek]);

  const relinkSource = async (file) => {
    if (!file || isRelinking) return
    setIsRelinking(true)
    try {
      const token = await getEffectiveAuthToken(currentUser)
      const uploaded = await uploadFileWithRecovery(file, { authorization: token, dedupeKey: 'relink-source' })
      if (!uploaded.success || !uploaded.raw_url) throw new Error(uploaded.error || 'Source upload failed')
      setFileId(uploaded.file_id)
      setVideoUrl(resolveApiResourceUrl(uploaded.raw_url, import.meta.env.VITE_API_BASE_URL))
      replaceLocalPlayback(file, uploaded.file_id)
      setOriginalFileName(file.name)
      setWaveformData(null)
      setSourceUnavailable(false)
      setCloudSaveMessage('Source relinked. Captions and styles preserved; review synchronization before rendering.')
    } catch (error) {
      setCloudSaveMessage(error.message || 'Could not relink video. Your captions are unchanged.')
    } finally { setIsRelinking(false) }
  }

  const playbackUrl = localPlayback && localPlayback.fileId === fileId ? localPlayback.url : videoUrl;
  const refreshVideoPlaybackUrl = useCallback(async (event) => {
    if (!fileId || mediaRefreshInFlightRef.current) return;
    // A fresh link is requested at most once a minute per video. Every refresh
    // returns a new signed URL, so a video this browser cannot decode (e.g.
    // HEVC) otherwise errored and refreshed in an endless loop.
    const lastRefresh = lastMediaRefreshRef.current;
    if (lastRefresh.fileId === fileId && Date.now() - lastRefresh.at < 60000) {
      if (!lastRefresh.reported) {
        lastMediaRefreshRef.current = { ...lastRefresh, reported: true };
        setCloudSaveMessage('This browser cannot play this video. Captions can still be edited, saved and exported.');
      }
      return;
    }
    lastMediaRefreshRef.current = { fileId, at: Date.now(), reported: false };

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
        setSeekSignal({ time: resumeAt });
        if (shouldResume) setIsPlaying(true);
      }
    } catch (error) {
      console.warn('Failed to refresh video playback URL:', error);
      setSourceUnavailable(true)
    } finally {
      mediaRefreshInFlightRef.current = false;
    }
  }, [currentTime, currentUser, fileId, isPlaying, setCloudSaveMessage, setVideoUrl, videoUrl]);

  const handleVideoError = (event) => {
    // If the device copy cannot play, fall back to the storage link.
    if (localPlaybackRef.current && localPlaybackRef.current.fileId === fileId) {
      replaceLocalPlayback(null);
      return;
    }
    refreshVideoPlaybackUrl(event);
  };

  const updateCaptions = useCallback((newCaptions, options) => pushHistory(newCaptions, undefined, options), [pushHistory])
  // A native colour picker fires on every move of a drag; one burst of style
  // changes is one undo step instead of dozens (and a flushed history).
  const updateCaptionStyle = useCallback((newStyle) => pushHistory(undefined, newStyle, { coalesce: 'caption-style' }), [pushHistory])
  const addToHistory = useCallback(() => pushHistory(undefined, undefined), [pushHistory])

  // Word popup edits apply with the functional raw setter (building new
  // captions from a render's closure corrupted other words), and record one
  // undo snapshot per gesture: a click that sets several keys at once (colour +
  // clearing its gradient) or a continuous drag of one control. Sliders record
  // on pointer-down (onHistoryRecord) and pass skipHistory for their ticks.
  const WORD_STYLE_BURST_MS = 600;
  const wordStyleHistoryRef = useRef({ key: '', at: 0 });
  const recordWordStyleGesture = () => {
    addToHistory();
    wordStyleHistoryRef.current = { key: '*', at: Date.now() };
  };
  // Slider ticks pass skipHistory because their pointer-down already recorded
  // the drag ('*' gesture). A slider moved with the keyboard has no such
  // gesture, so every change records once per burst here either way.
  const recordWordStyleChange = (key) => {
    const now = Date.now();
    const last = wordStyleHistoryRef.current;
    const sameGesture = now - last.at < 50
      || (now - last.at < WORD_STYLE_BURST_MS && (last.key === key || last.key === '*'));
    wordStyleHistoryRef.current = { key: sameGesture && last.key === '*' ? '*' : key, at: now };
    if (!sameGesture) addToHistory();
  };
  const handleWordStyleChange = (key, value) => {
    if (!wordPopup) return;
    recordWordStyleChange(key);
    setCaptions(prev => updatePopupWordStyle(prev, wordPopup, (style) => applyWordStyleChange(style, key, value)));
    setWordPopup(prev => {
      if (!prev?.caption || prev.type === 'element') return prev;
      const styleKey = wordPopupStyleKey(prev);
      return {
        ...prev,
        caption: {
          ...prev.caption,
          wordStyles: {
            ...(prev.caption.wordStyles || {}),
            [styleKey]: applyWordStyleChange(prev.caption.wordStyles?.[styleKey] || {}, key, value),
          },
        },
      };
    });
  };

  const handleResetWordFontSize = () => {
    if (!wordPopup) return;
    addToHistory();
    setCaptions(prev => updatePopupWordStyle(prev, wordPopup, resetWordFontSize));
  };

  const handleResetWordPosition = () => {
    if (!wordPopup) return;
    addToHistory();
    setCaptions(prev => updatePopupWordStyle(prev, wordPopup, resetWordPosition));
  };

  const handleApplyTemplate = useCallback(async (templateStyle) => {
    const application = buildTemplateApplication({
      templateStyle,
      captionStyle,
      captions,
      waveformData,
      duration,
    });
    // Load the font that will actually render (already remapped to a
    // script-appropriate family when the captions are Indic).
    if (application.style.font_family) {
      loadGoogleFont(application.style.font_family, [300, 400, 500, 600, 700, 800, 900]).catch(() => {});
    }
    if (application.templateSnapshot) {
      const recent = getTemplateRecentEntry(application.templateSnapshot);
      recordRecentTemplate(recent.kind, recent.id);
      trackAnalytics('template.applied', getClientContext({
        kind: recent.kind,
        templateId: recent.id,
        templateName: application.templateSnapshot.template_name || '',
        templateSource: application.templateSnapshot.template_source || '',
      }));
    }
    setWordPopup(null);
    pushHistory(application.captions, application.style);
  }, [captionStyle, captions, duration, pushHistory, waveformData]);

  // Reset returns to the project as it was opened or generated.
  const handleRefresh = () => {
    // Reset discards every edit and cannot be undone, so it is confirmed.
    if (typeof window !== 'undefined' && typeof window.confirm === 'function'
        && !window.confirm('Reset to the original captions and style? All edits in this project will be discarded and cannot be undone.')) {
      return;
    }
    const resetPoint = resetPointRef.current || snapshotEditorState();
    setWordPopup(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setSelectedCaptionId(null);
    setIsVideoFullscreen(false);
    collapseTimeline();
    applyDocument(restoreEditorDocument(resetPoint));
    resetHistory();
  };

  const handleSelectPlan = async () => {
    // Server-verified payment updates are refreshed by PricingModal. Never
    // persist a client-selected plan as an authorization signal.
    setIsPricingModalOpen(false);
  };

  const openWordPopup = useCallback((popup) => {
    if (!popup) {
      setWordPopup(null);
      return;
    }
    setWordPopupOpenCount(prev => prev + 1);
    setWordPopup({
      ...popup,
      _openKey: Date.now() + Math.random(),
    });
  }, []);

  const openCaptionWordPopup = useCallback((caption, wordIndex, position, word) => (
    openWordPopup({ caption, wordIndex, position, word })
  ), [openWordPopup]);

  // Capture the immutable reset point once the initial project has loaded.
  useEffect(() => {
    if (!videoUrl || !captions.length) return;
    if (resetPointRef.current) return;
    resetPointRef.current = snapshotEditorState();
  }, [captionStyle, captions.length, resetPointRef, snapshotEditorState, videoUrl]);

  // Auto-Center: when the font changes (or 'None' is selected), load the new font and
  // trigger a style refresh so the preview re-measures word bounding boxes with the
  // correct font metrics.  This also ensures Indic ↔ Latin switches re-anchor correctly.
  useEffect(() => {
    const fontFamily = captionStyle?.font_family;
    if (!fontFamily) return;
    loadGoogleFont(fontFamily, [300, 400, 500, 600, 700, 800]).catch(() => {});
  }, [captionStyle?.font_family]);

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
            duration={duration}
            setCaptions={updateCaptions}
            captionTracks={captionTracks}
            activeCaptionTrackId={activeCaptionTrackId}
            onSelectTrack={selectCaptionTrack}
            onTranslate={handleTranslateCaptions}
            isTranslating={isTranslatingCaptions}
            selectedCaptionId={selectedCaptionId}
            setSelectedCaptionId={setSelectedCaptionId}
            onSeek={handleSeek}
            onPlayCaption={handlePlayCaption}
            onOpenWordPopup={openCaptionWordPopup}
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
            duration={duration}
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
            brandKits={brandKits}
            onBrandKitsChange={setBrandKits}
            preferenceSyncStatus={editorPreferenceSyncStatus}
          />
        </Suspense>
      );
    }

    return null;
  };

  // One word editor, docked where it cannot cover the preview: the inspector
  // column (desktop), the dock sheet (tablet/phone) or beside the frame
  // (fullscreen). If fullscreen leaves no room beside it, leave fullscreen.
  const renderWordEditor = (placement) => (
    <Suspense fallback={null}>
      <WordClickPopup
        key={wordPopup._openKey ?? wordPopupOpenCount}
        placement={placement}
        onCannotFloat={exitFullscreenForWordEditor}
        wordKey={wordPopupStyleKey(wordPopup)}
        inheritedFontSize={Math.round(Number(captionStyle?.font_size) || 18)}
        inheritedColor={captionStyle?.text_color || '#ffffff'}
        word={getPopupWordText(captions, wordPopup)}
        position={wordPopup.position}
        onStyleChange={handleWordStyleChange}
        currentStyle={getPopupWordStyle(captions, wordPopup)}
        onEdit={() => {
          const targetId = wordPopupTargetId(wordPopup);
          setActiveTab('captions');
          setIsMobileSheetOpen(true);
          if (targetId) setSelectedCaptionId(targetId);
          // On tablet/phone the word editor holds the dock sheet; free it.
          if (!isDesktopLayout) setWordPopup(null);
        }}
        onClose={() => setWordPopup(null)}
        onResetPosition={handleResetWordPosition}
        onResetFontSize={handleResetWordFontSize}
        onHistoryRecord={recordWordStyleGesture}
      />
    </Suspense>
  );

  const renderStylePanel = () => (
    <div data-style-panel="true" className="contents">
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
    </div>
  );

  // In the mobile dock the timeline owns its whole tab, so it never collapses
  // (a collapsed timeline there is just an empty strip).
  const renderTimelinePanel = ({ inDock = false } = {}) => (
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
        collapsed={inDock ? false : isTimelineCollapsed}
        onToggleCollapsed={inDock ? undefined : () => {
          setIsTimelineCollapsed(prev => {
            const next = !prev;
            setTimelineHeight(next ? COLLAPSED_TIMELINE_HEIGHT : EXPANDED_TIMELINE_HEIGHT);
            return next;
          });
        }}
      />
    </Suspense>
  );

  const generationElapsedSeconds = generationStartedAt
    ? Math.max(0, Math.floor(((generationTicker || Date.now()) - generationStartedAt) / 1000))
    : 0;
  const mobileTabs = [
    // Templates lead, like Canva's "Design" tab: picking a look is the
    // first thing most people do with a fresh transcript.
    { id: 'templates', label: 'Templates', icon: Layout },
    { id: 'captions', label: 'Captions', icon: Captions },
    { id: 'style', label: 'Style', icon: SlidersHorizontal },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'animate', label: 'Animate', icon: Sparkles },
    { id: 'layers', label: 'Layers', icon: Layers },
    { id: 'timeline', label: 'Timeline', icon: Clock3 },
  ];
  const subscriptionBaseTier = String(userData?.subscription_tier || '')
    .replace(/_yearly$/, '');
  const lowCreditTopUpOffer = TOP_UP_OFFERS[subscriptionBaseTier] || null;

  useEffect(() => {
    const shouldShow = Boolean(
      lowCreditTopUpOffer && (userData?.credits_remaining ?? 999) <= 5
    )
    if (!shouldShow) {
      setShowLowCreditNotice(false)
      return undefined
    }
    setShowLowCreditNotice(true)
    const timer = window.setTimeout(() => setShowLowCreditNotice(false), 10000)
    return () => window.clearTimeout(timer)
  }, [lowCreditTopUpOffer, userData?.credits_remaining])

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-[#050505] flex flex-col overflow-hidden text-white">
      <DashboardHeader
        onUploadClick={handleUploadModalOpen}
        onExportClick={handleExportClick}
        onSaveClick={handleSave}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        hasVideo={!!videoUrl || captions.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onRefresh={handleRefresh}
        user={currentUser}
        userData={userData}
        onLogin={() => navigate('/login')}
        onUpgradeClick={() => setIsPricingModalOpen(true)}
      />

      <EditorNotices
        saveConflict={showCloudSaveConflictNotice}
        saveMessage={cloudSaveMessage}
        translationNotice={translationNotice}
        onDismissTranslation={() => setTranslationNotice('')}
        lowCreditOffer={showLowCreditNotice ? lowCreditTopUpOffer : null}
        onTopUp={() => setIsPricingModalOpen(true)}
        showCaptionRetry={Boolean(showCaptionRetryNotice && fileId && captions.length === 0)}
        onRetryCaptions={handleRetryTranscription}
        retryDisabled={isGenerating}
        onDownloadDraft={captions.length > 0 ? () => downloadDraft(snapshotEditorState()) : null}
      />
      <EditorStatusBanners
        sourceUnavailable={sourceUnavailable || (!videoUrl && captions.length > 0)}
        isRelinking={isRelinking}
        onRelinkSource={relinkSource}
        brandKitSyncStatus={currentUser ? editorPreferenceSyncStatus : ''}
        onRetryBrandKitSync={retryPreferenceSync}
        onReloadBrandKits={reloadCloudPreferences}
      />
      {/* Main content */}
      <div className="flex-1 overflow-hidden lekha-editor-shell">
        {isGenerating ? (
          <GeneratingCaptionsScreen
            elapsedSeconds={generationElapsedSeconds}
            uploadPercent={isUploading ? (uploadProgress?.percent ?? 0) : null}
          />
        ) : !videoUrl && !captions.length ? (
          <EditorEmptyState
            localRecoveryDraft={localRecoveryDraft}
            applyLocalDraft={applyLocalDraft}
            accountDraft={cloudReady && currentUser ? cloudDraft : null}
            onContinueAccountDraft={continueAccountDraft}
            handleUploadModalOpen={handleUploadModalOpen}
          />
        ) : (
          // Editor layout
          <div className="h-full flex flex-col overflow-hidden">
          <div className={`flex-1 overflow-hidden ${isVideoFullscreen ? 'relative p-0' : 'flex flex-col lg:grid lg:grid-cols-[48px_285px_minmax(0,1fr)_285px] xl:grid-cols-[48px_300px_minmax(0,1fr)_300px] p-0 lg:p-3 gap-0 lg:gap-3'}`}>
            {!isVideoFullscreen && isDesktopLayout && (
              <>
                {/* Vertical Sidebar Navigation */}
                <div data-editor-panel="true" className="hidden lg:block min-h-0">
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
                <div data-editor-panel="true" className="hidden lg:block w-full rounded-[18px] lekha-panel lekha-panel-corners p-3 overflow-hidden min-h-0">
                  {renderEditorPanel()}
                </div>
              </>
            )}

            {/* Center Panel - Video Player & Timeline */}
            <div className={`${isVideoFullscreen ? 'absolute inset-0 z-30 bg-[#050505] px-6 py-5' : 'flex-1 px-1 py-1 md:py-2 lg:py-3'} flex flex-col overflow-hidden min-h-0`} style={{ position: isVideoFullscreen ? 'absolute' : 'relative', zIndex: 50 }}>
              {!isVideoFullscreen && (
              <div className="relative z-10 shrink-0 hidden lg:flex items-center justify-between px-1 pb-2">
                <div className="flex items-center gap-3">
                  {/* Early-access marker. This row shows it on desktop and
                      DashboardHeader shows it below lg, so the badge
                      renders at every breakpoint (the nav rail is lg-only). */}
                  <span
                    title="Lekha Captions is in public beta — please report anything that looks wrong."
                    className="shrink-0 rounded-full border border-[#F5A623]/40 bg-[#F5A623]/10 px-2 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-[#F5A623]"
                  >
                    Beta
                  </span>
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

              {/* The bottom padding keeps the preview clear of the floating
                  desktop timeline; the mobile dock sits below this panel
                  instead. On mobile the inner wrapper takes the full height so
                  the 9:16 frame fits it, with play controls in view. */}
              <div
                className="relative z-10 flex-1 min-h-0 overflow-y-auto max-lg:overflow-y-hidden overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ paddingBottom: isVideoFullscreen || isTimelineCollapsed || !isDesktopLayout ? 0 : `${Math.max(72, timelineHeight - 24)}px` }}
              >
                <div className="transition-transform duration-200 max-lg:h-full">
                  <Suspense fallback={<VideoLoadingFallback />}>
                    <VideoPlayer
                      videoUrl={playbackUrl}
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
                        previewVideoElRef.current = videoEl || null;
                        if (videoEl && !waveformData) {
                          const data = await extractWaveformData(videoEl, 400);
                          if (data) setWaveformData(data);
                        }
                      }}
                      onVideoError={handleVideoError}
                      isVideoFullscreen={isVideoFullscreen}
                      setIsVideoFullscreen={setIsVideoFullscreen}
                    />
                  </Suspense>
                </div>
              </div>

              {!isVideoFullscreen && isDesktopLayout && !isTimelineCollapsed && (
                <TimelineResizeHandle
                  timelineHeight={timelineHeight}
                  setTimelineHeight={setTimelineHeight}
                  minHeight={EXPANDED_TIMELINE_HEIGHT}
                  onCollapse={collapseTimeline}
                />
              )}
              {!isVideoFullscreen && isDesktopLayout && (
                <div
                  data-editor-panel="true"
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

            {!isVideoFullscreen && isDesktopLayout && (
              <div className="hidden lg:block w-full overflow-hidden min-h-0">
                {/* The word editor takes the inspector column while open (the
                    Styling panel stays mounted to keep its state), so it never
                    covers the video preview. */}
                <div className={wordPopup ? 'hidden' : 'contents'}>
                  {renderStylePanel()}
                </div>
                {wordPopup && renderWordEditor('panel')}
              </div>
            )}

            {!isVideoFullscreen && !isDesktopLayout && (
              <MobileDashboardDock
                activeTab={activeTab}
                tabs={mobileTabs}
                setActiveTab={setActiveTab}
                renderEditorPanel={renderEditorPanel}
                renderStylePanel={renderStylePanel}
                renderTimelinePanel={renderTimelinePanel}
                isSheetOpen={isMobileSheetOpen}
                setIsSheetOpen={setIsMobileSheetOpen}
                captions={captions}
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                onSeek={handleSeek}
                selectedCaptionId={selectedCaptionId}
                onSelectCaption={setSelectedCaptionId}
                onToggleFullscreen={() => setIsVideoFullscreen(true)}
                getVideoElement={() => previewVideoElRef.current}
                wordEditor={wordPopup ? renderWordEditor('sheet') : null}
              />
            )}
          </div>
          </div>
        )}
      </div>

      {/* Fullscreen has no editor columns: the word editor floats beside the frame. */}
      {wordPopup && isVideoFullscreen && renderWordEditor('floating')}

      {/* Modals */}
      {isUploadModalOpen && (
        <Suspense fallback={null}>
          <UploadModal
            open={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUpload={handleUpload}
            onPlanLimit={(message) => {
              setIsUploadModalOpen(false);
              setPricingMessage(message);
              setIsPricingModalOpen(true);
            }}
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
              sourceUnavailable={sourceUnavailable || !videoUrl}
              captionTrackLabel={captionTracks.find((track) => track.id === activeCaptionTrackId)?.label || 'Original'}
              captionStyle={captionStyle}
              waveformData={waveformData}
              duration={duration}
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
