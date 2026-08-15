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

// TESTING ONLY: unlock export UI while caption/export parity is being tested.
// Dev-build only by construction — production builds can never enable this,
// even if VITE_DISABLE_EXPORT_LIMITS leaks into the build environment. In dev
// it defaults on; set VITE_DISABLE_EXPORT_LIMITS=0 to exercise the real gates.
const DISABLE_EXPORT_LIMITS_FOR_TESTING = import.meta.env.DEV && import.meta.env.VITE_DISABLE_EXPORT_LIMITS !== '0';

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

function getTemplatePreviewFontFloorPx(style) {
  const configured = Number(style?.font_size || 0);
  if (!Number.isFinite(configured) || configured <= 0) return 0;
  return Math.max(12, Math.round(configured * 0.88));
}

function getRenderedBoxSize(root) {
  if (!root || typeof root.getBoundingClientRect !== 'function') {
    return { width: 0, height: 0 };
  }
  const rect = root.getBoundingClientRect();
  return {
    width: Number.isFinite(rect.width) ? rect.width : 0,
    height: Number.isFinite(rect.height) ? rect.height : 0,
  };
}

function findRenderedTemplateMeasureElement(preferredRoot) {
  return findLargestRenderedElement('[data-caption-layer="true"] [data-export-measure]', preferredRoot)
    || findLargestRenderedElement('[data-export-measure]', preferredRoot);
}

function findCaptionLayerById(container, captionId) {
  if (!container || captionId === undefined || captionId === null) return null;
  const targetId = String(captionId);
  return Array.from(container.querySelectorAll?.('[data-caption-layer="true"]') || [])
    .find((element) => element.getAttribute('data-caption-id') === targetId) || null;
}

function findRenderedCaptionTemplateElement(preferredRoot) {
  if (!preferredRoot) return null;
  return findLargestRenderedElementInRoot('[data-export-measure]', preferredRoot)
    || findLargestRenderedElementInRoot('.lekha-original-template .lekha-applied-advanced-template.active', preferredRoot)
    || findLargestRenderedElementInRoot('.lekha-original-template .lekha-applied-advanced-template', preferredRoot)
    || findLargestRenderedElementInRoot('.lekha-original-template', preferredRoot)
    || findLargestRenderedElementInRoot('.lekha-applied-advanced-template.active', preferredRoot)
    || findLargestRenderedElementInRoot('.lekha-applied-advanced-template', preferredRoot)
    || findLargestRenderedElementInRoot('.lekha-applied-basic-template-host', preferredRoot)
    || findLargestRenderedElementInRoot('.lekha-sidebar-source-template', preferredRoot)
    || findLargestRenderedElementInRoot('.cap-text', preferredRoot);
}

function normalizeTemplateLineText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getExplicitTemplateTextLines(element) {
  if (!element) return [];
  const lines = [''];
  const appendText = (value) => {
    lines[lines.length - 1] += ` ${value || ''}`;
  };
  const walk = (node) => {
    Array.from(node.childNodes || []).forEach((child) => {
      if (child.nodeType === 3) {
        appendText(child.nodeValue || '');
        return;
      }
      if (child.nodeType !== 1) return;
      if (child.tagName === 'BR') {
        lines.push('');
        return;
      }
      walk(child);
    });
  };
  walk(element);
  return lines.map(normalizeTemplateLineText).filter(Boolean);
}

function getVisualTemplateTextLines(element) {
  if (!element || typeof document === 'undefined') return [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const words = [];
  let node = walker.nextNode();
  while (node) {
    const text = String(node.nodeValue || '');
    const matches = text.matchAll(/\S+/g);
    for (const match of matches) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rect = Array.from(range.getClientRects()).find((item) => item.width > 0 && item.height > 0);
      range.detach?.();
      if (!rect) continue;
      words.push({
        index: words.length,
        top: rect.top,
        left: rect.left,
        text: match[0],
      });
    }
    node = walker.nextNode();
  }
  if (!words.length) return [];
  const lines = new Map();
  words.forEach((word) => {
    const lineKey = Math.round(word.top / 4) * 4;
    const items = lines.get(lineKey) || [];
    items.push(word);
    lines.set(lineKey, items);
  });
  return Array.from(lines.entries())
    .sort(([topA], [topB]) => topA - topB)
    .map(([, items]) => items
      .sort((left, right) => left.left - right.left || left.index - right.index)
      .map((item) => item.text)
      .join(' ')
      .trim())
    .filter(Boolean);
}

