import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SectionHeader from './SectionHeader'

const HOLD_MS = 2400
const WORD_STAGGER = 0.09

const STYLES = [
  {
    id: 'pulse',
    name: 'Pulse',
    accent: '#F5A623',
    fontClass: 'font-black uppercase tracking-tight',
    scenes: [
      { words: ['STOP', 'SCROLLING.'], heroIndex: 0 },
      { words: ['this', 'caption', 'gets', 'SEEN.'], heroIndex: 3 },
      { words: ['made', 'for', 'every', 'LANGUAGE.'], heroIndex: 3 }
    ]
  },
  {
    id: 'whisper',
    name: 'Whisper',
    accent: '#6EE7FF',
    fontClass: 'lv2-display italic font-medium',
    scenes: [
      { words: ['quiet', 'words,', 'loud', 'impact.'], heroIndex: 3 },
      { words: ['one', 'story,', 'any', 'tongue.'], heroIndex: 2 },
      { words: ['told', 'the', 'way', 'you', 'meant', 'it.'], heroIndex: 3 }
    ]
  },
  {
    id: 'signature',
    name: 'Signature',
    accent: '#FF8FA3',
    fontClass: 'font-extrabold',
    scenes: [
      { words: ['Heard', 'in', 'EVERY', 'tongue.'], heroIndex: 2 },
      { words: ['Your', 'voice,', 'GLOBAL', 'reach.'], heroIndex: 2 },
      { words: ['115+', 'LANGUAGES.', 'one', 'upload.'], heroIndex: 1 }
    ]
  }
]

function StageCaption({ style }) {
  const [sceneIdx, setSceneIdx] = useState(0)
  const scene = style.scenes[sceneIdx % style.scenes.length]

  useEffect(() => {
    setSceneIdx(0)
  }, [style.id])

  useEffect(() => {
    const introMs = scene.words.length * WORD_STAGGER * 1000 + 400
    const timer = setTimeout(() => {
      setSceneIdx((prev) => (prev + 1) % style.scenes.length)
    }, introMs + HOLD_MS)
    return () => clearTimeout(timer)
  }, [sceneIdx, style, scene.words.length])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${style.id}-${sceneIdx}`}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex flex-wrap justify-center text-center px-8 ${style.fontClass}`}
        style={{ columnGap: '0.35em', rowGap: '0.1em' }}
      >
        {scene.words.map((w, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * WORD_STAGGER, duration: 0.35, ease: [0.22, 0.68, 0.26, 1] }}
            className="text-4xl md:text-6xl"
            style={{
              color: i === scene.heroIndex ? style.accent : '#F2F3F5',
              textShadow: i === scene.heroIndex ? `0 0 40px ${style.accent}55` : 'none'
            }}
          >
            {w}
          </motion.span>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}

export default function StyleStage() {
  const [activeId, setActiveId] = useState(STYLES[0].id)
  const active = STYLES.find((s) => s.id === activeId)

  return (
    <section id="styles" aria-label="Caption styles" className="bg-[#0D0D0D] py-28">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          index="03"
          kicker="CAPTION STYLES"
          title="Styles that run live — right here."
          blurb="No screenshots on this page. These are real animated caption styles from the editor, playing on the same engine your exports use."
        />

        {/* style switcher */}
        <div className="flex flex-wrap gap-3 mb-8">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                s.id === activeId
                  ? 'lv2-gold-bg text-black'
                  : 'border border-white/15 text-white/70 hover:border-white/40 hover:text-white'
              }`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ backgroundColor: s.accent }} />
              {s.name}
            </button>
          ))}
        </div>

        {/* stage */}
        <div className="relative rounded-3xl border border-white/10 bg-[#0B0B0C] overflow-hidden min-h-[320px] md:min-h-[420px] flex items-center justify-center">
          {/* stage atmosphere */}
          <div
            className="absolute inset-0 opacity-60"
            style={{ background: `radial-gradient(ellipse 60% 50% at 50% 55%, ${active.accent}12, transparent 70%)` }}
            aria-hidden="true"
          />
          {/* corner chrome */}
          <span className="absolute top-5 left-6 font-mono text-[10px] tracking-[0.25em] text-white/40 uppercase">
            STYLE / {active.name}
          </span>
          <span className="absolute top-5 right-6 flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-[#F5A623]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse" />
            LIVE
          </span>
          <span className="absolute bottom-5 left-6 font-mono text-[10px] tracking-[0.25em] text-white/30">00:00:14:07</span>
          <span className="absolute bottom-5 right-6 font-mono text-[10px] tracking-[0.25em] text-white/30">9:16 SAFE</span>

          <StageCaption style={active} />
        </div>

        <p className="mt-6 font-mono text-[11px] tracking-[0.2em] text-[#949494]/80 text-center">
          3 OF 25+ STYLES — ALL OF THEM SHIP IN THE EDITOR
        </p>
      </div>
    </section>
  )
}
