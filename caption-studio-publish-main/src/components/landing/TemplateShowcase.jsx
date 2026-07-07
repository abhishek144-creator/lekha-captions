import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const HOLD_MS = 2400
const WORD_STAGGER = 0.09

const TEMPLATES = [
  {
    id: 't-pulse',
    name: 'Pulse',
    accent: '#F5A623',
    fontClass: 'font-sans',
    scenes: [
      { words: ['STOP', 'SCROLLING.'], heroIndex: 0 },
      { words: ['this', 'caption', 'gets', 'SEEN.'], heroIndex: 3 },
      { words: ['made', 'for', 'every', 'LANGUAGE.'], heroIndex: 3 }
    ]
  },
  {
    id: 't-whisper',
    name: 'Whisper',
    accent: '#6EE7FF',
    fontClass: 'italic',
    scenes: [
      { words: ['quiet', 'words,', 'loud', 'IMPACT.'], heroIndex: 3 },
      { words: ['one', 'story,', 'ANY', 'tongue.'], heroIndex: 2 },
      { words: ['told', 'the', 'way', 'YOU', 'meant', 'it.'], heroIndex: 3 }
    ]
  },
  {
    id: 't-signature',
    name: 'Signature',
    accent: '#FF8FA3',
    fontClass: 'font-sans',
    scenes: [
      { words: ['Heard', 'in', 'EVERY', 'tongue.'], heroIndex: 2 },
      { words: ['Your', 'voice,', 'GLOBAL', 'reach.'], heroIndex: 2 },
      { words: ['115+', 'LANGUAGES.', 'one', 'upload.'], heroIndex: 1 }
    ]
  }
]

function TemplateCard({ tpl }) {
  const [sceneIdx, setSceneIdx] = useState(0)
  const scene = tpl.scenes[sceneIdx]

  useEffect(() => {
    const introMs = scene.words.length * WORD_STAGGER * 1000 + 400
    const timer = setTimeout(() => {
      setSceneIdx((prev) => (prev + 1) % tpl.scenes.length)
    }, introMs + HOLD_MS)
    return () => clearTimeout(timer)
  }, [sceneIdx, tpl.scenes, scene.words.length])

  return (
    <div className="rounded-2xl bg-[#1A1A1A] border border-white/10 aspect-[9/13] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <span className="absolute top-4 left-4 text-xs font-semibold text-white/50 tracking-wide uppercase">{tpl.name}</span>
      <AnimatePresence mode="wait">
        <motion.div
          key={sceneIdx}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`flex flex-wrap justify-center gap-x-2 gap-y-1 text-center ${tpl.fontClass}`}
        >
          {scene.words.map((w, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * WORD_STAGGER, duration: 0.35, ease: [0.22, 0.68, 0.26, 1] }}
              className="text-2xl md:text-3xl font-extrabold"
              style={{ color: i === scene.heroIndex ? tpl.accent : '#F2F3F5' }}
            >
              {w}
            </motion.span>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default function TemplateShowcase() {
  return (
    <section aria-label="Template Showcase" className="py-24 bg-[#111111]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Live Caption Styles, Not Screenshots
          </h2>
          <p className="text-[#949494] max-w-xl mx-auto">
            These are real animated templates from the editor, running right here on this page.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {TEMPLATES.map((tpl) => (
            <TemplateCard key={tpl.id} tpl={tpl} />
          ))}
        </div>
      </div>
    </section>
  )
}