function captureAdvancedTemplateLineTexts(preferredRoot) {
  if (typeof document === 'undefined') return [];
  const root = preferredRoot || document;
  const splitTitle = root.querySelector?.(
    '.lekha-original-template .lekha-applied-advanced-template.active .split-title',
  ) || root.querySelector?.(
    '.lekha-original-template .split-title',
  );
  if (splitTitle) {
    const splitLines = ['.split-top', '.split-bot']
      .map((selector) => normalizeTemplateLineText(splitTitle.querySelector(selector)?.textContent || ''))
      .filter(Boolean);
    if (splitLines.length) return splitLines;
  }
  const explicitLineRoot = root.querySelector?.(
    '.lekha-original-template .lekha-applied-advanced-template.active .hand-txt, '
    + '.lekha-original-template .lekha-applied-advanced-template.active .soft-rise, '
    + '.lekha-original-template .lekha-applied-advanced-template.active .slow-rise',
  ) || root.querySelector?.(
    '.lekha-original-template .hand-txt, '
    + '.lekha-original-template .soft-rise, '
    + '.lekha-original-template .slow-rise',
  );
  const explicitLines = getExplicitTemplateTextLines(explicitLineRoot);
  if (explicitLines.length > 1) return explicitLines;
  const visualLines = getVisualTemplateTextLines(explicitLineRoot);
  if (visualLines.length > 1) return visualLines;
  const lineRoot = root.querySelector?.(
    '.lekha-original-template .lekha-applied-advanced-template.active .wbw-rise, '
    + '.lekha-original-template .lekha-applied-advanced-template.active .wbw-slide, '
    + '.lekha-original-template .lekha-applied-advanced-template.active .wbw-seq, '
    + '.lekha-original-template .lekha-applied-advanced-template.active .wbw-seq-fade, '
    + '.lekha-original-template .lekha-applied-advanced-template.active .wbw-seq-flip',
  ) || root.querySelector?.(
    '.lekha-original-template .wbw-rise, '
    + '.lekha-original-template .wbw-slide, '
    + '.lekha-original-template .wbw-seq, '
    + '.lekha-original-template .wbw-seq-fade, '
    + '.lekha-original-template .wbw-seq-flip',
  );
  if (!lineRoot) {
    const appliedTemplateRoot = root.querySelector?.(
      '.lekha-applied-basic-template-host .bt-cap-block.is-active, '
      + '.lekha-applied-template-host .sb.active, '
      + '.lekha-applied-template-host .sblock.active, '
      + '.lekha-sidebar-source-template .sb.active, '
      + '.lekha-sidebar-source-template .sblock.active',
    );
    return getVisualTemplateTextLines(appliedTemplateRoot);
  }
  const words = Array.from(lineRoot.querySelectorAll('.w, .kf-word'))
    .filter((word) => String(word.textContent || '').trim());
  if (!words.length) return [];
  const lines = new Map();
  words.forEach((word, fallbackIndex) => {
    const top = Number.isFinite(word.offsetTop) ? word.offsetTop : word.getBoundingClientRect().top;
    const lineKey = Math.round(top / 4) * 4;
    const items = lines.get(lineKey) || [];
    items.push({
      index: fallbackIndex,
      left: Number.isFinite(word.offsetLeft) ? word.offsetLeft : word.getBoundingClientRect().left,
      text: String(word.textContent || '').trim(),
    });
    lines.set(lineKey, items);
  });
  return Array.from(lines.entries())
    .sort(([topA], [topB]) => topA - topB)
    .map(([, items]) => items
      .sort((left, right) => left.left - right.left || left.index - right.index)
      .map((item) => item.text)
      .join(' ')
      .trim())
    .filter(Boolean);
}

