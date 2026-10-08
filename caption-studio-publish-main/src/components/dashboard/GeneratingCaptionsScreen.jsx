import React from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'

// Shown while a new upload is transcribed. Steps advance on elapsed time so
// the screen reads as progress even before the server responds. While the
// file is still uploading, the percentage is the real share of bytes storage
// has received.
export default function GeneratingCaptionsScreen({ elapsedSeconds: generationElapsedSeconds, uploadPercent = null }) {
  const step2Ready = generationElapsedSeconds >= 3;
  const step3Ready = generationElapsedSeconds >= 6;
  const step4Ready = generationElapsedSeconds >= 9;
  const progressSteps = [
    { label: 'Transcribing your audio', status: step2Ready ? 'complete' : 'active' },
    { label: 'Syncing word-level timing', status: step3Ready ? 'complete' : step2Ready ? 'active' : 'upcoming' },
    { label: 'Highlighting key moments', status: step4Ready ? 'complete' : step3Ready ? 'active' : 'upcoming' },
    { label: 'Rendering your preview', status: step4Ready ? 'active' : 'upcoming' },
  ];
  const completedSteps = progressSteps.filter((step) => step.status === 'complete').length;
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

          <div className="mt-8 grid grid-cols-[1fr_auto] items-end gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Caption workflow</p>
              <p className="mt-1 text-sm font-medium text-white">Step {Math.min(completedSteps + 1, progressSteps.length)} of {progressSteps.length}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tracking-tight text-[#ffd7a4]">{uploadPercent ?? Math.round((completedSteps / progressSteps.length) * 100)}%</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{uploadPercent === null ? 'Prepared' : 'Uploaded'}</p>
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
