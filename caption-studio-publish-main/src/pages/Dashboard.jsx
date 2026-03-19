import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/lib/AuthContext';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import VideoPlayer from '@/components/dashboard/VideoPlayer';
import CaptionTimeline from '@/components/dashboard/CaptionTimeline';
import CaptionEditor from '@/components/dashboard/CaptionEditor';
import StyleControls from '@/components/dashboard/StyleControls';
import TemplatesTab from '@/components/dashboard/TemplatesTab';
import TemplatesTab2 from '@/components/dashboard/TemplatesTab2';
import TextTab from '@/components/dashboard/TextTab';
import AnimateTab from '@/components/dashboard/AnimateTab';
import HistoryTab from '@/components/dashboard/HistoryTab';
import SidebarNav from '@/components/dashboard/SidebarNav';
import UploadModal from '@/components/dashboard/UploadModal';
import ExportPanel from '@/components/dashboard/ExportPanel';
import PricingModal from '@/components/dashboard/PricingModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { extractWaveformData } from '@/components/dashboard/audioUtils';
import { autoLoadFontForText } from '@/components/dashboard/fontUtils';

// Helper for retrying operations
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.warn(`Operation failed, retrying(${i + 1}/${maxRetries})...`, error);
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};

const defaultCaptionStyle = {
  font_family: 'Inter',
  font_size: 18,
  font_weight: '500',
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
  has_background: true,
  background_opacity: 0.7,
  background_padding: 6,
  background_h_multiplier: 0.99,
  background_color: '#000000',
  has_stroke: false,
  has_shadow: false,
  has_animation: false,
  position: 'bottom',
  position_y: 75,
  max_lines: 2,
  max_chars: 30,
  auto_rotation: false,
  scale: 1
};

