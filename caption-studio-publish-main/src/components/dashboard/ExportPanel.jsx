import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import {
  ArrowDownToLine,
  BadgeCheck,
  Clock3,
  Crown,
  FileText,
  FileJson,
  Video,
  Lock,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '@/components/ui/use-toast';
import { apiRequest } from '@/lib/apiClient';
import { notifyApiError } from '@/lib/notifyApiError';
import { getClientContext, trackAnalytics } from '@/lib/analytics';
import { isFeatureEnabled } from '@/lib/featureFlags';

import { Progress } from "@/components/ui/progress";

// ─── TEMPLATE CANONICAL STYLES ────────────────────────────────────────────────
// Ensures the export always uses the correct template-defined visual properties
// (background, stroke, shadow) even if the user's React state is stale from
// applying the template before these properties were added to the template def.
// User-customized properties (font, color, position) are NOT overridden here.
const TEMPLATE_CANONICAL_STYLES = {
  't-115': { has_shadow: true, shadow_color: '#39FF14', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0, has_background: false, has_stroke: false },
  't-109': { has_shadow: true, shadow_color: '#E01A1A', shadow_blur: 0, shadow_offset_x: 3, shadow_offset_y: 3, has_background: false, has_stroke: false },
  't-26':  { has_background: true, background_color: '#e8e8e8', background_opacity: 1.0, has_stroke: true, stroke_color: '#000000', stroke_width: 1, has_shadow: false },
  't-102': { has_background: true, background_color: '#FFFFFF', background_opacity: 1.0, background_padding: 10, has_stroke: false, has_shadow: false },
  't-36':  { has_background: false, has_stroke: false, has_shadow: false },
  't-105': { has_stroke: true, stroke_color: '#000000', stroke_width: 1, has_shadow: true, shadow_color: '#000000', shadow_blur: 2, shadow_offset_x: 2, shadow_offset_y: 2, has_background: false },
  't-9':   { has_shadow: true, shadow_color: '#ff4500', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0, has_background: false, has_stroke: false },
  't-124': { has_shadow: true, shadow_color: '#ffffff', shadow_blur: 0, shadow_offset_x: 4, shadow_offset_y: 4, has_background: false, has_stroke: false },
  't-16':  { has_background: false, has_stroke: false, has_shadow: false },
  't-110': { has_background: false, has_stroke: false, has_shadow: false },
  't-119': { has_background: false, has_stroke: false, has_shadow: false },
  't-12':  { has_shadow: true, shadow_color: '#cc0000', shadow_blur: 10, shadow_offset_x: 0, shadow_offset_y: 0, has_background: false, has_stroke: false },
  't-106': { has_shadow: true, shadow_color: '#000000', shadow_blur: 3, shadow_offset_x: 1, shadow_offset_y: 2, has_background: false, has_stroke: false },
  't-52':  { has_background: false, has_stroke: false, has_shadow: false },
  't-103': { has_background: true, background_color: '#1e1e1e', background_opacity: 0.85, background_padding: 10, has_stroke: false, has_shadow: false },
  't-112': { has_background: false, has_stroke: false, has_shadow: false },
  't-104': { has_stroke: true, stroke_color: '#B28DFF', stroke_width: 2, has_background: false, has_shadow: false },
  't-111': { has_background: false, has_stroke: false, has_shadow: false },
  't-T5':  { has_background: true, background_color: '#ECF00F', background_opacity: 1.0, background_padding: 10, has_stroke: false, has_shadow: false },
  't-95':  { has_background: false, has_stroke: false, has_shadow: false },
  't-T1':  { has_background: false, has_stroke: false, has_shadow: false },
  't-T4':  { has_background: false, has_stroke: false, has_shadow: false },
  't-56':  { has_background: false, has_stroke: false, has_shadow: false },
  't-T3':  { has_background: false, has_stroke: false, has_shadow: false },
  't-57':  { has_shadow: true, shadow_color: '#00ffff', shadow_blur: 0, shadow_offset_x: 2, shadow_offset_y: 0, has_background: false, has_stroke: false },
  't-37':  { has_background: false, has_stroke: false, has_shadow: false },
};

function isAdvancedTemplateId(templateId) {
  return /^t\d{2}$/.test(String(templateId || ''));
}

function getMaxRenderedFontSize(root) {
  if (!root) return 0;
  const candidates = [root, ...root.querySelectorAll('*')];
  let maxFontSize = 0;
  candidates.forEach((node) => {
    const fontSize = parseFloat(window.getComputedStyle(node).fontSize || '');
    if (Number.isFinite(fontSize) && fontSize > maxFontSize) {
      maxFontSize = fontSize;
    }
  });
  return maxFontSize;
}

// Simple queue system to prevent server overload
const exportQueue = {
  queue: [],
  isProcessing: false,
  maxConcurrent: 2,
  currentCount: 0,

  add(exportFn) {
    if (this.queue.length >= 50) {
      return Promise.reject(new Error('Export queue is full. Please wait for current exports to finish.'));
    }
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
  const exportInFlightRef = useRef(false);
  const exportAbortRef = useRef(null);
  const backgroundNoticeShownRef = useRef(false);

  const throwIfAborted = (signal) => {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
  };

  const abortableSleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Export cancelled', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Export cancelled', 'AbortError'));
    }, { once: true });
  });

  const pollExportStatus = async (jobId, authHeaders = {}, timeoutMs = 2 * 60 * 1000, signal = null) => {
    const startedAt = Date.now();
    let hadTransientFailure = false;
    while (Date.now() - startedAt < timeoutMs) {
      throwIfAborted(signal);
      let statusPayload;
      try {
        statusPayload = await apiRequest(`/api/export-status/${jobId}`, {
          headers: authHeaders,
          signal
        });
        throwIfAborted(signal);
        if (hadTransientFailure) {
          setStatusMessage('Connection restored. Finalizing export status...');
          hadTransientFailure = false;
        }
      } catch (err) {
        throwIfAborted(signal);
        hadTransientFailure = true;
        setStatusMessage('Reconnecting to export status...');
        await abortableSleep(1500, signal);
        continue;
      }
      const status = (statusPayload?.status || '').toLowerCase();
      if (status === 'queued') {
        setStatusMessage('Preparing render job...');
        setProgress(prev => Math.max(prev, 25));
      } else if (status === 'processing') {
        setStatusMessage('Rendering in progress...');
        setProgress(prev => Math.max(prev, 55));
      } else if (status === 'finalizing') {
        setStatusMessage('Finalizing your export...');
        setProgress(prev => Math.max(prev, 82));
      } else if (status === 'completed') {
        setProgress(prev => Math.max(prev, 90));
        return;
      } else if (status === 'failed') {
        throw new Error(statusPayload?.error || 'Export failed');
      }
      await abortableSleep(1200, signal);
    }
    throw new Error('Export status check timed out. Please retry.');
  };

  useEffect(() => {
    if (!isExporting || !waitStartTime) return;

    const timer = setInterval(() => {
      const elapsedMs = Date.now() - waitStartTime;
      if (elapsedMs > 30000) setShowServerBusy(true);
      if (elapsedMs > 90000) {
        setStatusMessage('Almost there... finalizing your video render');
      } else if (elapsedMs > 45000) {
        setStatusMessage('Rendering in progress... this can take up to 2 minutes');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isExporting, waitStartTime]);

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

  const handleSheetOpenChange = (nextOpen) => {
    if (nextOpen) return;
    if (!nextOpen && exportInFlightRef.current && !backgroundNoticeShownRef.current) {
      backgroundNoticeShownRef.current = true;
      toast({
        title: 'Export still running',
        description: 'You can keep editing. The video export will continue in the background.',
        duration: 10000,
      });
    }
    onClose?.();
  };

  // Unlock for: free plan users with credits > 0, or active subscription users
  // If signed in but Firestore data hasn't loaded yet, default to unlocked (optimistic)
  const isPlanActive = (() => {
    if (!isSignedIn) return false;
    if (!userData) return true;
    if (userData.credits_remaining > 0) return true;
    if (userData.subscription_tier && userData.subscription_tier !== 'free') {
      if (!userData.subscription_expiry) return true;
      return new Date(userData.subscription_expiry) > new Date();
    }
    return false;
  })();

  // 4K is available for Creator and above (matches pricing promises)
  const is4kAllowed = (() => {
    if (!isSignedIn || !userData) return false;
    const tier = userData.subscription_tier || 'free';
    const normalizedTier = tier.toLowerCase();
    return [
      'creator',
      'creator_yearly',
      'pro',
      'pro_yearly',
      'pro_plus',
      'professional',
      'business'
    ].includes(normalizedTier);
  })();

  const handleExportVideo = async (quality) => {
    if (exportInFlightRef.current) {
      toast({
        title: 'Export already running',
        description: 'Please wait for the current export to finish.',
      });
      return;
    }
    if (!fileId) {
      toast({
        variant: 'destructive',
        title: 'No video uploaded',
        description: 'Please upload a video first.',
      });
      return;
    }
    if (!captions || captions.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No captions to export',
      });
      return;
    }

    setIsExporting(true);
    exportInFlightRef.current = true;
    backgroundNoticeShownRef.current = false;
    exportAbortRef.current?.abort();
    const exportController = new AbortController();
    exportAbortRef.current = exportController;
    setProgress(10);
    setStatusMessage('Preparing export...');
    setWaitStartTime(Date.now());
    setShowServerBusy(false);
    trackAnalytics('funnel.export.started', getClientContext({
      stage: 'export',
      quality,
      plan: userData?.subscription_tier || 'free'
    }));

    try {
      setProgress(20);
      setStatusMessage('Sending to render engine...');

      const videoEl = document.querySelector('video');
      const container = videoEl?.parentElement;
      if (!videoEl || !container) {
        toast({
          variant: 'destructive',
          title: 'Video player not found',
          description: 'Please make sure the video is loaded and try again.',
        });
        setIsExporting(false);
        exportInFlightRef.current = false;
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

      const templateFontEl = container.querySelector('.lekha-applied-advanced-template');
      const previewTemplateFontPx = getMaxRenderedFontSize(templateFontEl);

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
      const authHeaders = idToken ? { Authorization: `Bearer ${idToken}` } : {};
      let effectiveQuality = quality;
      const prefersDataSave = !!navigator?.connection?.saveData;
      const lowBandwidth = (navigator?.connection?.effectiveType || '').includes('2g');
      if ((prefersDataSave || lowBandwidth) && quality === '4k') {
        effectiveQuality = '1080p';
        toast({
          title: 'Adaptive export quality',
          description: 'Network conditions detected. Using 1080p for a faster, safer export.',
        });
      }

      const hasTemplateIdentity = (style = {}) => !!(style?.template_id || style?.template_20_id);
      const captionTemplateSnapshot = captions.find(c => hasTemplateIdentity(c?.applied_template_style))?.applied_template_style;
      const styleTemplateSnapshot = hasTemplateIdentity(captionStyle?.template_snapshot)
        ? captionStyle.template_snapshot
        : captionTemplateSnapshot;
      const baseExportStyle = hasTemplateIdentity(styleTemplateSnapshot)
        ? { ...captionStyle, ...styleTemplateSnapshot }
        : (captionStyle || {});
      const templateOverride = TEMPLATE_CANONICAL_STYLES[baseExportStyle?.template_id || ''] || {};
      const effectiveExportStyle = { ...baseExportStyle, ...templateOverride };
      const activeTemplateSnapshot = hasTemplateIdentity(styleTemplateSnapshot)
        ? styleTemplateSnapshot
        : (hasTemplateIdentity(effectiveExportStyle) ? { ...effectiveExportStyle } : null);

      const exportData = {
        file_id: fileId,
        id_token: idToken || '',
        quality: effectiveQuality,
        captions: captions.filter(c => c && c.text).map(cap => {
          const isText = cap.isTextElement;
          const cs = cap.customStyle || {};
          return {
            id: cap.id,
            text: cap.text,
            start_time: cap.start_time,
            end_time: cap.end_time,
            __templateIndex: !isText ? captions.filter(c => c && !c.isTextElement).findIndex(c => c?.id === cap.id) : undefined,
            animation: cap.animation || 'none',
            is_text_element: !!isText,
            template_id: !isText ? (cap.template_id || activeTemplateSnapshot?.template_id || effectiveExportStyle?.template_id || '') : '',
            template_20_id: !isText ? (cap.template_20_id || activeTemplateSnapshot?.template_20_id || effectiveExportStyle?.template_20_id || '') : '',
            template_source: !isText ? (cap.template_source || activeTemplateSnapshot?.template_source || effectiveExportStyle?.template_source || '') : '',
            template_class: !isText ? (cap.template_class || activeTemplateSnapshot?.template_class || effectiveExportStyle?.template_class || '') : '',
            template_name: !isText ? (cap.template_name || activeTemplateSnapshot?.template_name || effectiveExportStyle?.template_name || '') : '',
            template_layout: !isText ? (cap.template_layout || activeTemplateSnapshot?.template_layout || effectiveExportStyle?.template_layout || '') : '',
            template_effect: !isText ? (cap.template_effect || activeTemplateSnapshot?.template_effect || effectiveExportStyle?.template_effect || '') : '',
            template_markup: !isText ? (cap.template_markup || activeTemplateSnapshot?.template_markup || effectiveExportStyle?.template_markup || '') : '',
            applied_template_style: !isText ? (cap.applied_template_style || activeTemplateSnapshot || null) : null,
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
                shadow_blur: cs.shadowBlur ?? 4,
                shadow_offset_x: cs.shadowOffsetX ?? 0,
                shadow_offset_y: cs.shadowOffsetY ?? 2,
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
        style: (() => {
          // Merge template canonical overrides — ensures correct has_shadow/has_stroke/has_background
          // even when the user's React state was set before these properties were added to the template def.
          const _cs = effectiveExportStyle;
          return {
          font_family: _cs?.font_family || 'Inter',
          font_size: _cs?.font_size || 26,
          font_weight: _cs?.font_weight || '800',
          font_style: _cs?.font_style || 'normal',
          line_spacing: _cs?.line_spacing || 1.4,
          text_color: _cs?.text_color || '#ffffff',
          text_gradient: _cs?.text_gradient || '',
          text_opacity: isAdvancedTemplateId(_cs?.template_id) ? 1 : (_cs?.text_opacity ?? 1),
          highlight_color: _cs?.highlight_color || '',
          highlight_gradient: _cs?.highlight_gradient || '',
          // Use explicit boolean — templates without bg set has_background:false after hard reset
          has_background: !!_cs?.has_background,
          background_opacity: _cs?.background_opacity ?? 0.7,
          background_color: _cs?.background_color || '#000000',
          has_stroke: _cs?.has_stroke || false,
          stroke_width: _cs?.stroke_width || 1,
          stroke_color: _cs?.stroke_color || '#000000',
          has_shadow: _cs?.has_shadow || false,
          shadow_color: _cs?.shadow_color || '#000000',
          shadow_blur: _cs?.shadow_blur ?? 4,
          shadow_offset_x: _cs?.shadow_offset_x ?? 0,
          shadow_offset_y: _cs?.shadow_offset_y ?? 2,
          has_animation: _cs?.has_animation || false,
          text_align: _cs?.text_align || 'center',
          text_case: _cs?.text_case || 'none',
          is_caps: _cs?.is_caps || false,
          is_bold: _cs?.is_bold || false,
          effect_type: _cs?.effect_type || 'none',
          effect_offset: _cs?.effect_offset ?? 50,
          effect_direction: _cs?.effect_direction ?? -45,
          effect_blur: _cs?.effect_blur ?? 50,
          effect_transparency: _cs?.effect_transparency ?? 40,
          effect_thickness: _cs?.effect_thickness ?? 50,
          effect_intensity: _cs?.effect_intensity ?? 50,
          effect_color: _cs?.effect_color || '#000000',
          ...(() => {
            const capVidPos = containerToVideo(_cs?.position_x ?? 50, _cs?.position_y ?? 75);
            return { position_x: capVidPos.x, position_y: capVidPos.y };
          })(),
          letter_spacing: _cs?.letter_spacing || 0,
          word_spacing: _cs?.word_spacing || 1,
          background_padding: _cs?.background_padding ?? 6,
          background_h_multiplier: _cs?.background_h_multiplier ?? 1.05,
          // Template metadata — passed through so the backend knows the active template
          template_id: _cs?.template_id || '',
          template_20_id: _cs?.template_20_id || '',
          template_source: _cs?.template_source || '',
          template_class: _cs?.template_class || '',
          template_name: _cs?.template_name || '',
          template_layout: _cs?.template_layout || '',
          template_effect: _cs?.template_effect || '',
          template_markup: _cs?.template_markup || '',
          template_snapshot: activeTemplateSnapshot || null,
          secondary_color: _cs?.secondary_color || '',
          show_inactive: _cs?.show_inactive !== false,
          preview_width: renderW,
          preview_height: renderH,
          preview_container_width: cw,
          preview_container_height: ch,
          preview_template_font_px: Number.isFinite(previewTemplateFontPx) ? previewTemplateFontPx : 0
          };
        })(),
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

      let result;
      try {
        result = await exportQueue.add(() => apiRequest('/api/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(isFeatureEnabled('canaryExportFlow') ? { 'x-api-version': '2026-04-21' } : {}),
          },
          body: JSON.stringify(exportData)
        }));
      } finally {
        clearInterval(progressInterval);
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
            toast({
              variant: 'destructive',
              title: 'Plan expired',
              description: 'Your plan has expired and you have no credits left. Please renew to continue exporting.',
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'No credits remaining',
              description: 'Please upgrade your plan to continue exporting.',
            });
          }
          // Then open the pricing/upgrade modal
          if (onUpgradeClick) {
            onUpgradeClick();
          }
          return;
        }
        throw new Error(result.error || 'Export failed');
      }

      let resolvedResult = result;
      if (result.export_job_id) {
        await pollExportStatus(result.export_job_id, authHeaders, 2 * 60 * 1000, exportController.signal);
        if (!result.video_url) {
          resolvedResult = await apiRequest(`/api/export-result/${result.export_job_id}`, {
            headers: authHeaders,
            signal: exportController.signal
          });
        }
      }

      // Store expiry info
      if (resolvedResult.retention_hours) {
        setExportExpiry({ hours: resolvedResult.retention_hours, expiresAt: resolvedResult.expires_at })
      }

      setProgress(90);
      setStatusMessage('Preparing download...');

      // Firebase Storage URLs are absolute; local URLs are relative
      const downloadUrl = resolvedResult.video_url
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
      trackAnalytics('funnel.export.success', getClientContext({
        stage: 'export',
        quality: effectiveQuality,
        plan: userData?.subscription_tier || 'free'
      }));

      setProgress(100);
      setStatusMessage('Export complete!');
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error('Export failed:', error);
      trackAnalytics('funnel.export.failed', getClientContext({
        stage: 'export',
        quality,
        plan: userData?.subscription_tier || 'free'
      }));
      notifyApiError(error, 'Export failed');
    } finally {
      setIsExporting(false);
      exportInFlightRef.current = false;
      backgroundNoticeShownRef.current = false;
      if (exportAbortRef.current === exportController) {
        exportAbortRef.current = null;
      }
      setProgress(0);
      setStatusMessage('');
      setWaitStartTime(null);
      setShowServerBusy(false);
    }
  };

  const exportOptions = [
    {
      icon: Video,
      title: '4K Ultra HD',
      description: 'Highest detail MP4 render',
      action: () => handleExportVideo('4k'),
      gradient: 'from-rose-500 to-pink-600',
      requiresPlan: true,
      requiresPro: true,
    },
    {
      icon: Video,
      title: '1080p Full HD',
      description: 'Recommended for social uploads',
      action: () => handleExportVideo('1080p'),
      gradient: 'from-orange-500 to-red-500',
      requiresPlan: true
    },
    {
      icon: Video,
      title: '720p HD',
      description: 'Fast preview-quality export',
      action: () => handleExportVideo('720p'),
      gradient: 'from-yellow-500 to-orange-500',
      requiresPlan: true
    },
    {
      icon: FileText,
      title: 'SRT subtitles',
      description: 'Timeline-ready subtitle file',
      action: handleDownloadSRT,
      gradient: 'from-zinc-600 to-zinc-400',
      requiresPlan: false
    },
    {
      icon: FileJson,
      title: 'Plain text',
      description: 'Clean transcript copy',
      action: handleDownloadText,
      gradient: 'from-blue-500 to-cyan-500',
      requiresPlan: false
    },
  ];

  const captionCount = captions?.filter(cap => cap && !cap.isTextElement)?.length || 0;
  const textLayerCount = captions?.filter(cap => cap?.isTextElement)?.length || 0;
  const planLabel = userData?.subscription_tier
    ? userData.subscription_tier.replace(/_/g, ' ')
    : isSignedIn
      ? 'free'
      : 'guest';

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="bg-[#080808] border-white/10 text-white w-full overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-[520px]">
        <SheetHeader className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.025] p-5 text-left">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#f5a623]/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#f5a623]/15 border border-[#f5a623]/25 flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5 text-[#f5a623]" />
              </div>
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-gray-300">
                {planLabel}
              </span>
            </div>
            <SheetTitle className="mt-4 text-2xl font-black text-white tracking-tight">
              Export your video
            </SheetTitle>
            <p className="text-sm text-gray-400 mt-1">Choose a render quality or download caption files for editing elsewhere.</p>
            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Captions</p>
                <p className="text-lg font-black">{captionCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Text layers</p>
                <p className="text-lg font-black">{textLayerCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Status</p>
                <p className="text-lg font-black">{isPlanActive ? 'Ready' : 'Locked'}</p>
              </div>
            </div>
          </div>
        </SheetHeader>

        {isExporting ? (
          <div className="mt-5 p-6 rounded-[28px] bg-white/[0.035] border border-white/10 text-center space-y-5 relative overflow-hidden">
            {/* Subtle glow animation */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5a623]/10 blur-3xl animate-pulse"></div>
            </div>

            <div className="relative z-10">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border border-white/10"></div>
                <div className="absolute inset-1 rounded-full border-t-2 border-[#f5a623] animate-spin"></div>
                <div className="absolute inset-3 rounded-full border-r-2 border-white/40 animate-spin" style={{ animationDuration: '1.6s' }}></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {Math.round(progress)}%
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-xl font-black text-white mb-1">Rendering your video</h3>
                <p className="text-sm text-gray-400 animate-pulse">{statusMessage || 'Preparing render...'}</p>
                {showServerBusy && (
                  <p className="text-xs text-amber-400 mt-2 animate-pulse">
                    High demand right now - render may take up to about 2 minutes.
                  </p>
                )}
              </div>

              <div className="relative mt-4">
                <Progress value={progress} className="h-2.5 bg-zinc-800" indicatorClassName="bg-[#f5a623]" />
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
          <div className="mt-5 space-y-5">
            {/* Not signed in: Sign up prompt */}
            {!isSignedIn && (
              <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/10 text-center">
                <Lock className="w-8 h-8 text-white/60 mx-auto mb-2" />
                <p className="text-sm text-white font-bold mb-1">Sign up to export</p>
                <p className="text-xs text-gray-400 mb-3">Create a free account to get 3 export credits.</p>
                <button
                  onClick={() => window.location.href = '/login'}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-gray-100 text-black text-sm font-bold transition-colors"
                >
                  Sign up free
                </button>
              </div>
            )}
            {/* Signed in but no credits / plan expired: Upgrade prompt */}
            {isSignedIn && !isPlanActive && (
              <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
                <Lock className="w-4 h-4 text-yellow-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-300 font-bold">Plan expired or no credits</p>
                  <p className="text-xs text-yellow-400/70">Upgrade to export your captions</p>
                </div>
                <Button
                  size="sm"
                  onClick={onUpgradeClick}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold shrink-0 rounded-xl"
                >
                  Upgrade
                </Button>
              </div>
            )}
            {/* Video exports */}
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-[0.22em] font-bold">Video Export</p>
                <p className="text-xs text-gray-500 mt-1">Burn captions into your video.</p>
              </div>
              <Sparkles className="w-4 h-4 text-[#f5a623]" />
            </div>
            {exportOptions.filter(o => o.requiresPlan).map((option, idx) => {
              const isLocked = !isPlanActive || (option.requiresPro && !is4kAllowed);
              const lockReason = !isPlanActive ? 'Requires active plan' : (option.requiresPro && !is4kAllowed) ? 'Creator or Pro plan required' : null;
              return (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  onClick={isLocked ? onUpgradeClick : option.action}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 group text-left ${isLocked
                    ? 'bg-white/[0.025] border-white/8 opacity-70'
                    : 'bg-white/[0.045] border-white/10 hover:bg-white/[0.075] hover:border-[#f5a623]/35 cursor-pointer'
                    }`}
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${option.gradient} p-0.5 ${isLocked ? 'opacity-50' : ''}`}>
                    <div className="w-full h-full rounded-2xl bg-[#101010] flex items-center justify-center group-hover:bg-[#181818] transition-colors">
                      {isLocked ? <Lock className="w-5 h-5 text-gray-400" /> : <option.icon className="w-5 h-5 text-white" />}
                    </div>
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className={`font-black ${isLocked ? 'text-gray-500' : 'text-white'}`}>{option.title}</p>
                    <p className="text-sm text-gray-500">{isLocked ? lockReason : option.description}</p>
                  </div>
                  {!isLocked && <BadgeCheck className="w-5 h-5 text-emerald-400" />}
                  {isLocked && option.requiresPro && <Crown className="w-5 h-5 text-[#f5a623]" />}
                </motion.button>
              );
            })}

            {/* Caption file exports */}
            <div className="flex items-center justify-between px-1 pt-1">
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-[0.22em] font-bold">Caption Files</p>
                <p className="text-xs text-gray-500 mt-1">Download subtitles without rendering video.</p>
              </div>
              <Clock3 className="w-4 h-4 text-gray-500" />
            </div>
            {exportOptions.filter(o => !o.requiresPlan).map((option, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (idx + 3) * 0.07 }}
                onClick={option.action}
                className="w-full p-4 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/20 transition-all flex items-center gap-4 group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${option.gradient} p-0.5`}>
                  <div className="w-full h-full rounded-2xl bg-[#101010] flex items-center justify-center group-hover:bg-[#181818] transition-colors">
                    <option.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="text-left flex-1">
                  <p className="font-black text-white">{option.title}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        <div className="mt-5 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-start gap-3">
            <BadgeCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">Export checklist</p>
              <p className="text-xs text-gray-500 mt-1">
                Captions, text layers, templates, and timing are packaged into the export request.
              </p>
            </div>
          </div>
        </div>

        {/* Export expiry notice */}
        {exportExpiry && (
          <div className="mt-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300">
              Download link valid for <span className="font-semibold">{exportExpiry.hours} hours</span>. Save your exported video before it expires.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
