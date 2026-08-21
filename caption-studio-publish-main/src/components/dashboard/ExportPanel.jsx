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
import { apiFetch, apiRequest, getApiErrorMessage } from '@/lib/apiClient';
import { getClientContext, trackAnalytics } from '@/lib/analytics';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { getEffectiveAuthToken } from '@/lib/devAuth';
import { isSubscriptionExpired } from '@/lib/subscription';
import { buildEmotionalCaptionPlan } from './emotionalTemplateUtils';
import { getBasicTemplateExportEffects } from './basicTemplateCatalog.js';
import {
  buildPlainText,
  buildSrt,
  buildTextElementExportStyle,
  getCaptionedVideoFilename,
  hasExportableVideoContent,
  shouldAttachApiAuth,
} from './exportPipelineUtils';
import {
  ADVANCED_TEMPLATE_EMPHASIS_COLORS,
  RECREATED_ADVANCED_TEMPLATE_IDS,
} from './templateMotionConfig';

import { Progress } from "@/components/ui/progress";

// TESTING ONLY: unlock the export UI for an explicitly configured local test.
// Limits are on by default in every build; a production build cannot bypass
// them even if a VITE_ value is accidentally supplied at build time.
const DISABLE_EXPORT_LIMITS_FOR_TESTING = import.meta.env.DEV && import.meta.env.VITE_DISABLE_EXPORT_LIMITS === '1';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@lekhacaptions.com';