function findLargestRenderedElement(selector, preferredRoot) {
  if (typeof document === 'undefined') return null;
  const roots = [preferredRoot, document].filter(Boolean);
  const seen = new Set();
  let best = null;
  let bestArea = 0;

  roots.forEach((root) => {
    const matches = typeof root.querySelectorAll === 'function'
      ? Array.from(root.querySelectorAll(selector))
      : [];
    matches.forEach((element) => {
      if (!element || seen.has(element) || typeof element.getBoundingClientRect !== 'function') return;
      seen.add(element);
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (
        !Number.isFinite(rect.width)
        || !Number.isFinite(rect.height)
        || rect.width <= 0
        || rect.height <= 0
        || style.display === 'none'
        || style.visibility === 'hidden'
      ) {
        return;
      }
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = element;
        bestArea = area;
      }
    });
  });

  return best;
}

function findLargestRenderedElementInRoot(selector, root) {
  if (!root || typeof window === 'undefined') return null;
  const candidates = [
    ...(typeof root.matches === 'function' && root.matches(selector) ? [root] : []),
    ...(typeof root.querySelectorAll === 'function' ? Array.from(root.querySelectorAll(selector)) : []),
  ];
  let best = null;
  let bestArea = 0;

  candidates.forEach((element) => {
    if (!element || typeof element.getBoundingClientRect !== 'function') return;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (
      !Number.isFinite(rect.width)
      || !Number.isFinite(rect.height)
      || rect.width <= 0
      || rect.height <= 0
      || style.display === 'none'
      || style.visibility === 'hidden'
    ) {
      return;
    }
    const area = rect.width * rect.height;
    if (area > bestArea) {
      best = element;
      bestArea = area;
    }
  });

  return best;
}

function getRenderedElementCenterPercent(element, containerRect, containerToVideo) {
  if (
    !element
    || !containerRect
    || typeof element.getBoundingClientRect !== 'function'
    || typeof containerToVideo !== 'function'
  ) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (
    !Number.isFinite(rect.width)
    || !Number.isFinite(rect.height)
    || rect.width <= 0
    || rect.height <= 0
    || !Number.isFinite(containerRect.width)
    || !Number.isFinite(containerRect.height)
    || containerRect.width <= 0
    || containerRect.height <= 0
  ) {
    return null;
  }
  const centerXPct = ((rect.left + rect.width / 2 - containerRect.left) / containerRect.width) * 100;
  const centerYPct = ((rect.top + rect.height / 2 - containerRect.top) / containerRect.height) * 100;
  const pos = containerToVideo(centerXPct, centerYPct);
  if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) {
    return null;
  }
  return pos;
}

function indexWordElementsByKey(container) {
  const elementsByKey = new Map();
  const seen = new Set();
  const roots = [container];
  const ownerDocument = container?.ownerDocument;
  // Selected/detached words are painted through a body portal. Index the
  // document as well as the canvas so export can measure the exact visible
  // glyph instead of an older template placeholder with the same word key.
  if (ownerDocument && ownerDocument !== container) roots.push(ownerDocument);
  roots.forEach((root) => {
    root?.querySelectorAll?.('[data-word-key]').forEach((element) => {
      if (seen.has(element)) return;
      seen.add(element);
      const key = element.getAttribute('data-word-key');
      if (key === null) return;
      const candidates = elementsByKey.get(key) || [];
      candidates.push(element);
      elementsByKey.set(key, candidates);
    });
  });
  return elementsByKey;
}

