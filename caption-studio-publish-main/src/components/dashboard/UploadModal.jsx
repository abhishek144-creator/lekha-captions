import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Upload, Film, Sparkles, Globe, Palette, Loader2, Info, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/components/ui/use-toast';
import DismissibleNotice from './DismissibleNotice';
import { apiRequest, getApiErrorMessage } from '@/lib/apiClient';
import {
  MAX_VIDEO_UPLOAD_BYTES,
  isRetryableUploadError,
  readVideoDuration,
  uploadFileWithRecovery,
} from '@/lib/resilientUpload';
import { isSubscriptionExpired } from '@/lib/subscription';
import planCatalog from '../../../shared/planCatalog.json';
import { notifyApiError } from '@/lib/notifyApiError';
import { getClientContext, trackAnalytics } from '@/lib/analytics';
import { useAuth } from '@/lib/AuthContext';
import { getEffectiveAuthToken } from '@/lib/devAuth';
import { globalLanguages, southAsianLanguages } from '@/lib/captionLanguages';

const SUPPORTED_VIDEO_EXTENSION = /\.(mp4|mov|webm|mkv|avi)$/i;
const SUPPORTED_VIDEO_ACCEPT = [
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/x-msvideo',
].join(',');

const fileSignatureOf = (file) => `${file?.name}-${file?.size}-${file?.lastModified}`;

// Mirrors the server's plan-length check so a too-long video is refused before
// any bytes are uploaded. The server re-checks with the real media length.
function planMaxVideoSeconds(userData) {
  const storedTier = String(userData?.subscription_tier || 'free').toLowerCase();
  const expiry = userData?.subscription_expiry || userData?.billing_cycle_end;
  const tier = storedTier !== 'free' && isSubscriptionExpired(expiry) ? 'free' : storedTier;
  return Number(planCatalog[tier]?.max_video_seconds || planCatalog.free?.max_video_seconds || 180);
}

const planLimitMessage = (error) => getApiErrorMessage(error, 'This upload is not available on your plan.')
  .replace(/^[A-Z_]+:\s*/, '');

function validateVideoFile(file) {
  if (!file || !SUPPORTED_VIDEO_EXTENSION.test(file.name || '')) {
    return 'Unsupported file type. Choose an MP4, MOV, WebM, MKV, or AVI video.';
  }
  if (file.type && file.type !== 'application/octet-stream' && !file.type.startsWith('video/')) {
    return 'That file does not look like a video. Choose an MP4, MOV, WebM, MKV, or AVI video.';
  }
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return `File size (${fileSizeMB} MiB) exceeds the 500 MiB limit.`;
  }
  return null;
}

