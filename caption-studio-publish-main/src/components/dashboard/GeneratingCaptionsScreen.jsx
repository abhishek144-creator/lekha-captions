import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'

// Share of the single progress bar that the upload fills; caption work fills
// the rest.
const UPLOAD_SHARE = 40;
// Caption work has no server progress, so it eases towards this ceiling and
// the screen closes when the captions arrive.
const PROCESSING_CEILING = 95;
// Seconds for the shown percentage to cover most of the way to the real one,
// so upload chunks and once-a-second processing updates glide instead of jump.
const GLIDE_SECONDS = 0.6;

// The shown percentage chases the real one smoothly and never goes back.
function useGlidingPercent(target) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const step = (now) => {
      // A frame's timestamp can be a little earlier than the performance.now()
      // read when the effect started; never step backwards.
      const seconds = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = Math.max(last, now);
      const current = shownRef.current;
      if (current < target) {
        const eased = (target - current) * (1 - Math.exp(-seconds / GLIDE_SECONDS));
        const next = Math.min(target, current + Math.max(eased, seconds * 2));
        shownRef.current = next;
        setShown(next);
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

// Shown while a new upload is transcribed. One bar covers the whole wait:
// while the file is uploading it follows the real share of bytes storage has
// received, then the caption steps advance on time elapsed since the upload
// finished, so the screen reads as progress before the server responds.
export default function GeneratingCaptionsScreen({ elapsedSeconds: processingSeconds, uploadPercent = null }) {
  const isUploading = uploadPercent !== null;
  const seconds = isUploading ? 0 : processingSeconds;
  const step2Ready = !isUploading && seconds >= 3;
  const step3Ready = !isUploading && seconds >= 6;
  const step4Ready = !isUploading && seconds >= 9;
  const progressSteps = [
    { label: 'Uploading your video', status: isUploading ? 'active' : 'complete' },
    { label: 'Transcribing your audio', status: isUploading ? 'upcoming' : step2Ready ? 'complete' : 'active' },
    { label: 'Syncing word-level timing', status: step3Ready ? 'complete' : step2Ready ? 'active' : 'upcoming' },
    { label: 'Highlighting key moments', status: step4Ready ? 'complete' : step3Ready ? 'active' : 'upcoming' },
    { label: 'Rendering your preview', status: step4Ready ? 'active' : 'upcoming' },
  ];
  const completedSteps = progressSteps.filter((step) => step.status === 'complete').length;
  const overallPercent = isUploading
    ? Math.round((Math.min(100, Math.max(0, Number(uploadPercent) || 0)) / 100) * UPLOAD_SHARE)
    : Math.round(UPLOAD_SHARE + (PROCESSING_CEILING - UPLOAD_SHARE) * (1 - Math.exp(-seconds / 15)));
  const shownPercent = useGlidingPercent(overallPercent);
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#050505] p-4 sm:p-8">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(246,165,75,0.14),transparent_36%),radial-gradient(circle_at_8%_88%,rgba(255,255,255,0.045),transparent_28%)]" />
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-[680px] overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0b0b0b]/90 shadow-[0_30px_100px_rgba(0,0,0,0.48)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-7">
          <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffd7a4]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f6a54b] shadow-[0_0_14px_rgba(246,165,75,0.9)]" />
            Lekha studio
          </div>
          <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">AI processing</span>
        </div>

        <div className="px-5 py-7 sm:px-7 sm:py-9">
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

          <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="grid grid-cols-[1fr_auto] items-end gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Caption workflow</p>
                <p className="mt-1 text-sm font-medium text-white">Step {Math.min(completedSteps + 1, progressSteps.length)} of {progressSteps.length}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight text-[#ffd7a4]">{Math.round(shownPercent)}%</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{isUploading ? 'Uploading' : 'Processing'}</p>
              </div>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(shownPercent)}
              data-target-percent={overallPercent}
              aria-label="Caption progress"
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
            >
              <div
                className="h-full rounded-full bg-[#f6a54b]"
                style={{ width: `${shownPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:p-5">
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
        </div>
      </motion.div>
    </div>
  );
}
