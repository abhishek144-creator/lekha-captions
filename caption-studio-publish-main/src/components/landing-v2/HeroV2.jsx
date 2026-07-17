import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Mic } from 'lucide-react'
import { GOLD_GRADIENT, AMBER, DISPLAY_FONT } from './brand'

const ROTATING_LANGUAGES = [
  { word: 'हिन्दी', lang: 'Hindi' },
  { word: 'தமிழ்', lang: 'Tamil' },
  { word: 'తెలుగు', lang: 'Telugu' },
  { word: 'বাংলা', lang: 'Bangla' },
  { word: 'العربية', lang: 'Arabic' },
  { word: 'Kiswahili', lang: 'Swahili' },
  { word: 'English', lang: 'English' },
]

const CAPTION_SCENES = [
  ['सपने', 'बड़े', 'रखो'],
  ['मेहनत', 'बोलती', 'है'],
  ['हर', 'भाषा', 'में', 'सुनो'],
]

const WORD_MS = 640

function PhoneCaptionDemo() {
  const [sceneIdx, setSceneIdx] = useState(0)
  const [activeWord, setActiveWord] = useState(0)
  const scene = CAPTION_SCENES[sceneIdx]

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeWord < scene.length - 1) {
        setActiveWord(activeWord + 1)
      } else {
        setSceneIdx((sceneIdx + 1) % CAPTION_SCENES.length)
        setActiveWord(0)
      }
    }, WORD_MS)
    return () => clearTimeout(timer)
  }, [activeWord, sceneIdx, scene.length])

  const progress = ((sceneIdx * 3 + activeWord + 1) / (CAPTION_SCENES.length * 3)) * 100

  return (
    <div className="relative mx-auto w-[260px] md:w-[300px]">
      {/* Glow behind phone */}
      <div className="absolute -inset-10 rounded-full opacity-25 blur-3xl" style={{ background: 'radial-gradient(circle, #F5A623 0%, transparent 70%)' }} />

      <div className="relative aspect-[9/18] rounded-[2.5rem] border border-white/15 bg-[#0d0d0d] overflow-hidden shadow-2xl shadow-black/60">
        {/* Faux video backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_20%,#2a2113_0%,#141210_45%,#0a0a0a_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:100%_5px] opacity-40" />

        {/* Editor chrome */}
        <div className="absolute top-4 inset-x-0 flex items-center justify-between px-5">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-white/60">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            0:0{sceneIdx + 1} / 0:03
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-[#F5A623]/90">
            <Mic className="w-3 h-3" /> hi-IN
          </span>
        </div>

        {/* Live caption block */}
        <div className="absolute inset-x-0 bottom-[22%] px-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={sceneIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="flex flex-wrap justify-center gap-x-2 gap-y-1.5"
            >
              {scene.map((w, i) => (
                <span
                  key={i}
                  className={`text-[22px] md:text-[24px] font-extrabold leading-tight px-1.5 py-0.5 rounded-md transition-all duration-200 ${
                    i === activeWord
                      ? 'text-black scale-105'
                      : i < activeWord ? 'text-white' : 'text-white/45'
                  }`}
                  style={i === activeWord ? { background: AMBER } : undefined}
                >
                  {w}
                </span>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Timeline bar */}
        <div className="absolute bottom-8 inset-x-5">
          <div className="h-0.5 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: GOLD_GRADIENT }} />
          </div>
          <div className="mt-2 flex gap-1">
            {[3, 5, 2, 6, 4, 7, 3, 5, 4, 2, 6, 3].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-[#F5A623]/25" style={{ height: `${h + 3}px` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Floating chip */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute -right-6 top-16 md:-right-14 rounded-xl border border-white/10 bg-[#1A1A1A]/95 backdrop-blur px-3 py-2 shadow-xl"
      >
        <p className="text-[10px] uppercase tracking-widest text-[#949494]">Word timing</p>
        <p className="text-sm font-semibold text-white">auto-synced</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="absolute -left-6 bottom-24 md:-left-14 rounded-xl border border-white/10 bg-[#1A1A1A]/95 backdrop-blur px-3 py-2 shadow-xl"
      >
        <p className="text-[10px] uppercase tracking-widest text-[#949494]">Export</p>
        <p className="text-sm font-semibold text-white">1080p · 4K</p>
      </motion.div>
    </div>
  )
}

export default function HeroV2() {
  const [langIdx, setLangIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setLangIdx((prev) => (prev + 1) % ROTATING_LANGUAGES.length)
    }, 2200)
    return () => clearInterval(timer)
  }, [])

  const current = ROTATING_LANGUAGES[langIdx]

  return (
    <section aria-label="Hero" className="relative overflow-hidden bg-[#111111] pt-28 pb-20 md:pt-36 md:pb-28">
      {/* Ambient gold wash, top-left */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full opacity-[0.07] blur-3xl" style={{ background: 'radial-gradient(circle, #F5A623, transparent 65%)' }} />

      <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.15fr_0.85fr] gap-16 lg:gap-8 items-center">
        {/* Left — editorial headline */}
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-xs md:text-sm uppercase tracking-[0.25em] text-[#F5A623] mb-6"
          >
            115+ languages · 25+ caption styles
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-[4.6rem] font-semibold text-white leading-[1.05] tracking-tight"
            style={{ fontFamily: DISPLAY_FONT }}
          >
            Say it once.
            <span className="block mt-2 text-[#949494] text-3xl md:text-4xl lg:text-[2.6rem] font-normal">
              Caption it in
            </span>
            <span className="block mt-1 min-h-[1.2em]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={langIdx}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.35 }}
                  className="inline-block bg-clip-text text-transparent"
                  style={{ backgroundImage: GOLD_GRADIENT }}
                >
                  {current.word}
                </motion.span>
              </AnimatePresence>
              <span className="text-white">.</span>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 text-lg text-[#949494] max-w-md leading-relaxed"
          >
            Word-perfect captions for Indic, African, Arab, Southeast Asian and
            European languages — at creator-friendly pricing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          >
            <Link
              to={createPageUrl('Dashboard')}
              className="group inline-flex items-center gap-2 rounded-[4px] px-7 py-4 text-base font-semibold text-black transition-transform hover:-translate-y-0.5"
              style={{ background: GOLD_GRADIENT }}
            >
              Start captioning free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-[4px] border border-white/20 px-7 py-4 text-base font-semibold text-white hover:bg-white/5 transition-colors"
            >
              See pricing
            </a>
          </motion.div>

          {/* Stats — inline editorial row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-14 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/[0.08] pt-6"
          >
            {[
              { value: '115+', label: 'languages' },
              { value: '25+', label: 'caption styles' },
              { value: '120–180s', label: 'shorts sweet spot' },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white" style={{ fontFamily: DISPLAY_FONT }}>{s.value}</span>
                <span className="text-sm text-[#949494]">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right — live phone demo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <PhoneCaptionDemo />
        </motion.div>
      </div>
    </section>
  )
}
