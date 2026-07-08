import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { ArrowRight, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import LiveCaption from './LiveCaption'

const HERO_PHRASES = [
  { lang: 'हिन्दी', words: ['हर', 'शब्द', 'अब', 'दिखेगा।'] },
  { lang: 'English', words: ['every', 'word', 'finally', 'lands.'] },
  { lang: 'தமிழ்', words: ['ஒவ்வொரு', 'வார்த்தையும்', 'தெரியும்.'] },
  { lang: 'తెలుగు', words: ['ప్రతి', 'మాట', 'కనిపిస్తుంది.'] },
  { lang: 'বাংলা', words: ['প্রতিটি', 'শব্দ', 'দেখা', 'যায়।'] },
  { lang: 'मराठी', words: ['प्रत्येक', 'शब्द', 'दिसेल.'] }
]

const PHONE_PHRASES = [
  { lang: 'हिन्दी', words: ['रुको!', 'ये', 'ट्रिक', 'देखो'] },
  { lang: 'English', words: ['captions', 'that', 'POP'] },
  { lang: 'हिन्दी', words: ['बिना', 'watermark', 'के'] },
  { lang: 'English', words: ['styled', 'in', 'seconds'] }
]

const WAVE_BARS = [14, 26, 18, 34, 22, 40, 30, 16, 36, 24, 44, 28, 18, 38, 26, 14, 32, 20]

const CLIP_WIDTHS = ['14%', '22%', '10%', '18%', '12%', '16%']

function PhonePreview() {
  return (
    <div className="relative mx-auto w-[270px] md:w-[310px]">
      {/* halo */}
      <div className="absolute -inset-10 rounded-full bg-[#F5A623]/10 blur-3xl" aria-hidden="true" />

      <div className="relative aspect-[9/16] rounded-[2.2rem] p-[1.5px] lv2-gold-bg shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <div className="relative w-full h-full rounded-[2.1rem] bg-[#0B0B0C] overflow-hidden flex flex-col">
          {/* faux video atmosphere */}
          <div className="absolute -top-16 -right-14 w-52 h-52 rounded-full bg-[#F5A623]/15 blur-3xl lv2-drift" aria-hidden="true" />
          <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full bg-[#6EE7FF]/10 blur-3xl lv2-drift-slow" aria-hidden="true" />

          {/* top bar */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-4">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              REC
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-[#F5A623]">आ → A → அ</span>
          </div>

          {/* live caption */}
          <div className="relative z-10 flex-1 flex items-center justify-center px-5">
            <LiveCaption
              phrases={PHONE_PHRASES}
              stepMs={380}
              holdMs={1300}
              className="justify-center text-center text-[1.45rem] font-extrabold leading-snug"
            />
          </div>

          {/* editor chrome */}
          <div className="relative z-10 px-5 pb-5 space-y-3">
            {/* waveform */}
            <div className="flex items-end justify-between gap-[3px] h-10" aria-hidden="true">
              {WAVE_BARS.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-full bg-[#F5A623]/50 lv2-wavebar"
                  style={{ height: `${h}px`, animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
            {/* caption clips */}
            <div className="flex gap-1" aria-hidden="true">
              {CLIP_WIDTHS.map((w, i) => (
                <span
                  key={i}
                  className={`h-2 rounded-sm ${i === 2 ? 'bg-[#F5A623]' : 'bg-[#F5A623]/25'}`}
                  style={{ width: w }}
                />
              ))}
            </div>
            {/* playhead */}
            <div className="h-[3px] rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full lv2-gold-bg lv2-playhead" />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-white/40">
              <span>00:42</span>
              <span>01:30</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HeroCinema() {
  const [lang, setLang] = useState(HERO_PHRASES[0].lang)

  return (
    <section aria-label="Hero" className="relative overflow-hidden bg-[#0D0D0D]">
      {/* film-column hairlines */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 25%)' }}
        aria-hidden="true"
      />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[#F5A623]/[0.06] blur-3xl" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-16">
        <div className="grid lg:grid-cols-12 gap-14 lg:gap-8 items-center">
          {/* Left — editorial type + live engine */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-7"
          >
            <p className="font-mono text-[11px] tracking-[0.3em] text-[#949494] mb-8 flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623]" />
              LEKHA CAPTIONS · 115+ LANGUAGES · ONE UPLOAD
            </p>

            <h1 className="lv2-display text-[clamp(3rem,7vw,6.2rem)] leading-[0.98] text-white font-semibold">
              Your voice,
              <span className="block italic lv2-gold-text pb-2">in every language.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-[#949494] leading-relaxed">
              AI captions with word-perfect timing — Hindi, Tamil, Telugu, Bangla and 111 more.
              Styled, animated and export-ready at creator-friendly pricing.
            </p>

            {/* live caption engine */}
            <div className="mt-10 max-w-xl rounded-2xl border border-white/10 bg-[#111111]/90 backdrop-blur px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] tracking-[0.25em] text-white/40">
                  LIVE PREVIEW — REAL CAPTION ENGINE
                </span>
                <span className="font-mono text-[10px] tracking-[0.15em] px-2 py-0.5 rounded-full border border-[#F5A623]/40 text-[#F5A623]">
                  {lang}
                </span>
              </div>
              <LiveCaption
                phrases={HERO_PHRASES}
                onPhraseChange={(p) => setLang(p.lang)}
                className="text-2xl md:text-[1.7rem] font-bold min-h-[2.6em] content-center"
              />
            </div>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                to={createPageUrl('Dashboard')}
                className="group inline-flex items-center justify-center gap-2 rounded-full lv2-gold-bg text-black font-semibold px-8 py-4 text-base hover:brightness-110 transition-all"
              >
                <Play className="w-4 h-4 fill-black" />
                Start captioning — free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center justify-center rounded-full border border-white/15 text-white font-semibold px-8 py-4 text-base hover:bg-white/5 hover:border-white/30 transition-all"
              >
                See pricing
              </a>
            </div>

            <p className="mt-6 font-mono text-[11px] tracking-[0.2em] text-[#949494]/80">
              NO WATERMARK · 1080P + 4K EXPORT · 25+ CAPTION STYLES
            </p>
          </motion.div>

          {/* Right — phone preview */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="lg:col-span-5"
          >
            <PhonePreview />
          </motion.div>
        </div>

        {/* Stats ruler */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20"
        >
          <div className="flex items-end justify-between h-4 border-b border-white/10 pb-1" aria-hidden="true">
            {Array.from({ length: 61 }).map((_, i) => (
              <span key={i} className={`w-px ${i % 10 === 0 ? 'h-3 bg-white/30' : 'h-1.5 bg-white/10'}`} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-6 pt-6">
            {[
              { value: '115+', label: 'LANGUAGES SUPPORTED' },
              { value: '25+', label: 'CAPTION STYLES' },
              { value: '120–180s', label: 'SHORTS & REELS SWEET SPOT' }
            ].map((stat) => (
              <div key={stat.label}>
                <div className="lv2-display text-3xl md:text-4xl text-white">{stat.value}</div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-[#949494] mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