function getRenderedWordRect(element) {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null;

  const visualTargets = Array.from(element.querySelectorAll?.(
    '[data-source-word-visual="true"], [data-word-drag-visual="true"], [data-selected-word-text="true"], .kf-base, .kf-fill'
  ) || []).filter((target) => {
    const style = window.getComputedStyle(target);
    const rect = target.getBoundingClientRect();
    return (
      style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) !== 0
      && rect.width > 0
      && rect.height > 0
    );
  });

  if (!visualTargets.length) return element.getBoundingClientRect();

  const rects = visualTargets.map(target => target.getBoundingClientRect());
  const left = Math.min(...rects.map(rect => rect.left));
  const top = Math.min(...rects.map(rect => rect.top));
  const right = Math.max(...rects.map(rect => rect.right));
  const bottom = Math.max(...rects.map(rect => rect.bottom));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
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

      // Prefer the tagged dashboard player — a bare 'video' query breaks silently
      // if any other <video> (template preview, tutorial, embed) is ever on the page.
      const videoEl = document.querySelector('video[data-lekha-player="true"]')
        || document.querySelector('video');
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
      if (
        !containerRect
        || !Number.isFinite(containerRect.width)
        || !Number.isFinite(containerRect.height)
        || containerRect.width <= 0
        || containerRect.height <= 0
      ) {
        throw new Error('The video preview is not visible. Open the preview and try exporting again.');
      }

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

      const measuredTemplateEl = findRenderedTemplateMeasureElement(container);
      const templateFontEl =
        measuredTemplateEl
        || findLargestRenderedElement('.lekha-applied-advanced-template.active', container)
        || findLargestRenderedElement('.lekha-applied-advanced-template', container)
        || findLargestRenderedElement('.lekha-applied-basic-template-host', container)
        || findLargestRenderedElement('.lekha-sidebar-source-template', container)
        || findLargestRenderedElement('.cap-text', container);
      const measuredTemplateFontPx = getMaxRenderedFontSize(templateFontEl);
      const previewTemplateFontPx = (
        isAdvancedTemplateId(effectiveExportStyle?.template_id) && measuredTemplateFontPx > 0
      )
        ? measuredTemplateFontPx
        : Math.max(
            measuredTemplateFontPx,
            getTemplatePreviewFontFloorPx(effectiveExportStyle),
          );
      const previewTemplateBoxEl =
        measuredTemplateEl
        || findLargestRenderedElement('.lekha-original-template .lekha-applied-advanced-template.active', container)
        || findLargestRenderedElement('.lekha-original-template .lekha-applied-advanced-template', container)
        || findLargestRenderedElement('.lekha-original-template', container)
        || findLargestRenderedElement('.lekha-applied-basic-template-host', container)
        || findLargestRenderedElement('.lekha-sidebar-source-template', container)
        || findLargestRenderedElement('.cap-text', container);
      const previewTemplateBox = getRenderedBoxSize(previewTemplateBoxEl);
      const previewTemplateLineTexts = captureAdvancedTemplateLineTexts(container);

      const containerToVideo = (xPct, yPct) => {
        const xPx = (xPct / 100) * cw;
        const yPx = (yPct / 100) * ch;
        return {
          x: Math.max(0, Math.min(100, ((xPx - offsetX) / renderW) * 100)),
          y: Math.max(0, Math.min(100, ((yPx - offsetY) / renderH) * 100))
        };
      };
      const previewCaptionAnchorEl = findLargestRenderedElement('[data-caption-layer="true"]', container);
      const previewCaptionAnchorPos = getRenderedElementCenterPercent(
        previewCaptionAnchorEl,
        containerRect,
        containerToVideo,
      );
      const previewTemplateAnchorPos = isAdvancedTemplateId(effectiveExportStyle?.template_id)
        ? getRenderedElementCenterPercent(
            previewTemplateBoxEl,
            containerRect,
            containerToVideo,
          )
        : null;

      // Caption IDs are persisted user data, not safe CSS selector fragments.
      // Index literal attribute values once so imported IDs containing quotes do
      // not throw a DOMException and abort the whole export.
      const wordElementsByKey = indexWordElementsByKey(container);

      // Capture exact word positions from DOM
      const captureLayout = (caps) => {
        const layout = {};
        if (!container || !containerRect) return layout;

        caps.forEach(cap => {
          if (isRecreatedAdvancedTemplateId(activeTemplateValue(cap, 'template_id'))) return;
          const capId = cap.id;
          if (cap.words && cap.words.length > 0) {
            cap.words.forEach((_, wIdx) => {
              const key = `${capId}-${wIdx}`;
              const el = (wordElementsByKey.get(key) || []).find((candidate) => {
                const style = window.getComputedStyle(candidate);
                const rect = getRenderedWordRect(candidate);
                return style.display !== 'none'
                  && style.visibility !== 'hidden'
                  && Number(style.opacity || 1) !== 0
                  && rect?.width > 0
                  && rect?.height > 0;
              });
              if (el) {
                const rect = getRenderedWordRect(el);
                if (!rect) return;

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

      const exportUsesRecreatedAdvancedTemplate = isRecreatedAdvancedTemplateId(effectiveExportStyle?.template_id)
        || captions.some((cap) => !cap?.isTextElement && isRecreatedAdvancedTemplateId(activeTemplateValue(cap, 'template_id')));
      const wordLayouts = captureLayout(captions);

      // Bug 9: Warn if word layout capture returned nothing despite captions having words
      const captionsWithWords = captions.filter(c => c.words && c.words.length > 0 && !c.isTextElement);
      const layoutKeys = Object.keys(wordLayouts).length;
      if (captionsWithWords.length > 0 && layoutKeys === 0) {
        console.warn('[Export] Word layout capture returned 0 entries. Export will use fallback position-based rendering. Make sure the video player is fully visible before exporting.');
        setStatusMessage('Note: Using fallback positioning (scroll video into view for best results)');
      }

      // abs 0,0 means "position was reset" (isWordDetached ignores it in the
      // editor) — never treat it as a real drop point or words fling to the
      // top-left corner of the exported video.
      const hasRealAbsPosition = (v) => (
        v.abs_x_pct !== undefined
        && v.abs_y_pct !== undefined
        && (Math.abs(Number(v.abs_x_pct) || 0) > 0.01 || Math.abs(Number(v.abs_y_pct) || 0) > 0.01)
      );
      const hasCptCanvasPosition = (v) => (
        Number.isFinite(Number(v?.cptCanvasXPercent))
        && Number.isFinite(Number(v?.cptCanvasYPercent))
      );
      const hasRelativeCptPosition = (v) => (
        Math.abs(Number(v?.x_pct) || 0) > 0.01
        || Math.abs(Number(v?.y_pct) || 0) > 0.01
        || Math.abs(Number(v?.x) || 0) > 0.01
        || Math.abs(Number(v?.y) || 0) > 0.01
      );

      const captionHasCptWords = (caption) => Object.values(caption?.wordStyles || {}).some((wordStyle = {}) => (
        hasRealAbsPosition(wordStyle)
        || hasCptCanvasPosition(wordStyle)
        || hasRelativeCptPosition(wordStyle)
      ));
      const getCanvasWordSnapshot = (key, expectedCanvasPosition = null) => {
        const candidates = (wordElementsByKey.get(key) || []).map((wordEl) => {
          const style = window.getComputedStyle(wordEl);
          const wordRect = getRenderedWordRect(wordEl);
          if (
            !wordRect
            || style.display === 'none'
            || style.visibility === 'hidden'
            || Number(style.opacity || 1) === 0
            || wordRect.width <= 0
            || wordRect.height <= 0
          ) return null;
          const centerXPct = (
            (wordRect.left + wordRect.width / 2 - containerRect.left)
            / containerRect.width
          ) * 100;
          const centerYPct = (
            (wordRect.top + wordRect.height / 2 - containerRect.top)
            / containerRect.height
          ) * 100;
          const distance = expectedCanvasPosition
            ? Math.hypot(
                centerXPct - Number(expectedCanvasPosition.x),
                centerYPct - Number(expectedCanvasPosition.y),
              )
            : 0;
          const typographyTarget = wordEl.querySelector?.(
            '[data-source-word-visual="true"], [data-word-drag-visual="true"], [data-selected-word-text="true"], .kf-base, .kf-fill'
          ) || wordEl;
          const typography = window.getComputedStyle(typographyTarget);
          const paintedFontSize = parseFloat(typography.fontSize || '');
          const paintedFontFamily = String(typography.fontFamily || '')
            .split(',')[0]
            .replace(/["']/g, '')
            .trim();
          return {
            centerXPct,
            centerYPct,
            distance,
            paintedFontSize,
            paintedFontFamily,
            paintedFontWeight: typography.fontWeight || '',
            paintedFontStyle: typography.fontStyle || '',
          };
        }).filter(Boolean).sort((left, right) => left.distance - right.distance);

        const best = candidates[0];
        // Duplicate template placeholders can remain mounted in their original
        // sentence row. Only trust a painted candidate near the authored CPT
        // point; otherwise retain the saved drag-release coordinate.
        if (!best || (expectedCanvasPosition && best.distance > 8)) return null;
        const vidPos = containerToVideo(best.centerXPct, best.centerYPct);
        return {
          abs_x_pct: vidPos.x,
          abs_y_pct: vidPos.y,
          ...(Number.isFinite(best.paintedFontSize) && best.paintedFontSize > 0
            ? { cptPaintedFontSize: best.paintedFontSize }
            : {}),
          ...(best.paintedFontFamily ? { cptPaintedFontFamily: best.paintedFontFamily } : {}),
          ...(best.paintedFontWeight ? { cptPaintedFontWeight: best.paintedFontWeight } : {}),
          ...(best.paintedFontStyle ? { cptPaintedFontStyle: best.paintedFontStyle } : {}),
        };
      };

      const patchWordStyles = (caption) => {
        const ws = caption?.wordStyles || {};
        if (!container || !containerRect) return ws;
        const isCptCaption = captionHasCptWords(caption);
        const wordCount = String(caption?.text || '').trim().split(/\s+/).filter(Boolean).length;
        const keys = new Set(Object.keys(ws));
        if (isCptCaption) {
          for (let index = 0; index < wordCount; index += 1) {
            keys.add(`${caption.id}-${index}`);
          }
        }
        const patched = {};
        for (const k of keys) {
          const v = ws[k] || {};
          if (hasCptCanvasPosition(v)) {
            // The drop point identifies the authored CPT and lets us reject
            // duplicate template placeholders. When the matching painted word
            // is mounted, its final box is the WYSIWYG source of truth because
            // font loading, fullscreen and responsive layout can settle after
            // pointer-up. Fall back to the saved point when it is not mounted.
            const paintedSnapshot = getCanvasWordSnapshot(k, {
              x: v.cptCanvasXPercent,
              y: v.cptCanvasYPercent,
            });
            const vidPos = paintedSnapshot || containerToVideo(
              v.cptCanvasXPercent,
              v.cptCanvasYPercent,
            );
            patched[k] = {
              ...v,
              ...(paintedSnapshot || {}),
              abs_x_pct: paintedSnapshot?.abs_x_pct ?? vidPos.x,
              abs_y_pct: paintedSnapshot?.abs_y_pct ?? vidPos.y,
            };
          } else if (hasRealAbsPosition(v)) {
            const vidPos = containerToVideo(v.abs_x_pct, v.abs_y_pct);
            patched[k] = { ...v, abs_x_pct: vidPos.x, abs_y_pct: vidPos.y };
          } else if (isCptCaption) {
            // A CPT is one composed canvas state. Pin every word to its measured
            // centre so the export browser cannot reflow the
            // undisplaced words around the word that the user dragged.
            patched[k] = { ...v, ...(getCanvasWordSnapshot(k) || {}) };
          } else if (hasRelativeCptPosition(v)) {
            // Legacy saved CPTs have only a template-relative offset. Keep it
            // as the fallback when that caption is not mounted at export time.
            patched[k] = v;
          } else {
            patched[k] = v;
          }
        }
        return patched;
      };

      // Recreated advanced templates re-render from authored markup in the
      // export browser, so per-word font/color snapshots must not flatten the
      // authored look — but user-dragged word positions still have to survive.
      // Pass only the geometry fields through; the overlay renderer applies
      // x/y as translate offsets on the matching source word.
      // Input MUST already be patchWordStyles() output so abs_x/y_pct are in
      // video space (what render_template_overlay.mjs measures against), not
      // preview-container space.
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
          const captionPreviewLineTexts = (
            !isText
            && previewTemplateLineTexts.length > 0
            && normalizeTemplateLineText(cap.text).toLocaleLowerCase() === normalizeTemplateLineText(previewTemplateLineTexts.join(' ')).toLocaleLowerCase()
          )
            ? previewTemplateLineTexts
            : [];
          const capTemplateId = !isText ? activeTemplateValue(cap, 'template_id') : '';
          const captionLayerEl = !isText ? findCaptionLayerById(container, cap.id) : null;
          const captionTemplateEl = !isText ? findRenderedCaptionTemplateElement(captionLayerEl) : null;
          const captionTemplateBox = getRenderedBoxSize(captionTemplateEl);
          const captionMeasuredTemplateFontPx = getMaxRenderedFontSize(captionTemplateEl);
          const captionPreviewTemplateFontPx = captionMeasuredTemplateFontPx > 0
            ? captionMeasuredTemplateFontPx
            : previewTemplateFontPx;
          const captionPreviewTemplateBoxWidthPx = captionTemplateBox.width > 0
            ? captionTemplateBox.width
            : previewTemplateBox.width;
          const captionPreviewTemplateBoxHeightPx = captionTemplateBox.height > 0
            ? captionTemplateBox.height
            : previewTemplateBox.height;
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
                preview_template_font_px: Number.isFinite(captionPreviewTemplateFontPx) ? captionPreviewTemplateFontPx : 0,
                preview_template_box_width_px: Number.isFinite(captionPreviewTemplateBoxWidthPx) ? captionPreviewTemplateBoxWidthPx : 0,
                preview_template_box_height_px: Number.isFinite(captionPreviewTemplateBoxHeightPx) ? captionPreviewTemplateBoxHeightPx : 0,
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
            preview_template_line_texts: captionPreviewLineTexts,
            preview_template_font_px: !isText && Number.isFinite(captionPreviewTemplateFontPx) ? captionPreviewTemplateFontPx : 0,
            preview_template_box_width_px: !isText && Number.isFinite(captionPreviewTemplateBoxWidthPx) ? captionPreviewTemplateBoxWidthPx : 0,
            preview_template_box_height_px: !isText && Number.isFinite(captionPreviewTemplateBoxHeightPx) ? captionPreviewTemplateBoxHeightPx : 0,
            custom_style: isText ? (() => {
              const teVidPos = containerToVideo(cs.left ?? 50, cs.top ?? 50);
              return buildTextElementExportStyle(cs, teVidPos);
            })() : null,
            word_styles: (!isText && capUsesRecreatedAdvancedTemplate)
              ? pickWordGeometryStyles(patchWordStyles(cap))
              : patchWordStyles(cap),
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
          ...(() => {
            if (previewTemplateAnchorPos) {
              return {
                position_x: previewTemplateAnchorPos.x,
                position_y: previewTemplateAnchorPos.y,
              };
            }
            if (previewCaptionAnchorPos) {
              return {
                position_x: previewCaptionAnchorPos.x,
                position_y: previewCaptionAnchorPos.y,
              };
            }
            const capVidPos = containerToVideo(_cs?.position_x ?? 50, _cs?.position_y ?? 75);
            return { position_x: capVidPos.x, position_y: capVidPos.y };
          })(),
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
          preview_width: renderW,
          preview_height: renderH,
          preview_container_width: cw,
          preview_container_height: ch,
          preview_template_font_px: Number.isFinite(previewTemplateFontPx) ? previewTemplateFontPx : 0,
          preview_template_box_width_px: Number.isFinite(previewTemplateBox.width) ? previewTemplateBox.width : 0,
          preview_template_box_height_px: Number.isFinite(previewTemplateBox.height) ? previewTemplateBox.height : 0,
          preview_template_line_texts: previewTemplateLineTexts,
          };
        })(),
        word_layouts: exportUsesRecreatedAdvancedTemplate ? {} : wordLayouts
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