export default function UploadModal({
  open,
  onClose,
  onUpload,
  onPlanLimit,
  isUploading
}) {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [language, setLanguage] = useState('auto');
  const [cleanupMode, setCleanupMode] = useState('clean')
  const [speechFocus, setSpeechFocus] = useState('main')
  const [style, setStyle] = useState('single_line');
  const [wordsPerLine, setWordsPerLine] = useState('dynamic');
  const [step, setStep] = useState(1);
  const [fileSizeError, setFileSizeError] = useState(null);
  const [showDynamicInfo, setShowDynamicInfo] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detectedSpokenLanguage, setDetectedSpokenLanguage] = useState('');
  // The upload starts as soon as a file is picked and runs while the person
  // chooses settings. Generate and Auto-detect both reuse it.
  const uploadTaskRef = useRef(null);
  // Read through a ref so discarding stays stable across auth refreshes; an
  // unmount cleanup that changed identity would discard a live upload.
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const ensureAuthenticated = useCallback(() => {
    if (!currentUser) {
      if (onClose) onClose();
      navigate('/login?mode=signup&returnTo=/Dashboard?entry=editor');
      return false;
    }
    return true;
  }, [currentUser, navigate, onClose]);

  // Stops an upload the person no longer wants. An unfinished upload is
  // cancelled; a finished one is deleted instead of waiting for the janitor.
  const discardUploadTask = useCallback((reason = 'closed') => {
    const task = uploadTaskRef.current;
    uploadTaskRef.current = null;
    if (!task || task.handedOff) return;
    task.controller.abort();
    if (reason === 'closed') {
      trackAnalytics('funnel.upload.abandoned', getClientContext({ stage: 'settings' }));
    }
    task.promise.then(async (outcome) => {
      if (!outcome.ok || !outcome.data?.file_id) return;
      try {
        const authorization = await getEffectiveAuthToken(currentUserRef.current);
        await apiRequest('/api/uploads/discard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
          },
          body: JSON.stringify({ file_id: outcome.data.file_id }),
        });
      } catch {
        // The source janitor still removes unused uploads six hours after upload.
      }
    });
  }, []);

  const handleUploadRefused = useCallback((error) => {
    const status = Number(error?.status || 0);
    if (error?.name === 'AbortError' || status === 0 || isRetryableUploadError(error)) {
      // Temporary failures are retried by Generate, which resumes the upload.
      return;
    }
    const message = planLimitMessage(error);
    uploadTaskRef.current = null;
    setSelectedFile(null);
    setStep(1);
    setFileSizeError(message);
    if (status === 402) onPlanLimit?.(message);
  }, [onPlanLimit]);

  const startBackgroundUpload = useCallback((file, durationSeconds = 0) => {
    discardUploadTask('replaced');
    const listeners = new Set();
    const task = {
      signature: fileSignatureOf(file),
      pickedAt: Date.now(),
      durationSeconds,
      controller: new AbortController(),
      handedOff: false,
      progress: null,
      subscribe(listener) {
        listeners.add(listener);
        if (task.progress) listener(task.progress);
        return () => listeners.delete(listener);
      },
    };
    task.promise = (async () => {
      try {
        const authorization = await getEffectiveAuthToken(currentUser);
        const data = await uploadFileWithRecovery(file, {
          authorization,
          dedupeKey: 'background-upload',
          durationSeconds,
          signal: task.controller.signal,
          onProgress: (progress) => {
            task.progress = progress;
            listeners.forEach((listener) => listener(progress));
          },
        });
        if (!data?.success) throw new Error(data?.error || 'Upload failed');
        return { ok: true, data };
      } catch (error) {
        return { ok: false, error };
      }
    })();
    task.promise.then((outcome) => {
      if (!outcome.ok && uploadTaskRef.current === task) handleUploadRefused(outcome.error);
    });
    uploadTaskRef.current = task;
    return task;
  }, [currentUser, discardUploadTask, handleUploadRefused]);

  // Reset modal to step 1 (upload page) whenever it opens
  useEffect(() => {
    if (open) {
      discardUploadTask('replaced');
      setSelectedFile(null);
      setStep(1);
      setLanguage('auto');
      setStyle('single_line');
      setWordsPerLine('dynamic');
      setFileSizeError(null);
      setDetectedSpokenLanguage('');
    }
  }, [open, discardUploadTask]);

  useEffect(() => discardUploadTask, [discardUploadTask]);

  const acceptFile = useCallback(async (file) => {
    const validationError = validateVideoFile(file);
    if (validationError) {
      setFileSizeError(validationError);
      return false;
    }
    trackAnalytics('funnel.upload.file_picked', getClientContext({ stage: 'pick' }));
    const durationSeconds = await readVideoDuration(file);
    const maxSeconds = planMaxVideoSeconds(userData);
    if (durationSeconds && durationSeconds > maxSeconds + 0.5) {
      trackAnalytics('funnel.upload.refused_locally', getClientContext({ stage: 'pick', reason: 'duration' }));
      setFileSizeError(`Your plan allows videos up to ${maxSeconds}s. This video is ${Math.round(durationSeconds)}s long.`);
      return false;
    }
    setFileSizeError(null);
    setSelectedFile(file);
    setDetectedSpokenLanguage('');
    setStep(2);
    startBackgroundUpload(file, durationSeconds || 0);
    return true;
  }, [userData, startBackgroundUpload]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (!ensureAuthenticated()) return;
      // Windows reports an EMPTY MIME type for some valid videos (.mkv, some
      // .mov) — validation falls back to the extension, and never fails a drop silently.
      acceptFile(e.dataTransfer.files[0]);
    }
  }, [ensureAuthenticated, acceptFile]);

  const handleFileSelect = async (e) => {
    if (e.target.files && e.target.files[0]) {
      if (!ensureAuthenticated()) return;
      const input = e.target;
      const accepted = await acceptFile(input.files[0]);
      if (!accepted) input.value = '';
    }
  };

  const handleSubmit = () => {
    if (!ensureAuthenticated()) return;
    if (selectedFile) {
      const task = uploadTaskRef.current?.signature === fileSignatureOf(selectedFile)
        ? uploadTaskRef.current
        : null;
      if (task) task.handedOff = true;
      uploadTaskRef.current = null;
      onUpload(selectedFile, {
        language,
        style,
        wordsPerLine,
        cleanupMode,
        speechFocus,
        spokenLanguage: detectedSpokenLanguage,
        uploadTask: task,
      });
    }
  };

  const resetModal = () => {
    discardUploadTask();
    setSelectedFile(null);
    setStep(1);
    setLanguage('auto');
    setStyle('dynamic');
    setWordsPerLine('dynamic');
    setFileSizeError(null);
    setSearchQuery('');
    setDetectedSpokenLanguage('');
  };

  // Language detection — uploads file first, then calls detect endpoint
  const handleDetectLanguage = async () => {
    if (!ensureAuthenticated()) return
    if (!selectedFile) return
    setIsDetecting(true)
    try {
      const idToken = await getEffectiveAuthToken(currentUser)
      let task = uploadTaskRef.current?.signature === fileSignatureOf(selectedFile)
        ? uploadTaskRef.current
        : startBackgroundUpload(selectedFile)
      let outcome = await task.promise
      if (!outcome.ok && outcome.error?.name !== 'AbortError' && uploadTaskRef.current === task) {
        // A temporary failure: try once more. The resume receipt continues
        // from the bytes storage already confirmed.
        task = startBackgroundUpload(selectedFile, task.durationSeconds)
        outcome = await task.promise
      }
      if (!outcome.ok) {
        // A refused upload already shows its reason on the first step.
        if (outcome.error?.name !== 'AbortError' && uploadTaskRef.current === task) {
          toast({
            variant: 'destructive',
            title: 'Upload failed for detection',
            description: planLimitMessage(outcome.error),
          })
        }
        setIsDetecting(false)
        return
      }
      const uploadData = outcome.data

      // Call detect-language
      const detectData = await apiRequest('/api/detect-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: uploadData.file_id, id_token: idToken }),
        dedupeKey: 'detect-language',
        cancelPrevious: true,
      })
      if (detectData.success && detectData.language) {
        // Try to match Whisper language code to our dropdown values
        const detected = detectData.language.toLowerCase()
        setDetectedSpokenLanguage(detected)
        const allLangs = [...globalLanguages, ...southAsianLanguages]
        const match = allLangs.find(l =>
          l.value === detected ||
          l.value.startsWith(detected) ||
          l.label.toLowerCase().startsWith(detected)
        )
        if (match) {
          setLanguage(match.value)
        } else {
          // Fallback: set as-is if it's a valid value
          setLanguage(detected)
          toast({
            title: 'Language detected',
            description: `${detected}. Please verify in the dropdown.`,
          })
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Could not detect language',
          description: 'Please select manually.',
        })
      }
    } catch (err) {
      console.error('Language detection error:', err)
      notifyApiError(err, 'Language detection failed')
    }
    setIsDetecting(false)
  };

  // Filter languages by search query
  const filterLangs = (langs) => {
    if (!searchQuery.trim()) return langs
    const q = searchQuery.toLowerCase()
    return langs.filter(l => l.label.toLowerCase().includes(q) || l.value.toLowerCase().includes(q))
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        resetModal();
        onClose();
      }
    }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-24px)] overflow-y-auto bg-zinc-900 border-white/10 text-white max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {step === 1 ? 'Upload Video' : 'Caption Settings'}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div
                className={`relative border-2 border-dashed rounded-xl p-5 sm:p-8 text-center transition-all ${dragActive
                  ? 'border-[#F5A623] bg-[#F5A623]/10'
                  : 'border-white/10 hover:border-white/20'
                  }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept={SUPPORTED_VIDEO_ACCEPT}
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                <div className="w-16 h-16 rounded-full bg-[#F5A623]/15 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-[#F5A623]" />
                </div>

                <p className="text-white font-medium mb-1">
                  Drop your video here
                </p>
                <p className="text-gray-500 text-sm mb-4">
                  or click to browse
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    MP4, MOV, WebM, MKV, AVI
                  </span>
                  <span>Best for 15-180 seconds</span>
                    <span>Max 500 MiB</span>
                </div>
              </div>

              {fileSizeError && (
                <DismissibleNotice key={fileSizeError} closeLabel="Close upload notification" onDismiss={() => setFileSizeError(null)} className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  <p className="text-sm text-red-400">{fileSizeError}</p>
                </DismissibleNotice>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-[#F5A623]/15 flex items-center justify-center">
                  <Film className="w-5 h-5 text-[#F5A623]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{selectedFile?.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile?.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-gray-400 hover:text-white"
                >
                  Change
                </Button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Caption output language
                  </label>
                  <button
                    onClick={handleDetectLanguage}
                    disabled={isDetecting}
                    className="flex items-center gap-1.5 text-xs text-[#F5A623] hover:text-[#D4891A] transition-colors disabled:opacity-50"
                  >
                    {isDetecting ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting...</>
                    ) : (
                      <><Wand2 className="w-3.5 h-3.5" /> Auto-detect</>
                    )}
                  </button>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger aria-label="Caption output language" className="bg-zinc-800 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-white/10 max-h-80">
                    {/* Search input */}
                    <div className="px-2 pb-2">
                      <input
                        type="text"
                        placeholder="Search languages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md bg-zinc-700 border border-white/10 text-white text-sm placeholder-gray-500 outline-none focus:border-[#F5A623]"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <SelectItem value="auto" className="text-white hover:bg-white/10 font-medium">
                      🎯 Keep original speech language (auto-detect)
                    </SelectItem>
                    {filterLangs(globalLanguages).length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-[#F5A623] text-xs font-semibold uppercase tracking-wider px-2 mt-2">Global Languages</SelectLabel>
                        {filterLangs(globalLanguages).map(lang => (
                          <SelectItem
                            key={lang.value}
                            value={lang.value}
                            className="text-white hover:bg-white/10"
                          >
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {filterLangs(southAsianLanguages).length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-orange-400 text-xs font-semibold uppercase tracking-wider px-2 mt-2">South Asian Languages</SelectLabel>
                        {filterLangs(southAsianLanguages).map(lang => (
                          <SelectItem
                            key={lang.value}
                            value={lang.value}
                            className="text-white hover:bg-white/10"
                          >
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-[11px] leading-5 text-gray-500">Choosing another language creates an editable translation track and keeps the original transcript. Translation availability varies by language.</p>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Max Lines
                </label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger aria-label="Max lines" className="bg-zinc-800 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-white/10">
                    <SelectItem value="single_line" className="text-white hover:bg-white/10">1 (Single Line)</SelectItem>
                    <SelectItem value="double_line" className="text-white hover:bg-white/10">2 (Double Line)</SelectItem>
                    <SelectItem value="dynamic" className="text-white hover:bg-white/10">1-2 lines (dynamic)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    Words Per Line
                  </label>
                  {wordsPerLine === 'dynamic' && (
                    <button
                      onClick={() => setShowDynamicInfo(v => !v)}
                      className="flex items-center gap-1 text-xs text-[#F5A623] hover:text-[#D4891A] transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      How it works
                    </button>
                  )}
                </div>
                <Select value={wordsPerLine} onValueChange={(v) => { setWordsPerLine(v); setShowDynamicInfo(false); }}>
                  <SelectTrigger aria-label="Words per line" className="bg-zinc-800 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-white/10">
                    <SelectItem value="1" className="text-white hover:bg-white/10">1 word (Fast-paced)</SelectItem>
                    <SelectItem value="1-2" className="text-white hover:bg-white/10">1-2 words (Punchy)</SelectItem>
                    <SelectItem value="2-3" className="text-white hover:bg-white/10">2-3 words (Standard)</SelectItem>
                    <SelectItem value="3-5" className="text-white hover:bg-white/10">3-5 words (Long)</SelectItem>
                    <SelectItem value="5-6" className="text-white hover:bg-white/10">5-6 words (Template fit)</SelectItem>
                    <SelectItem value="dynamic" className="text-white hover:bg-white/10">
                      Dynamic (Auto) - Recommended
                    </SelectItem>
                  </SelectContent>
                </Select>

                {wordsPerLine === 'dynamic' && showDynamicInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-3 rounded-lg bg-[#F5A623]/10 border border-[#F5A623]/20 text-xs text-gray-300 space-y-1.5"
                  >
                    <p className="font-semibold text-[#F5A623]">How Dynamic (Auto) works:</p>
                    <p>Uses available word-level audio timestamps to help synchronize captions for review.</p>
                    <p>Follows punctuation, speech pauses and natural phrases instead of a fixed word count.</p>
                    <p>Uses phrase-sized chunks unless punctuation or a long silence creates a natural break.</p>
                    <p>For punchier captions, choose a shorter fixed range before generating.</p>
                  </motion.div>
                )}
              </div>

              <div>
                <label htmlFor="speech-focus" className="mb-2 block text-sm text-gray-400">Speech focus</label>
                <select id="speech-focus" aria-label="Speech focus" value={speechFocus} onChange={event => setSpeechFocus(event.target.value)} className="mb-2 w-full rounded-md border border-white/10 bg-zinc-800 p-2 text-sm text-white">
                  <option value="main">Main voice — reduce quiet background speech</option>
                  <option value="all">All voices — keep dialogue and quiet speech</option>
                </select>
                <p className="mb-4 text-xs text-gray-500">Main voice excludes brief, isolated quiet speech at the beginning or end. Original video audio is preserved.</p>
                <label htmlFor="caption-cleanup" className="mb-2 block text-sm text-gray-400">Caption wording</label>
                <select id="caption-cleanup" aria-label="Caption wording" value={cleanupMode} onChange={event => setCleanupMode(event.target.value)} className="w-full rounded-md border border-white/10 bg-zinc-800 p-2 text-sm text-white">
                  <option value="clean">Clean — remove clear hesitations</option>
                  <option value="verbatim">Verbatim — keep fillers and repetitions</option>
                </select>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={isUploading}
                className="w-full bg-white hover:bg-gray-100 text-black font-semibold py-6 rounded-[4px]"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Captions
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
