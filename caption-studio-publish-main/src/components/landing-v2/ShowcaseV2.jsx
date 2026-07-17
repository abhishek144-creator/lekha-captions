import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DISPLAY_FONT } from './brand'

const HOLD_MS = 2300
const WORD_STAGGER = 0.09

const TEMPLATES = [
  {
    id: 'v2-pulse',
    name: 'Pulse',
    accent: '#F5A623',
    heroClass: 'font-extrabold',
    wordClass: 'font-extrabold',
    scenes: [
      { words: ['स्क्रॉल', 'रोको', 'अभी'], heroIndex: 1 },
      { words: ['यह', 'कैप्शन', 'दिखेगा'], heroIndex: 1 },
      { words: ['STOP', 'SCROLLING.'], heroIndex: 0 },
    ],
  },
  {
    id: 'v2-whisper',
    name: 'Whisper',
    accent: '#6EE7FF',
    heroClass: 'italic font-semibold',
    wordClass: 'italic font-light',
    scenes: [
      { words: ['धीमे', 'शब्द,', 'गहरा', 'असर'], heroIndex: 3 },
      { words: ['एक', 'कहानी,', 'हर', 'ज़ुबान'], heroIndex: 3 },
      { words: ['quiet', 'words,', 'loud', 'impact'], heroIndex: 3 },
    ],
  },
  {
    id: 'v2-signature',
    name: 'Signature',
    accent: '#FF8FA3',
    heroClass: 'font-bold uppercase tracking-widest',
    wordClass: 'font-medium uppercase tracking-widest',
    scenes: [
      { words: ['हर', 'भाषा', 'में', 'सुनो'], heroIndex: 1 },
      { words: ['आवाज़', 'वही,', 'पहुँच', 'GLOBAL'], heroIndex: 3 },
      { words: ['115+', 'भाषाएँ,', 'एक', 'upload'], heroIndex: 0 },
    ],
  },
]

function ShowcaseFrame({ tpl, index }) {
  const [sceneIdx, setSceneIdx] = useState(0)
  const scene = tpl.scenes[sceneIdx]

  useEffect(() => {
    const introMs = scene.words.length * WORD_STAGGER * 1000 + 400
    const timer = setTimeout(() => {
      setSceneIdx((prev) => (prev + 1) % tpl.scenes.length)
    }, introMs + HOLD_MS)
    return () => clearTimeout(timer)
  }, [sceneIdx, tpl.scenes.length, scene.words.length])

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.12 }}
      className="relative rounded-2xl border border-white/10 bg-[#0d0d0d] aspect-[9/13] overflow-hidden flex flex-col"
    >
      {/* Frame chrome */}
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white/15" />
          <span className="w-2 h-2 rounded-full bg-white/15" />
          <span className="w-2 h-2 rounded-full" style={{ background: tpl.accent }} />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">{tpl.name}</span>
      </div>

      {/* Caption stage */}
      <div className="flex-1 flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={sceneIdx}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-center"
          >
            {scene.words.map((w, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * WORD_STAGGER, duration: 0.35, ease: [0.22, 0.68, 0.26, 1] }}
                className={`text-2xl md:text-[26px] leading-snug ${i === scene.heroIndex ? tpl.heroClass : tpl.wordClass}`}
                style={{ color: i === scene.heroIndex ? tpl.accent : '#F2F3F5' }}
              >
                {w}
              </motion.span>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pb-5">
        {tpl.scenes.map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === sceneIdx ? 18 : 6,
              background: i === sceneIdx ? tpl.accent : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

export default function ShowcaseV2() {
  return (
    <section aria-label="Template showcase" className="bg-[#0d0d0d] border-y border-white/[0.06] py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-end mb-14">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#F5A623] mb-4">Live styles</p>
            <h2 className="text-3xl md:text-5xl text-white font-semibold leading-tight max-w-xl" style={{ fontFamily: DISPLAY_FONT }}>
              Real templates, running right here
            </h2>
          </div>
          <p className="text-[#949494] max-w-xs text-sm leading-relaxed md:text-right">
            Not screenshots — these are animated caption styles from the editor,
            playing live on this page.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {TEMPLATES.map((tpl, i) => (
            <ShowcaseFrame key={tpl.id} tpl={tpl} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