export default function Dashboard() {
  const { currentUser, userData, loginWithGoogle } = useAuth();
  const location = useLocation();

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [isPlanExpiredModalOpen, setIsPlanExpiredModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [videoUrl, setVideoUrl] = useState('');
  const [fileId, setFileId] = useState(null);
  const [originalFileName, setOriginalFileName] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Video canvas fullscreen & resizable timeline
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(170);
  const timelineDividerRef = useRef(null);
  const isDraggingDivider = useRef(false);
  const dividerStartY = useRef(0);
  const dividerStartHeight = useRef(200);

  const [captions, setCaptions] = useState([]);
  const [selectedCaptionId, setSelectedCaptionId] = useState(null);
  const [captionStyle, setCaptionStyle] = useState(defaultCaptionStyle);

  const [projectId, setProjectId] = useState(null);
  const [settings, setSettings] = useState({ language: 'english', style: 'viral_hook' });
  const [isLoaded, setIsLoaded] = useState(false);

  // Undo/Redo state
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Active tab for sidebar navigation
  const [activeTab, setActiveTab] = useState('captions');

  // Floating Word Popup state
  const [wordPopup, setWordPopup] = useState(null);

  // Animation settings
  const [selectedWordForAnimation, setSelectedWordForAnimation] = useState(null);

  // Waveform data for timeline
  const [waveformData, setWaveformData] = useState(null);

  // Raw HTML5 video DOM element for native fast-scrubbing bypassing React renders
  const [videoElement, setVideoElement] = useState(null);

  // External Video Sync Signal
  const [seekSignal, setSeekSignal] = useState(null);

  // Force a clean session natively on page load, unless navigating back from Account
  useEffect(() => {
    const isNavigationRestore = location.state?.restoreSession;

    if (isNavigationRestore) {
      try {
        const savedState = localStorage.getItem('captionEditorState');
        if (savedState) {
          const parsed = JSON.parse(savedState);
          if (parsed.videoUrl) setVideoUrl(parsed.videoUrl);
          if (parsed.captions) setCaptions(parsed.captions);
          if (parsed.captionStyle) setCaptionStyle(parsed.captionStyle);
          if (parsed.projectId) setProjectId(parsed.projectId);
          if (parsed.duration) setDuration(parsed.duration);
          if (parsed.fileId) setFileId(parsed.fileId);
          if (parsed.originalFileName) setOriginalFileName(parsed.originalFileName);
          if (parsed.settings) setSettings(parsed.settings);
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
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') || params.get('session_reset')) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    setIsLoaded(true);
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
    setIsUploading(true);
    setSettings(uploadSettings);
    setIsUploadModalOpen(false);
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');

      setVideoUrl(uploadData.raw_url);
      setFileId(uploadData.file_id);
      setOriginalFileName(file.name);

      // Parse wordsPerLine range for backend (e.g., "1-2" → min=1, max=2)
      // "dynamic" (or unset) → min=2, max=5 so backend groups 2-5 words (not single-word captions)
      let minWords = 2, maxWordsVal = 5;
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

      const processRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: uploadData.file_id, language: 'auto', min_words: minWords, max_words: maxWordsVal })
      });
      const processData = await processRes.json();
      if (!processData.success) throw new Error(processData.error || 'Processing failed');

      let generatedCaptions = (processData.captions || []).map((cap, idx) => ({
        text: cap?.text || '',
        start_time: cap?.start_time || 0,
        end_time: cap?.end_time || 3,
        id: `${Date.now()}-${idx}`,
        words: cap?.words || []
      }));

      // Auto-translate if user selected a specific caption language (not 'auto')
      const targetLang = uploadSettings?.language;
      if (targetLang && targetLang !== 'auto' && generatedCaptions.length > 0) {
        try {
          const translateRes = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              captions: generatedCaptions.filter(c => !c.isTextElement),
              target_language: targetLang
            })
          });
          const translateData = await translateRes.json();
          if (translateData.success && translateData.captions) {
            const translatedMap = new Map();
            translateData.captions.forEach(tc => { if (tc.id) translatedMap.set(tc.id, tc.text); });
            generatedCaptions = generatedCaptions.map(c => {
              if (c.isTextElement || !translatedMap.has(c.id)) return c;
              return { ...c, text: translatedMap.get(c.id) };
            });
          }
        } catch (translateErr) {
          console.warn('Auto-translation failed, using original captions:', translateErr);
        }
      }

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

      if (generatedCaptions.length > 0) {
        const sampleText = generatedCaptions.map(c => c.text).join(' ');
        const { fontFamily, script, fontOptions } = await autoLoadFontForText(sampleText);
        setCaptionStyle(prev => ({
          ...prev,
          font_family: fontFamily,
          detected_script: script,
          available_fonts: fontOptions?.map(f => f.name) || [],
          wordsPerLine: uploadSettings?.wordsPerLine || 'dynamic'
        }));
      }

      setProjectId(`local_${Date.now()}`);

      try {
        const waveform = await extractWaveformData(uploadData.raw_url);
        setWaveformData(waveform);
      } catch (e) {
        console.warn('Waveform extraction failed:', e);
      }

    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Failed to process video: ${error.message || 'Unknown error'} `);
    } finally {
      setIsUploading(false);
      setIsGenerating(false);
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

  // Push current state to history, then apply new state
  const pushHistory = (newCaptions, newStyle) => {
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
    if (newCaptions !== undefined) setCaptions(newCaptions);
    if (newStyle !== undefined) setCaptionStyle(newStyle);
  };

  const updateCaptions = (newCaptions) => pushHistory(newCaptions, undefined);
  const updateCaptionStyle = (newStyle) => pushHistory(undefined, newStyle);
  const handleApplyTemplate = async (templateStyle) => {
    // Hard Reset: properties that templates fully control are cleared before applying
    // so Template B never inherits BG, color, font, or animation from Template A.
    // Non-template properties (line_spacing, shadow, effects, position) are preserved.
    const TEMPLATE_OWNED_RESET = {
      template_id: '',
      font_family: 'Inter',
      font_size: 18,
      font_weight: '500',
      font_style: 'normal',
      text_color: '#ffffff',
      text_case: 'none',
      secondary_color: '',
      highlight_color: '',
      highlight_gradient: '',
      has_background: false,
      background_color: '#000000',
      background_opacity: 0.7,
      show_inactive: undefined,
      position_y: 75,
    };
    const merged = { ...captionStyle, ...TEMPLATE_OWNED_RESET, ...templateStyle };
    // Load the template's font (if any) before applying so the browser has it
    if (templateStyle?.font_family) {
      const { loadGoogleFont } = await import('@/components/dashboard/fontUtils');
      // Apply font immediately; loading is best-effort
      loadGoogleFont(templateStyle.font_family, [300, 400, 500, 600, 700, 800]).catch(() => {});
    }
    pushHistory(undefined, merged);
  };
  const addToHistory = () => pushHistory(undefined, undefined);

  const handleUndo = () => {
    if (historyIndex >= 0) {
      const prevState = history[historyIndex];
      setCaptions(prevState.captions);
      setCaptionStyle(prevState.captionStyle);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setCaptions(nextState.captions);
      setCaptionStyle(nextState.captionStyle);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleRefresh = () => {
    // Clear localStorage and reload
    localStorage.removeItem('captionEditorState');
    window.location.reload();
  };

  const handleNewProject = () => {
    localStorage.removeItem('captionEditorState');
    setVideoUrl('');
    setCaptions([]);
    setCaptionStyle(defaultCaptionStyle);
    setProjectId(null);
    setDuration(0);
    setCurrentTime(0);
    setSelectedCaptionId(null);
    setHistory([]);
    setHistoryIndex(-1);
  };

  const handleSelectPlan = async (planId) => {
    // This would integrate with payment gateway
    alert(`Payment integration coming soon! Selected plan: ${planId} `);
    setIsPricingModalOpen(false);
  };

  // Initialize history when captions are first loaded (transition from empty → populated)
  useEffect(() => {
    if (captions.length > 0 && history.length === 0) {
      setHistory([{
        captions: JSON.parse(JSON.stringify(captions)),
        captionStyle: JSON.parse(JSON.stringify(captionStyle))
      }]);
      setHistoryIndex(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captions.length, history.length]);

  // Auto-Center: when the font changes (or 'None' is selected), load the new font and
  // trigger a style refresh so the preview re-measures word bounding boxes with the
  // correct font metrics.  This also ensures Indic ↔ Latin switches re-anchor correctly.
  useEffect(() => {
    const fontFamily = captionStyle?.font_family;
    if (!fontFamily) return;
    import('@/components/dashboard/fontUtils').then(({ loadGoogleFont }) => {
      loadGoogleFont(fontFamily, [300, 400, 500, 600, 700, 800]).catch(() => {});
    });
  }, [captionStyle?.font_family]);

  const navigate = useNavigate();

  const [pricingMessage, setPricingMessage] = useState('');

  const handleExportClick = () => {
    // Always open the Export Panel — auth/credit checks are handled inside
    setIsExportPanelOpen(true);
  };

  return (
    <div className="h-screen max-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <DashboardHeader
        onUploadClick={() => setIsUploadModalOpen(true)}
        onExportClick={handleExportClick}
        onSaveClick={handleSave}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        hasVideo={!!videoUrl}
        hasCaptions={captions.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex >= 0}
        canRedo={historyIndex < history.length - 1}
        onRefresh={handleRefresh}
        user={currentUser}
        userData={userData}
        onLogin={() => navigate('/login')}
        onUpgradeClick={() => setIsPricingModalOpen(true)}
      />

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {isGenerating ? (
          // Generating state (checked before !videoUrl so re-uploading shows this)

          <div className="h-full flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-full bg-[#2ECC9A]/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-[#2ECC9A] animate-pulse" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Generating Captions...
              </h2>
              <p className="text-gray-500">
                Caption Studio is analyzing your video and creating perfect captions
              </p>
              <div className="mt-6 flex items-center justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-[#2ECC9A]"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        ) : !videoUrl ? (
          <div className="h-full flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md"
            >
              <div className="w-20 h-20 rounded-full bg-[#2ECC9A]/10 flex items-center justify-center mx-auto mb-6">
                <Upload className="w-8 h-8 text-[#2ECC9A]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Start Creating Captions
              </h2>
              <p className="text-gray-500 mb-6">
                Upload your short-form video (15-90 seconds) and we'll generate professional captions instantly.
              </p>
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                size="lg"
                className="bg-[#2ECC9A] hover:bg-[#27b889] text-[#0A3D2C] font-semibold px-8"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Video
              </Button>
            </motion.div>
          </div>
        ) : (
          // Editor layout
          <div className="h-full flex flex-col lg:flex-row">
            {/* Vertical Sidebar Navigation */}
            <SidebarNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              user={currentUser}
              onOpenPricing={(action) => {
                if (action === 'logout') {
                  // Handled by AuthContext logout 
                } else {
                  setIsPricingModalOpen(true)
                }
              }}
            />

            {/* Left Panel - Content based on active tab */}
            <div className="w-full lg:w-[340px] xl:w-[360px] border-r border-white/5 p-4 overflow-hidden">
              {activeTab === 'captions' && (
                <CaptionEditor
                  captions={captions}
                  setCaptions={updateCaptions}
                  selectedCaptionId={selectedCaptionId}
                  setSelectedCaptionId={setSelectedCaptionId}
                  onSeek={handleSeek}
                  onOpenWordPopup={(caption, wordIndex, position, word) => setWordPopup({ caption, wordIndex, position, word })}
                  wordPopup={wordPopup}
                  user={currentUser}
                />
              )}
              {activeTab === 'text' && (
                <TextTab
                  captions={captions}
                  setCaptions={updateCaptions}
                  currentTime={currentTime}
                  setSelectedCaptionId={setSelectedCaptionId}
                />
              )}
              {activeTab === 'templates' && (
                <TemplatesTab
                  currentStyle={captionStyle}
                  onApplyTemplate={handleApplyTemplate}
                />
              )}
              {activeTab === 'animate' && (
                <AnimateTab
                  selectedWord={selectedWordForAnimation}
                  selectedCaption={
                    captions.find(c => c.id === selectedCaptionId) ||
                    captions.find(c => currentTime >= c.start_time && currentTime <= c.end_time)
                  }
                  captions={captions}
                  setCaptions={updateCaptions}
                />
              )}
              {activeTab === 'history' && (
                <HistoryTab user={currentUser} userData={userData} />
              )}
              {activeTab === 'templates2' && (
                <TemplatesTab2
                  currentStyle={captionStyle}
                  onApplyTemplate={handleApplyTemplate}
                />
              )}
            </div>

            {/* Center Panel - Video Player & Timeline */}
            <div className="flex-1 border-r border-white/5 px-2 py-1 flex flex-col overflow-hidden min-h-0">

              <div className="flex-1 min-h-0 overflow-hidden">
                <VideoPlayer
                  videoUrl={videoUrl}
                  currentTime={currentTime}
                  setCurrentTime={setCurrentTime}
                  seekSignal={seekSignal}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  captions={captions}
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
                  setWordPopup={setWordPopup}
                  onVideoLoaded={async (videoEl) => {
                    setVideoElement(videoEl);
                    // Extract waveform when video loads
                    if (videoEl && !waveformData) {
                      const data = await extractWaveformData(videoEl, 400);
                      if (data) setWaveformData(data);
                    }
                  }}
                  isVideoFullscreen={isVideoFullscreen}
                  setIsVideoFullscreen={setIsVideoFullscreen}
                />
              </div>

              {/* Resizable Divider Bar (Premiere Pro style) */}
              {!isVideoFullscreen && (
                <div
                  ref={timelineDividerRef}
                  className="h-1.5 flex-shrink-0 cursor-ns-resize flex items-center justify-center group relative"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    isDraggingDivider.current = true;
                    dividerStartY.current = e.clientY;
                    dividerStartHeight.current = timelineHeight;
                    const onMove = (ev) => {
                      if (!isDraggingDivider.current) return;
                      const delta = dividerStartY.current - ev.clientY;
                      // Drag up grows timeline, drag down stops at starting position — never shrinks below grab point
                      const newHeight = Math.max(dividerStartHeight.current, Math.min(400, dividerStartHeight.current + delta));
                      setTimelineHeight(newHeight);
                    };
                    const onUp = () => {
                      isDraggingDivider.current = false;
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  }}
                  onDoubleClick={() => setTimelineHeight(170)}
                >
                  {/* Divider line */}
                  <div className="w-full h-px bg-white/5 group-hover:bg-white/15 transition-colors" />
                  {/* Drag handle indicator */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-1 bg-white/10 rounded-full group-hover:bg-white/25 transition-colors" />
                  </div>
                </div>
              )}
              {!isVideoFullscreen && (
                <div style={{ height: `${timelineHeight}px`, flexShrink: 0 }}>
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
                    videoElement={videoElement}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    timelineHeight={timelineHeight}
                  />
                </div>
              )}
            </div>

            {/* Right Panel - Styling */}
            <div className="w-full lg:w-[340px] xl:w-[360px] p-4 overflow-hidden">
              <StyleControls
                captionStyle={captionStyle}
                setCaptionStyle={updateCaptionStyle}
                setCaptionStyleRaw={setCaptionStyle}
                addToHistory={addToHistory}
                selectedCaption={captions.find(c => c.id === selectedCaptionId)}
                captions={captions}
                setCaptions={updateCaptions}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <UploadModal
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
        isUploading={isUploading}
      />

      {isExportPanelOpen && (
        <ErrorBoundary>
          <ExportPanel
            open={isExportPanelOpen}
            onClose={() => setIsExportPanelOpen(false)}
            captions={captions}
            captionStyle={captionStyle}
            videoUrl={videoUrl}
            projectId={projectId}
            fileId={fileId}
            originalFileName={originalFileName}
            onUpgradeClick={() => { setIsExportPanelOpen(false); setIsPricingModalOpen(true); }}
          />
        </ErrorBoundary>
      )}

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => { setIsPricingModalOpen(false); setPricingMessage(''); }}
        onSelectPlan={handleSelectPlan}
        user={currentUser}
        message={pricingMessage}
      />

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
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
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