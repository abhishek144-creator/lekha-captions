import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import {
  FileText,
  FileJson,
  Video,
  Lock
} from 'lucide-react';
import { motion } from 'framer-motion';

import { Progress } from "@/components/ui/progress";

// Simple queue system to prevent server overload
const exportQueue = {
  queue: [],
  isProcessing: false,
  maxConcurrent: 2,
  currentCount: 0,

  add(exportFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn: exportFn, resolve, reject });
      this.processNext();
    });
  },

  async processNext() {
    if (this.currentCount >= this.maxConcurrent || this.queue.length === 0) return;

    this.currentCount++;
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.currentCount--;
      this.processNext();
    }
  }
};

export default function ExportPanel({ open, onClose, captions, captionStyle, videoUrl, projectId, fileId, originalFileName, onUpgradeClick }) {
  const { currentUser, userData } = useAuth();
  // Use auth context directly for consistent, up-to-date auth & credit checks
  const isSignedIn = !!currentUser;

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [waitStartTime, setWaitStartTime] = useState(null);
  const [showServerBusy, setShowServerBusy] = useState(false);
  const [exportExpiry, setExportExpiry] = useState(null);

  const generateSRT = () => {
    if (!captions || captions.length === 0) return '';

    return captions.filter(cap => cap && cap.text && !cap.isTextElement).map((caption, index) => {
      const formatTime = (seconds) => {
        const hrs = Math.floor((seconds || 0) / 3600);
        const mins = Math.floor(((seconds || 0) % 3600) / 60);
        const secs = Math.floor((seconds || 0) % 60);
        const ms = Math.floor(((seconds || 0) % 1) * 1000);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
      };

      return `${index + 1}\n${formatTime(caption.start_time)} --> ${formatTime(caption.end_time)}\n${caption.text}\n`;
    }).join('\n');
  };

  const generatePlainText = () => {
    if (!captions || captions.length === 0) return '';
    return captions.filter(cap => cap && cap.text && !cap.isTextElement).map(c => c.text).join('\n');
  };

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSRT = () => {
    const srt = generateSRT();
    downloadFile(srt, 'captions.srt', 'text/plain');
  };

  const handleDownloadText = () => {
    const text = generatePlainText();
    downloadFile(text, 'captions.txt', 'text/plain');
  };

  // Unlock for: free plan users with credits > 0, or active subscription users
  // If signed in but Firestore data hasn't loaded yet, default to unlocked (optimistic)
  const isPlanActive = (() => {
    if (!isSignedIn) return false;
    // userData not loaded yet — assume active until we know otherwise
    if (!userData) return true;
    // Has remaining credits (free plan or subscription with credits)
    if (userData.credits_remaining > 0) return true;
    // Has active subscription (weekly/monthly not expired)
    if (userData.subscription_tier && userData.subscription_tier !== 'free') {
      if (!userData.subscription_expiry) return true;
      return new Date(userData.subscription_expiry) > new Date();
    }
    return false;
  })();

  const handleExportVideo = async (quality) => {
    if (!fileId) {
      alert('No video uploaded. Please upload a video first.');
      return;
    }
    if (!captions || captions.length === 0) {
      alert('No captions to export');
      return;
    }

    setIsExporting(true);
    setProgress(10);
    setStatusMessage('Preparing export...');

    try {
      setProgress(20);
      setStatusMessage('Sending to render engine...');

      const videoEl = document.querySelector('video');
      const container = videoEl?.parentElement;
      if (!videoEl || !container) {
        alert('Video player not found. Please make sure the video is loaded and try again.');
        setIsExporting(false);
        setProgress(0);
        setStatusMessage('');
        return;
      }
      const cw = container?.offsetWidth || 1;
      const ch = container?.offsetHeight || 1;

      const containerRect = container?.getBoundingClientRect();

      const vnw = videoEl?.videoWidth || cw;
      const vnh = videoEl?.videoHeight || ch;
      const vAspect = vnw / vnh;
      const cAspect = cw / ch;
      let renderW, renderH, offsetX, offsetY;
      if (vAspect > cAspect) {
        renderW = cw; renderH = cw / vAspect; offsetX = 0; offsetY = (ch - renderH) / 2;
      } else {
        renderH = ch; renderW = ch * vAspect; offsetX = (cw - renderW) / 2; offsetY = 0;
      }

      const containerToVideo = (xPct, yPct) => {
        const xPx = (xPct / 100) * cw;
        const yPx = (yPct / 100) * ch;
        return {
          x: Math.max(0, Math.min(100, ((xPx - offsetX) / renderW) * 100)),
          y: Math.max(0, Math.min(100, ((yPx - offsetY) / renderH) * 100))
        };
      };

      // Capture exact word positions from DOM
      const captureLayout = (caps) => {
        const layout = {};
        if (!container || !containerRect) return layout;

        caps.forEach(cap => {
          const capId = cap.id;
          if (cap.words && cap.words.length > 0) {
            cap.words.forEach((_, wIdx) => {
              const key = `${capId}-${wIdx}`;
              const el = container.querySelector(`[data-word-key="${key}"]`);
              if (el) {
                const rect = el.getBoundingClientRect();

                // Calculate center relative to container
                const centerX = rect.left + rect.width / 2 - containerRect.left;
                const centerY = rect.top + rect.height / 2 - containerRect.top;

                // Convert to video % coordinates
                const pos = containerToVideo(
                  (centerX / containerRect.width) * 100,
                  (centerY / containerRect.height) * 100
                );

                // Calculate width/height in video %
                // note: we need scaled width/height relative to RENDERED video area
                const widthPct = (rect.width / renderW) * 100;
                const heightPct = (rect.height / renderH) * 100;

                layout[key] = {
                  x: pos.x,
                  y: pos.y,
                  w: widthPct,
                  h: heightPct,
                  // Also capture rotation if we ever need it, but for now 0
                  rot: 0
                };
              }
            });
          } else {
            // Handle whole caption fallback if needed, but we focused on word-level highlight
          }
        });
        return layout;
      };

      const wordLayouts = captureLayout(captions);

      // Bug 9: Warn if word layout capture returned nothing despite captions having words
      const captionsWithWords = captions.filter(c => c.words && c.words.length > 0 && !c.isTextElement);
      const layoutKeys = Object.keys(wordLayouts).length;
      if (captionsWithWords.length > 0 && layoutKeys === 0) {
        console.warn('[Export] Word layout capture returned 0 entries. Export will use fallback position-based rendering. Make sure the video player is fully visible before exporting.');
        setStatusMessage('Note: Using fallback positioning (scroll video into view for best results)');
      } else {
        console.log(`[Export] Captured ${layoutKeys} word layout entries for ${captionsWithWords.length} captions.`);
      }

      const patchWordStyles = (ws) => {
        if (!ws || Object.keys(ws).length === 0) return ws;
        if (!container || !containerRect) return ws;
        const patched = {};
        for (const [k, v] of Object.entries(ws)) {
          if (v.x !== undefined || v.y !== undefined) {
            const wordEl = container.querySelector(`[data-word-key="${k}"]`);
            if (wordEl) {
              const wordRect = wordEl.getBoundingClientRect();
              const centerX = wordRect.left + wordRect.width / 2 - containerRect.left;
              const centerY = wordRect.top + wordRect.height / 2 - containerRect.top;
              const vidPos = containerToVideo(
                (centerX / containerRect.width) * 100,
                (centerY / containerRect.height) * 100
              );
              patched[k] = {
                ...v,
                abs_x_pct: vidPos.x,
                abs_y_pct: vidPos.y
              };
            } else if (v.abs_x_pct !== undefined && v.abs_y_pct !== undefined) {
              const vidPos = containerToVideo(v.abs_x_pct, v.abs_y_pct);
              patched[k] = { ...v, abs_x_pct: vidPos.x, abs_y_pct: vidPos.y };
            } else {
              const containerXPct = ((v.x || 0) / cw) * 100;
              const containerYPct = ((v.y || 0) / ch) * 100;
              const vidFallback = containerToVideo(
                (captionStyle?.position_x ?? 50) + containerXPct,
                (captionStyle?.position_y ?? 75) + containerYPct
              );
              patched[k] = { ...v, abs_x_pct: vidFallback.x, abs_y_pct: vidFallback.y };
            }
          } else if (v.abs_x_pct !== undefined && v.abs_y_pct !== undefined) {
            const vidPos = containerToVideo(v.abs_x_pct, v.abs_y_pct);
            patched[k] = { ...v, abs_x_pct: vidPos.x, abs_y_pct: vidPos.y };
          } else {
            patched[k] = v;
          }
        }
        return patched;
      };

      const idToken = currentUser?.accessToken || await currentUser?.getIdToken();

      const exportData = {
        file_id: fileId,
        id_token: idToken || '',
        quality,
        captions: captions.filter(c => c && c.text).map(cap => {
          const isText = cap.isTextElement;
          const cs = cap.customStyle || {};
          return {
            id: cap.id,
            text: cap.text,
            start_time: cap.start_time,
            end_time: cap.end_time,
            animation: cap.animation || 'none',
            is_text_element: !!isText,
            custom_style: isText ? (() => {
              const teVidPos = containerToVideo(cs.left ?? 50, cs.top ?? 50);
              return {
                position_x: teVidPos.x, position_y: teVidPos.y,
                font_family: cs.fontFamily || 'Inter',
                font_size: cs.fontSize || 18,
                font_weight: cs.fontWeight || '500',
                font_style: cs.fontStyle || 'normal',
                text_color: cs.color || '#ffffff',
                has_background: cs.hasBackground !== false,
                background_color: cs.backgroundColor || '#000000',
                background_opacity: cs.backgroundOpacity ?? 0.6,
                background_h_multiplier: cs.backgroundHMultiplier || 1.2,
                text_align: cs.textAlign || 'center',
                text_transform: cs.textTransform || 'none',
                padding: cs.padding ?? 8,
                has_stroke: cs.hasStroke || false,
                stroke_width: cs.strokeWidth || 1,
                stroke_color: cs.strokeColor || '#000000',
                has_shadow: cs.hasShadow || false,
                shadow_color: cs.shadowColor || '#000000',
                shadow_blur: cs.shadowBlur || 4,
                shadow_offset_x: cs.shadowOffsetX || 0,
                shadow_offset_y: cs.shadowOffsetY || 2,
                letter_spacing: cs.letterSpacing || 0,
                effect_type: cs.effectType || 'none',
                effect_offset: cs.effectOffset ?? 50,
                effect_direction: cs.effectDirection ?? -45,
                effect_blur: cs.effectBlur ?? 50,
                effect_transparency: cs.effectTransparency ?? 40,
                effect_thickness: cs.effectThickness ?? 50,
                effect_intensity: cs.effectIntensity ?? 50,
                effect_color: cs.effectColor || '#000000'
              };
            })() : null,
            word_styles: patchWordStyles(cap.wordStyles || {}),
            words: cap.words || []
          };
        }),
        style: {
          font_family: captionStyle?.font_family || 'Inter',
          font_size: captionStyle?.font_size || 18,
          font_weight: captionStyle?.font_weight || '500',
          font_style: captionStyle?.font_style || 'normal',
          line_spacing: captionStyle?.line_spacing || 1.4,
          text_color: captionStyle?.text_color || '#ffffff',
          text_gradient: captionStyle?.text_gradient || '',
          text_opacity: captionStyle?.text_opacity ?? 1,
          highlight_color: captionStyle?.highlight_color || '',
          highlight_gradient: captionStyle?.highlight_gradient || '',
          // Use explicit boolean — templates without bg set has_background:false after hard reset
          has_background: !!captionStyle?.has_background,
          background_opacity: captionStyle?.background_opacity ?? 0.7,
          background_color: captionStyle?.background_color || '#000000',
          has_stroke: captionStyle?.has_stroke || false,
          stroke_width: captionStyle?.stroke_width || 1,
          stroke_color: captionStyle?.stroke_color || '#000000',
          has_shadow: captionStyle?.has_shadow || false,
          shadow_color: captionStyle?.shadow_color || '#000000',
          shadow_blur: captionStyle?.shadow_blur || 4,
          shadow_offset_x: captionStyle?.shadow_offset_x || 0,
          shadow_offset_y: captionStyle?.shadow_offset_y || 2,
          has_animation: captionStyle?.has_animation || false,
          text_align: captionStyle?.text_align || 'center',
          text_case: captionStyle?.text_case || 'none',
          is_caps: captionStyle?.is_caps || false,
          is_bold: captionStyle?.is_bold || false,
          effect_type: captionStyle?.effect_type || 'none',
          effect_offset: captionStyle?.effect_offset ?? 50,
          effect_direction: captionStyle?.effect_direction ?? -45,
          effect_blur: captionStyle?.effect_blur ?? 50,
          effect_transparency: captionStyle?.effect_transparency ?? 40,
          effect_thickness: captionStyle?.effect_thickness ?? 50,
          effect_intensity: captionStyle?.effect_intensity ?? 50,
          effect_color: captionStyle?.effect_color || '#000000',
          ...(() => {
            const capVidPos = containerToVideo(captionStyle?.position_x ?? 50, captionStyle?.position_y ?? 75);
            return { position_x: capVidPos.x, position_y: capVidPos.y };
          })(),
          letter_spacing: captionStyle?.letter_spacing || 0,
          word_spacing: captionStyle?.word_spacing || 1,
          background_padding: captionStyle?.background_padding ?? 6,
          background_h_multiplier: captionStyle?.background_h_multiplier ?? 0.99,
          // Template metadata — passed through so the backend knows the active template
          template_id: captionStyle?.template_id || '',
          secondary_color: captionStyle?.secondary_color || '',
          show_inactive: captionStyle?.show_inactive !== false,
          preview_height: renderH
        },
        word_layouts: wordLayouts
      };

      setProgress(0);
      setStatusMessage('Rendering captions onto video...');

      // Start simulated progress for smooth UI
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 30) return prev + (Math.random() * 5 + 2); // Fast to 30%
          if (prev < 50) return prev + (Math.random() * 2 + 1); // Medium to 50%
          if (prev < 90) return prev + 0.5; // Slow crawl to 90%
          return prev;
        });
      }, 500);

      let response;
      try {
        response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(exportData)
        });
      } finally {
        clearInterval(progressInterval);
      }

      // Safely parse response — backend may return non-JSON on crashes
      let result;
      const responseText = await response.text();
      try {
        result = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(responseText || `Server error (${response.status})`);
      }

      if (!result.success) {
        // Check for specific upgrade/expiry errors from backend
        const detail = result.detail || result.error || '';
        if (detail.includes('PLAN_EXPIRED') || detail.includes('UPGRADE_REQUIRED')) {
          setIsExporting(false);
          setProgress(0);
          setStatusMessage('');
          // Show user-friendly message first
          if (detail.includes('PLAN_EXPIRED')) {
            alert('Your plan has expired and you have no credits left. Please renew to continue exporting.');
          } else {
            alert('You have no credits remaining. Please upgrade your plan to continue exporting.');
          }
          // Then open the pricing/upgrade modal
          if (onUpgradeClick) {
            onUpgradeClick();
          }
          return;
        }
        throw new Error(result.error || 'Export failed');
      }

      // Store expiry info
      if (result.retention_hours) {
        setExportExpiry({ hours: result.retention_hours, expiresAt: result.expires_at })
      }

      setProgress(90);
      setStatusMessage('Preparing download...');

      // Firebase Storage URLs are absolute; local URLs are relative
      const downloadUrl = result.video_url
      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok) {
        throw new Error(`Video download failed (${videoResponse.status}). Please try again.`);
      }
      const blob = await videoResponse.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = originalFileName ? originalFileName.replace(/\.[^/.]+$/, '') : 'export';
      a.download = `${baseName}_captioned.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      setStatusMessage('Export complete!');
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
      setProgress(0);
      setStatusMessage('');
    }
  };

  const exportOptions = [
    {
      icon: Video,
      title: 'Export Video (4K)',
      description: 'Ultra HD MP4 render',
      action: () => handleExportVideo('4k'),
      gradient: 'from-rose-500 to-pink-600',
      requiresPlan: true
    },
    {
      icon: Video,
      title: 'Export Video (1080p)',
      description: 'High quality MP4 render',
      action: () => handleExportVideo('1080p'),
      gradient: 'from-orange-500 to-red-500',
      requiresPlan: true
    },
    {
      icon: Video,
      title: 'Export Video (720p)',
      description: 'Standard HD MP4 render',
      action: () => handleExportVideo('720p'),
      gradient: 'from-yellow-500 to-orange-500',
      requiresPlan: true
    },
    {
      icon: FileText,
      title: 'SRT File',
      description: 'Standard subtitle format',
      action: handleDownloadSRT,
      gradient: 'from-zinc-600 to-zinc-400',
      requiresPlan: false
    },
    {
      icon: FileJson,
      title: 'Plain Text',
      description: 'Just the caption text',
      action: handleDownloadText,
      gradient: 'from-blue-500 to-cyan-500',
      requiresPlan: false
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="bg-zinc-900 border-white/10 text-white w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold text-white">
            Export
          </SheetTitle>
          <p className="text-sm text-gray-500 mt-1">Choose your export format below</p>
        </SheetHeader>

        {isExporting ? (
          <div className="mt-8 p-6 rounded-xl bg-white/[0.03] border border-white/10 text-center space-y-4 relative overflow-hidden">
            {/* Subtle glow animation */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
            </div>

            <div className="relative z-10">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
                <div className="absolute inset-0 rounded-full border-t-2 border-white/60 animate-spin"></div>
                <div className="absolute inset-0 rounded-full border-r-2 border-white/20 animate-spin" style={{ animationDuration: '1.5s' }}></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {Math.round(progress)}%
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-medium text-white mb-1">Rendering Video</h3>
                <p className="text-sm text-gray-400 animate-pulse">{statusMessage}</p>
                {showServerBusy && (
                  <p className="text-xs text-amber-400 mt-2 animate-pulse">
                    Server is busy • Estimated time remaining: ~2 minutes
                  </p>
                )}
              </div>

              <div className="relative mt-4">
                <Progress value={progress} className="h-2 bg-zinc-700" indicatorClassName="bg-white" />
                {/* Shimmer effect on progress bar */}
                <div className="absolute inset-0 overflow-hidden rounded-full">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                </div>
              </div>
            </div>

            <style>{`
              @keyframes shimmer {
                100% { transform: translateX(100%); }
              }
            `}</style>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {/* Not signed in → Sign up prompt */}
            {!isSignedIn && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center mb-4">
                <Lock className="w-8 h-8 text-white/60 mx-auto mb-2" />
                <p className="text-sm text-white font-medium mb-1">Sign up to export</p>
                <p className="text-xs text-gray-400 mb-3">Create a free account to get 3 free export credits</p>
                <button
                  onClick={() => window.location.href = '/login'}
                  className="w-full py-2 rounded-lg bg-white hover:bg-gray-100 text-black text-sm font-semibold transition-colors"
                >
                  Sign up free
                </button>
              </div>
            )}
            {/* Signed in but no credits / plan expired → Upgrade prompt */}
            {isSignedIn && !isPlanActive && (
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3 mb-4">
                <Lock className="w-4 h-4 text-yellow-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-300 font-medium">Plan expired or no credits</p>
                  <p className="text-xs text-yellow-400/70">Upgrade to export your captions</p>
                </div>
                <Button
                  size="sm"
                  onClick={onUpgradeClick}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold shrink-0"
                >
                  Upgrade
                </Button>
              </div>
            )}
            {/* Video exports */}
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium px-1">Video Export</p>
            {exportOptions.filter(o => o.requiresPlan).map((option, idx) => {
              const isLocked = !isPlanActive;
              return (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  onClick={isLocked ? onUpgradeClick : option.action}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 group ${isLocked
                    ? 'bg-white/[0.01] border-white/5 opacity-60 cursor-not-allowed'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/15 cursor-pointer'
                    }`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${option.gradient} p-0.5 ${isLocked ? 'opacity-50' : ''}`}>
                    <div className="w-full h-full rounded-xl bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                      {isLocked ? <Lock className="w-5 h-5 text-gray-400" /> : <option.icon className="w-5 h-5 text-white" />}
                    </div>
                  </div>
                  <div className="text-left flex-1">
                    <p className={`font-medium ${isLocked ? 'text-gray-500' : 'text-white'}`}>{option.title}</p>
                    <p className="text-sm text-gray-500">{isLocked ? 'Requires active plan' : option.description}</p>
                  </div>
                </motion.button>
              );
            })}

            {/* Caption file exports */}
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium px-1 pt-2">Caption Files</p>
            {exportOptions.filter(o => !o.requiresPlan).map((option, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (idx + 3) * 0.07 }}
                onClick={option.action}
                className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 transition-all flex items-center gap-4 group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${option.gradient} p-0.5`}>
                  <div className="w-full h-full rounded-xl bg-zinc-900 flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                    <option.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-white">{option.title}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Caption count */}
        <div className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Total Captions</span>
            <span className="text-lg font-bold text-white">{captions?.length || 0}</span>
          </div>
        </div>

        {/* Export expiry notice */}
        {exportExpiry && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300">
              Download link valid for <span className="font-semibold">{exportExpiry.hours} hours</span>. Save your exported video before it expires.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}