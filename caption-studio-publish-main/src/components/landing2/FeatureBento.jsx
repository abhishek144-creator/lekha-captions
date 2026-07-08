import React from 'react'
import { motion } from 'framer-motion'
import { Wand2, Type, Palette, Download, Zap } from 'lucide-react'
import SectionHeader from './SectionHeader'

const SCRIPT_CLOUD = [
  { glyph: 'अ', size: 'text-6xl', tone: 'text-[#F5A623]', tilt: '-rotate-6' },
  { glyph: 'த', size: 'text-4xl', tone: 'text-white/70', tilt: 'rotate-3' },
  { glyph: 'తె', size: 'text-5xl', tone: 'text-white/40', tilt: '-rotate-3' },
  { glyph: 'বা', size: 'text-4xl', tone: 'text-[#F5A623]/70', tilt: 'rotate-6' },
  { glyph: 'ಕ', size: 'text-5xl', tone: 'text-white/60', tilt: '-rotate-2' },
  { glyph: 'മ', size: 'text-3xl', tone: 'text-white/30', tilt: 'rotate-2' },
  { glyph: 'ਪ', size: 'text-4xl', tone: 'text-white/50', tilt: '-rotate-6' },
  { glyph: 'ع', size: 'text-5xl', tone: 'text-[#F5A623]/60', tilt: 'rotate-3' },
  { glyph: 'A', size: 'text-6xl', tone: 'text-white/80', tilt: '-rotate-3' }
]

const SWATCHES = ['#F5A623', '#FCF6BA', '#6EE7FF', '#FF8FA3', '#F2F3F5']

const MINI_WAVE = [10, 22, 14, 30, 18, 34, 24, 12, 28, 20, 36, 16]

function Card({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className={`rounded-2xl border border-white/10 bg-gradient-to-b from-[#161616] to-[#101010] p-7 hover:border-[#F5A623]/40 transition-colors duration-300 ${className}`}
    >
      {children}
    </motion.div>
  )
}

export default function FeatureBento() {
  return (
    <section aria-label="Features" className="bg-[#111111] py-28">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          index="02"
          kicker="THE TOOLKIT"
          title="Everything you need. Nothing you don't."
          blurb="Professional caption tools built for short-form creators — tuned for Indian languages first, fluent in the rest of the world."
        />

        <div className="grid md:grid-cols-6 gap-5">
          {/* Big cell — languages */}
          <Card className="md:col-span-4 flex flex-col justify-between min-h-[300px]">
            <div>
              <h3 className="lv2-display text-3xl text-white mb-3">115+ languages, first-class.</h3>
              <p className="text-[#949494] text-sm leading-relaxed max-w-md">
                South Asian, African, Southeast Asian, Middle Eastern and European regional languages.
                Sarvam AI handles Indian languages with native-level accuracy, Whisper covers the globe.
              </p>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 mt-8 select-none" aria-hidden="true">
              {SCRIPT_CLOUD.map((s, i) => (
                <span key={i} className={`lv2-display ${s.size} ${s.tone} ${s.tilt} inline-block`}>
                  {s.glyph}
                </span>
              ))}
            </div>
          </Card>

          {/* AI generation */}
          <Card className="md:col-span-2 flex flex-col justify-between" delay={0.08}>
            <div>
              <Wand2 className="w-5 h-5 text-[#F5A623] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">AI-powered generation</h3>
              <p className="text-[#949494] text-sm leading-relaxed">
                Auto-transcribed captions that match speech rhythm, word by word.
              </p>
            </div>
            <div className="flex items-end gap-1 h-9 mt-6" aria-hidden="true">
              {MINI_WAVE.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-full bg-[#F5A623]/40 lv2-wavebar"
                  style={{ height: `${h}px`, animationDelay: `${i * 0.09}s` }}
                />
              ))}
            </div>
          </Card>

          {/* Typography */}
          <Card className="md:col-span-2" delay={0.12}>
            <Type className="w-5 h-5 text-[#F5A623] mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Professional typography</h3>
            <p className="text-[#949494] text-sm leading-relaxed mb-5">
              Premium fonts with precise size, weight and spacing controls.
            </p>
            <p className="lv2-display text-4xl text-white/80 select-none" aria-hidden="true">
              Aa <span className="text-[#F5A623]">आ</span> <span className="text-white/40 italic">அஆ</span>
            </p>
          </Card>

          {/* Styling */}
          <Card className="md:col-span-2" delay={0.16}>
            <Palette className="w-5 h-5 text-[#F5A623] mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Custom styling</h3>
            <p className="text-[#949494] text-sm leading-relaxed mb-5">
              Colors, highlights, backgrounds and position — down to a single word.
            </p>
            <div className="flex items-center gap-2" aria-hidden="true">
              {SWATCHES.map((c) => (
                <span key={c} className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: c }} />
              ))}
            </div>
          </Card>

          {/* Export */}
          <Card className="md:col-span-2" delay={0.2}>
            <Download className="w-5 h-5 text-[#F5A623] mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Easy export</h3>
            <p className="text-[#949494] text-sm leading-relaxed mb-5">
              Burned-in video, subtitle file, or plain text — your call.
            </p>
            <div className="flex gap-2" aria-hidden="true">
              {['MP4', 'SRT', 'TXT'].map((f) => (
                <span key={f} className="font-mono text-[10px] tracking-[0.15em] px-3 py-1.5 rounded-full border border-white/15 text-white/70">
                  {f}
                </span>
              ))}
            </div>
          </Card>

          {/* Speed strip */}
          <Card className="md:col-span-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 !py-6" delay={0.24}>
            <div className="flex items-center gap-3 shrink-0">
              <Zap className="w-5 h-5 text-[#F5A623]" />
              <h3 className="text-lg font-semibold text-white">Built for speed</h3>
            </div>
            <p className="text-[#949494] text-sm leading-relaxed">
              Optimized for short-form. No bloat, no render queues, no complexity — upload, caption, ship.
            </p>
          </Card>
        </div>
      </div>
    </section>
  )
}