// The backend already tags 500s with "Reference: <rid>". Surface whichever
// identifier we hold so a user reporting a failed export can be matched to a
// server-side log line instead of describing the symptom from memory.
function extractExportReference(error, jobId) {
  if (jobId) return jobId;
  const message = String(error?.message || error?.detail || '');
  const match = message.match(/Reference:\s*([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}

function notifyExportFailure(error, jobId) {
  if (error?.name === 'AbortError') return;
  const reference = extractExportReference(error, jobId);
  const baseMessage = getApiErrorMessage(error);
  const description = reference
    ? `${baseMessage}\n\nJob reference: ${reference}\nNo credit was charged. Email ${SUPPORT_EMAIL} with this reference if it keeps failing.`
    : `${baseMessage}\n\nNo credit was charged. Email ${SUPPORT_EMAIL} if it keeps failing.`;
  toast({
    variant: 'destructive',
    title: 'Export failed',
    description,
    duration: 15000,
  });
}

// Basic template effect defaults come from the same catalog as both galleries.
// Only structural effects are restored here; user font/color/position choices
// remain authoritative in the export payload.
function isAdvancedTemplateId(templateId) {
  return /^t\d{2}$/.test(String(templateId || ''));
}

function isRecreatedAdvancedTemplateId(templateId) {
  return RECREATED_ADVANCED_TEMPLATE_IDS.includes(String(templateId || '').trim());
}

// Backend signals credit/plan problems as HTTP 403 with a marker prefix in `detail`.
// apiRequest throws an ApiError for non-2xx responses, so these must be detected on
// the thrown error (error.data.detail / error.message), not on a returned payload.
function getPlanLimitErrorKind(errorOrDetail) {
  const detail = typeof errorOrDetail === 'string'
    ? errorOrDetail
    : String(errorOrDetail?.data?.detail || errorOrDetail?.message || '');
  if (detail.includes('PLAN_EXPIRED')) return 'expired';
  if (detail.includes('UPGRADE_REQUIRED')) return 'upgrade';
  return null;
}

// Simple queue system to prevent server overload
const exportQueue = {
  queue: [],
  isProcessing: false,
  // Backend allows one concurrent export per account (429 otherwise), so the
  // client queue must never release two exports at once.
  maxConcurrent: 1,
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

export default function ExportPanel({ open, onClose, captions, captionStyle, waveformData, duration, fileId, originalFileName, onUpgradeClick }) {
  const { currentUser, userData, refreshUserData } = useAuth();
  // Use auth context directly for consistent, up-to-date auth & credit checks
  const isSignedIn = !!currentUser;

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [waitStartTime, setWaitStartTime] = useState(null);
  const [showServerBusy, setShowServerBusy] = useState(false);
  const [exportExpiry, setExportExpiry] = useState(null);
  const [activeExportJobId, setActiveExportJobId] = useState('');
  // Keep the established portrait render default while removing the chooser from the export UI.
  const exportAspectRatio = '9:16';
  const exportInFlightRef = useRef(false);
  const exportAbortRef = useRef(null);
  const backgroundNoticeShownRef = useRef(false);

  useEffect(() => () => {
    // Closing the sheet intentionally keeps an export alive, but leaving the
    // dashboard must not trigger a surprise download or update unmounted state.
    exportAbortRef.current?.abort();
  }, []);

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

  // Long renders (4K, long videos) can exceed several minutes — a short client
  // timeout here fails the UI while the server render succeeds, and the retry
  // then hits the per-account concurrent-export guard (429). Keep this generous.
  const pollExportStatus = async (jobId, authHeaders = {}, timeoutMs = 10 * 60 * 1000, signal = null) => {
    const startedAt = Date.now();
    let hadTransientFailure = false;
    let consecutiveNotFound = 0;
    while (Date.now() - startedAt < timeoutMs) {
      throwIfAborted(signal);
      let statusPayload;
      try {
        statusPayload = await apiRequest(`/api/export-status/${jobId}`, {
          headers: authHeaders,
          signal
        });
        throwIfAborted(signal);
        consecutiveNotFound = 0;
        if (hadTransientFailure) {
          setStatusMessage('Connection restored. Finalizing export status...');
          hadTransientFailure = false;
        }
      } catch (err) {
        throwIfAborted(signal);
        // A missing job never recovers — fail fast instead of retrying for the
        // full timeout window.
        if (err?.status === 404) {
          consecutiveNotFound++;
          if (consecutiveNotFound >= 4) {
            throw new Error('Export job was not found on the server. Please start the export again.');
          }
        }
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
      } else if (status === 'cancelled') {
        throw new DOMException('Export cancelled', 'AbortError');
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

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadSRT = () => {
    const srt = buildSrt(captions);
    if (!srt) {
      toast({ variant: 'destructive', title: 'No captions to export' });
      return;
    }
    downloadFile(srt, 'captions.srt', 'text/plain');
  };

  const handleDownloadText = () => {
    const text = buildPlainText(captions);
    if (!text) {
      toast({ variant: 'destructive', title: 'No captions to export' });
      return;
    }
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
    if (DISABLE_EXPORT_LIMITS_FOR_TESTING) return isSignedIn;
    if (!isSignedIn) return false;
    if (!userData) return true;
    if (userData.credits_remaining > 0) return true;
    if (userData.subscription_tier && userData.subscription_tier !== 'free') {
      // isSubscriptionExpired handles Firestore Timestamp objects — after an
      // export, refreshUserData() replaces the bootstrap JSON (string dates)
      // with raw getDoc() data, and `new Date(Timestamp)` is Invalid Date.
      return !isSubscriptionExpired(userData.subscription_expiry);
    }
    return false;
  })();

  // 4K is available for Creator and above (matches pricing promises)
  const is4kAllowed = (() => {
    if (DISABLE_EXPORT_LIMITS_FOR_TESTING) return isSignedIn;
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

  const handlePlanLimitError = (kind) => {
    if (kind === 'expired') {
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
    if (onUpgradeClick) {
      onUpgradeClick();
    }
  };

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
    if (!hasExportableVideoContent(captions)) {
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
    // Captured outside the try so the failure handler can quote a job reference
    // the user can paste into a support request. Without it a failed export is
    // untraceable in the backend logs.
    let activeExportJobId = '';
    const exportController = new AbortController();
    exportAbortRef.current = exportController;
    setProgress(10);
    setStatusMessage('Preparing export...');
    setActiveExportJobId('');
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

      // Export is server-rendered from persisted editor state. The request must
      // not depend on the preview DOM being mounted, visible, or fully loaded.
      const hasTemplateIdentity = (style = {}) => !!(style?.template_id || style?.template_20_id);
      const captionTemplateSnapshot = captions.find(c => hasTemplateIdentity(c?.applied_template_style))?.applied_template_style;
      const styleTemplateSnapshot = hasTemplateIdentity(captionStyle?.template_snapshot)
        ? captionStyle.template_snapshot
        : captionTemplateSnapshot;
      const baseExportStyle = hasTemplateIdentity(styleTemplateSnapshot)
        ? { ...styleTemplateSnapshot, ...captionStyle }
        : (captionStyle || {});
      const templateOverride = getBasicTemplateExportEffects(baseExportStyle?.template_id);
      const effectiveExportStyle = { ...baseExportStyle, ...templateOverride };
      const activeTemplateSnapshot = hasTemplateIdentity(styleTemplateSnapshot)
        ? styleTemplateSnapshot
        : (hasTemplateIdentity(effectiveExportStyle) ? { ...effectiveExportStyle } : null);
      const activeTemplateValue = (caption, key, fallback = '') => (
        caption?.[key]
        ?? effectiveExportStyle?.[key]
        ?? caption?.applied_template_style?.[key]
        ?? activeTemplateSnapshot?.[key]
        ?? fallback
      );

      // abs 0,0 means "position was reset" (isWordDetached ignores it in the
      // editor) — never treat it as a real drop point or words fling to the
      // top-left corner of the exported video.
      const hasRealAbsPosition = (v) => (
        v.abs_x_pct !== undefined
        && v.abs_y_pct !== undefined
        && (Math.abs(Number(v.abs_x_pct) || 0) > 0.01 || Math.abs(Number(v.abs_y_pct) || 0) > 0.01)
      );
      // Recreated advanced templates re-render from authored markup in the
      // export browser, so per-word font/color snapshots must not flatten the
      // authored look — but user-dragged word positions still have to survive.
      // Pass only the geometry fields through; the overlay renderer applies
      // x/y as translate offsets on the matching source word.
      // Saved drag coordinates are normalized percentages and can be consumed
      // directly by the server renderer without reading the live preview DOM.
      const WORD_GEOMETRY_KEYS = [
        'x',
        'y',
        'x_pct',
        'y_pct',
        'rotation',
        'boxWidth',
        'textScaleX',
        'cptCanvasXPercent',
        'cptCanvasYPercent',
        'cptPaintedFontSize',
        'cptPaintedFontFamily',
        'cptPaintedFontWeight',
        'cptPaintedFontStyle',
      ];
      const pickWordGeometryStyles = (patchedWs) => {
        const out = {};
        for (const [k, v] of Object.entries(patchedWs || {})) {
          if (!v || typeof v !== 'object') continue;
          const picked = {};
          for (const key of WORD_GEOMETRY_KEYS) {
            if (v[key] !== undefined) picked[key] = v[key];
          }
          if (hasRealAbsPosition(v)) {
            picked.abs_x_pct = v.abs_x_pct;
            picked.abs_y_pct = v.abs_y_pct;
          }
          if (Object.keys(picked).length) out[k] = picked;
        }
        return out;
      };

      const idToken = await getEffectiveAuthToken(currentUser);
      throwIfAborted(exportController.signal);
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

      const exportEmotionalById = new Map(
        buildEmotionalCaptionPlan(
          captions,
          waveformData,
          duration,
          activeTemplateSnapshot?.template_markup || effectiveExportStyle?.template_markup || '',
        ).map((entry) => [entry.captionId, entry]),
      );

      const exportData = {
        file_id: fileId,
        id_token: idToken || '',
        quality: effectiveQuality,
        export_aspect_ratio: exportAspectRatio,
        captions: captions.filter(c => c && c.text).map(cap => {
          const isText = cap.isTextElement;
          const cs = cap.customStyle || {};
          const emotional = exportEmotionalById.get(cap.id);
          const exportTemplateIndex = !isText
            ? captions.filter(c => c && !c.isTextElement).findIndex(c => c?.id === cap.id)
            : undefined;
          const storedTemplatePhaseIndex = Number(cap.template_phase_index);
          const resolvedTemplatePhaseIndex = !isText
            ? (
                Number.isFinite(storedTemplatePhaseIndex)
                  ? storedTemplatePhaseIndex
                  : Number(emotional?.phaseIndex ?? exportTemplateIndex ?? 0)
              )
            : 0;
          const capTemplateId = !isText ? activeTemplateValue(cap, 'template_id') : '';
          const capUsesRecreatedAdvancedTemplate = isRecreatedAdvancedTemplateId(capTemplateId);
          const sourceTemplateAccentColor = isAdvancedTemplateId(capTemplateId)
            ? (ADVANCED_TEMPLATE_EMPHASIS_COLORS[capTemplateId] || '')
            : '';
          const configuredTemplateAccentColor = !isText
            ? (
                activeTemplateValue(cap, 'highlight_color', effectiveExportStyle?.highlight_color || '')
                || activeTemplateValue(cap, 'emphasis_color', effectiveExportStyle?.emphasis_color || '')
                || activeTemplateValue(cap, 'secondary_color', effectiveExportStyle?.secondary_color || '')
                || ''
              )
            : '';
          const configuredTemplateAccentDiffers = Boolean(
            configuredTemplateAccentColor
              && sourceTemplateAccentColor
              && configuredTemplateAccentColor.toLowerCase() !== sourceTemplateAccentColor.toLowerCase(),
          );
          const capTemplateColorsCustomized = Boolean(
            activeTemplateValue(cap, 'template_color_customized', effectiveExportStyle?.template_color_customized || false)
              || configuredTemplateAccentDiffers,
          );
          const capAppliedTemplateStyle = !isText && capTemplateId
            ? {
                ...(activeTemplateSnapshot || {}),
                ...(cap.applied_template_style || {}),
                template_id: capTemplateId,
                template_20_id: activeTemplateValue(cap, 'template_20_id'),
                template_source: activeTemplateValue(cap, 'template_source'),
                template_class: activeTemplateValue(cap, 'template_class'),
                template_name: activeTemplateValue(cap, 'template_name'),
                template_layout: activeTemplateValue(cap, 'template_layout'),
                template_effect: activeTemplateValue(cap, 'template_effect'),
                template_markup: activeTemplateValue(cap, 'template_markup'),
                text_color: activeTemplateValue(cap, 'text_color', effectiveExportStyle?.text_color || '#ffffff'),
                secondary_color: activeTemplateValue(cap, 'secondary_color', effectiveExportStyle?.secondary_color || ''),
                highlight_color: activeTemplateValue(cap, 'highlight_color', effectiveExportStyle?.highlight_color || ''),
                emphasis_color: activeTemplateValue(cap, 'emphasis_color', effectiveExportStyle?.emphasis_color || ''),
                karaoke_color_1: activeTemplateValue(cap, 'karaoke_color_1', effectiveExportStyle?.karaoke_color_1 || ''),
                karaoke_color_2: activeTemplateValue(cap, 'karaoke_color_2', effectiveExportStyle?.karaoke_color_2 || ''),
                karaoke_color_3: activeTemplateValue(cap, 'karaoke_color_3', effectiveExportStyle?.karaoke_color_3 || ''),
                template_color_customized: capTemplateColorsCustomized,
              }
            : null;
          return {
            id: cap.id,
            text: cap.text,
            start_time: cap.start_time,
            end_time: cap.end_time,
            __templateIndex: exportTemplateIndex,
            animation: cap.animation || 'none',
            animation_speed: cap.animationSpeed ?? 1,
            is_text_element: !!isText,
            template_id: capTemplateId,
            template_20_id: !isText ? activeTemplateValue(cap, 'template_20_id') : '',
            template_source: !isText ? activeTemplateValue(cap, 'template_source') : '',
            template_class: !isText ? activeTemplateValue(cap, 'template_class') : '',
            template_name: !isText ? activeTemplateValue(cap, 'template_name') : '',
            template_layout: !isText ? activeTemplateValue(cap, 'template_layout') : '',
            template_effect: !isText ? activeTemplateValue(cap, 'template_effect') : '',
            template_markup: !isText ? activeTemplateValue(cap, 'template_markup') : '',
            applied_template_style: capAppliedTemplateStyle,
            emotional_mode: !isText ? (cap.emotional_mode || emotional?.mode || 'normal') : '',
            template_phase_index: resolvedTemplatePhaseIndex,
            imp_word_index: !isText ? Number(emotional?.impWordIndex ?? cap.imp_word_index ?? -1) : -1,
            imp_word_indices: !isText ? (emotional?.impWordIndices || cap.imp_word_indices || []) : [],
            emphasis_color: !isText ? (emotional?.emphasisColor || cap.emphasis_color || '') : '',
            audio_emotion_metrics: !isText ? (cap.audio_emotion_metrics || emotional?.audio || null) : null,
            custom_style: isText ? buildTextElementExportStyle(cs) : null,
            word_styles: (!isText && capUsesRecreatedAdvancedTemplate)
              ? pickWordGeometryStyles(cap.wordStyles || {})
              : { ...(cap.wordStyles || {}) },
            words: cap.words || []
          };
        }),
        waveform_data: waveformData || [],
        duration: duration || 0,
        style: (() => {
          // Merge template canonical overrides — ensures correct has_shadow/has_stroke/has_background
          // even when the user's React state was set before these properties were added to the template def.
          const _cs = effectiveExportStyle;
          const sourceTemplateAccentColor = isAdvancedTemplateId(_cs?.template_id)
            ? (ADVANCED_TEMPLATE_EMPHASIS_COLORS[_cs.template_id] || '')
            : '';
          const configuredTemplateAccentColor = _cs?.highlight_color
            || _cs?.emphasis_color
            || _cs?.secondary_color
            || '';
          const templateColorCustomized = Boolean(
            _cs?.template_color_customized
              || _cs?.text_gradient
              || _cs?.highlight_gradient
              || (
                configuredTemplateAccentColor
                && sourceTemplateAccentColor
                && configuredTemplateAccentColor.toLowerCase() !== sourceTemplateAccentColor.toLowerCase()
              ),
          );
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
          emphasis_color: _cs?.emphasis_color || '',
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
          text_decoration: _cs?.text_decoration || 'none',
          is_caps: _cs?.is_caps || false,
          is_bold: _cs?.is_bold || false,
          scale: _cs?.scale ?? 1,
          box_width: _cs?.boxWidth ?? 0,
          display_mode: _cs?.display_mode || 'sentence',
          effect_type: _cs?.effect_type || 'none',
          effect_offset: _cs?.effect_offset ?? 50,
          effect_direction: _cs?.effect_direction ?? -45,
          effect_blur: _cs?.effect_blur ?? 50,
          effect_transparency: _cs?.effect_transparency ?? 40,
          effect_thickness: _cs?.effect_thickness ?? 50,
          effect_intensity: _cs?.effect_intensity ?? 50,
          effect_color: _cs?.effect_color || '#000000',
          position_x: _cs?.position_x ?? 50,
          position_y: _cs?.position_y ?? 75,
          letter_spacing: _cs?.letter_spacing || 0,
          // `??` not `||` — the Word Spacing slider allows 0 (min=0), and the
          // preview honors it; `||` silently exported 0 as 1.
          word_spacing: _cs?.word_spacing ?? 1,
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
          karaoke_color_1: _cs?.karaoke_color_1 || '',
          karaoke_color_2: _cs?.karaoke_color_2 || '',
          karaoke_color_3: _cs?.karaoke_color_3 || '',
          template_color_customized: templateColorCustomized,
          export_aspect_ratio: exportAspectRatio,
          show_inactive: _cs?.show_inactive !== false,
          };
        })(),
      };

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
          signal: exportController.signal,
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
        const planKind = getPlanLimitErrorKind(result.detail || result.error || '');
        if (planKind) {
          handlePlanLimitError(planKind);
          return;
        }
        throw new Error(result.error || 'Export failed');
      }

      let resolvedResult = result;
      if (result.export_job_id) {
        activeExportJobId = result.export_job_id;
        setActiveExportJobId(result.export_job_id);
        await pollExportStatus(result.export_job_id, authHeaders, 10 * 60 * 1000, exportController.signal);
        if (!result.video_url) {
          resolvedResult = await apiRequest(`/api/export-result/${result.export_job_id}`, {
            headers: authHeaders,
            signal: exportController.signal
          });
        }
      }

      if (resolvedResult?.success === false) {
        throw new Error(resolvedResult.error || 'Export completed without a usable video. Please retry.');
      }

      // Store expiry info
      if (resolvedResult.retention_hours) {
        setExportExpiry({ hours: resolvedResult.retention_hours, expiresAt: resolvedResult.expires_at })
      }

      setProgress(90);
      setStatusMessage('Preparing download...');

      // Firebase Storage URLs are absolute; local URLs are relative
      const downloadUrl = resolvedResult.video_url
      if (!downloadUrl) {
        throw new Error('Export completed but no download link was returned. Please retry.');
      }
      const downloadHeaders = shouldAttachApiAuth(downloadUrl, window.location.origin) ? authHeaders : {};
      const videoResponse = await apiFetch(downloadUrl, {
        headers: downloadHeaders,
        signal: exportController.signal
      });
      const blob = await videoResponse.blob();
      if (blob.size === 0) {
        throw new Error('The exported video download was empty. Please retry.');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getCaptionedVideoFilename(originalFileName);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoking synchronously can cancel a just-started download in Safari and
      // Firefox. Release it after the browser has consumed the click instead.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      trackAnalytics('funnel.export.success', getClientContext({
        stage: 'export',
        quality: effectiveQuality,
        plan: userData?.subscription_tier || 'free'
      }));

      setProgress(100);
      setStatusMessage('Export complete!');
      // The backend just decremented a credit — refresh so the plan/credits
      // gating reflects reality instead of the stale pre-export snapshot.
      // Auth-context implementations have historically varied between async and
      // synchronous refresh functions. Normalize both so a successful download
      // is never turned into a false "Export failed" error by `.catch` on void.
      Promise.resolve().then(() => refreshUserData?.()).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      // Cancelled exports are not failures — skip failure analytics and toasts.
      if (error?.name === 'AbortError') return;
      console.error('Export failed:', error);
      const planKind = getPlanLimitErrorKind(error);
      trackAnalytics('funnel.export.failed', getClientContext({
        stage: 'export',
        quality,
        plan: userData?.subscription_tier || 'free',
        reason: planKind || 'error'
      }));
      // The backend rejects out-of-credit exports with HTTP 403, which apiRequest
      // surfaces as a thrown ApiError — route it to the upgrade flow instead of a
      // generic failure toast.
      if (planKind) {
        handlePlanLimitError(planKind);
        return;
      }
      notifyExportFailure(error, activeExportJobId);
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
      setActiveExportJobId('');
    }
  };

  const handleCancelExport = async () => {
    if (!activeExportJobId) return;
    try {
      const idToken = await getEffectiveAuthToken(currentUser);
      await apiRequest(`/api/export-cancel/${activeExportJobId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      exportAbortRef.current?.abort();
      toast({
        title: 'Export cancelled',
        description: 'The queued render was removed. No credit was charged.',
      });
    } catch (error) {
      toast({
        variant: error?.status === 409 ? 'default' : 'destructive',
        title: error?.status === 409 ? 'Render already started' : 'Could not cancel export',
        description: getApiErrorMessage(error),
      });
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
              {activeExportJobId && (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4"
                  onClick={handleCancelExport}
                >
                  Cancel queued export
                </Button>
              )}
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
