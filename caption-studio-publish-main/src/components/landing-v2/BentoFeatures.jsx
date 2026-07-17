import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Globe, Palette, Zap, Download, Wand2 } from 'lucide-react'
import { AMBER, DISPLAY_FONT } from './brand'

const TIMING_WORDS = ['काम', 'ऐसा', 'करो', 'कि', 'नाम', 'बोले']

function TimingDemo() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % TIMING_WORDS.length), 560)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="mt-6 flex flex-wrap gap-x-2.5 gap-y-2">
      {TIMING_WORDS.map((w, i) => (
        <span
          key={i}
          className={`text-xl md:text-2xl font-extrabold px-1.5 py-0.5 rounded-md transition-all duration-200 ${
            i === active ? 'text-black' : i < active ? 'text-white' : 'text-white/35'
          }`}
          style={i === active ? { background: AMBER } : undefined}
        >
          {w}
        </span>
      ))}
    </div>
  )
}

const SCRIPT_GLYPHS = ['अ', 'த', 'అ', 'ব', 'ع', 'ಕ', 'മ', 'A']

export default function BentoFeatures() {
  return (
    <section aria-label="Features" className="bg-[#111111] py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-[#F5A623] mb-4">What you get</p>
          <h2 className="text-3xl md:text-5xl text-white font-semibold leading-tight max-w-2xl" style={{ fontFamily: DISPLAY_FONT }}>
            Built for short-form. Nothing you don't need.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Large tile — word timing with live demo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2 rounded-2xl border border-white/10 bg-[#161616] p-8 hover:border-[#F5A623]/30 transition-colors"
          >
            <Wand2 className="w-6 h-6 text-[#F5A623] mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Word-perfect timing, automatically</h3>
            <p className="text-[#949494] text-sm max-w-md leading-relaxed">
              Auto-transcription generates punchy captions that match speech rhythm —
              each word highlighted exactly when it's spoken.
            </p>
            <TimingDemo />
          </motion.div>

          {/* Languages tile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="rounded-2xl border border-white/10 bg-[#161616] p-8 relative overflow-hidden hover:border-[#F5A623]/30 transition-colors"
          >
            <div className="absolute -right-4 -top-4 flex flex-wrap w-32 gap-1 opacity-[0.08] text-4xl font-bold text-white select-none">
              {SCRIPT_GLYPHS.map((g) => <span key={g}>{g}</span>)}
            </div>
            <Globe className="w-6 h-6 text-[#F5A623] mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Every regional language</h3>
            <p className="text-[#949494] text-sm leading-relaxed">
              115+ languages — South Asian, African, Middle Eastern, Southeast Asian and
              European. Sarvam AI for Indian languages, Whisper for the rest.
            </p>
          </motion.div>

          {/* Styles tile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12 }}
            className="rounded-2xl border border-white/10 bg-[#161616] p-8 hover:border-[#F5A623]/30 transition-colors"
          >
            <Palette className="w-6 h-6 text-[#F5A623] mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">25+ styles, full control</h3>
            <p className="text-[#949494] text-sm leading-relaxed">
              Premium typography with precise control over colors, highlights,
              backgrounds, spacing and position — down to a single word.
            </p>
          </motion.div>

          {/* Speed tile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
            className="rounded-2xl border border-white/10 bg-[#161616] p-8 hover:border-[#F5A623]/30 transition-colors"
          >
            <Zap className="w-6 h-6 text-[#F5A623] mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Built for speed</h3>
            <p className="text-[#949494] text-sm leading-relaxed">
              Optimized for short-form. No bloat, no complexity — upload, caption,
              export, post.
            </p>
          </motion.div>

          {/* Export tile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/10 bg-[#161616] p-8 hover:border-[#F5A623]/30 transition-colors"
          >
            <Download className="w-6 h-6 text-[#F5A623] mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Export your way</h3>
            <p className="text-[#949494] text-sm leading-relaxed mb-4">
              Burned-in video or subtitle files — ready for every platform.
            </p>
            <div className="flex flex-wrap gap-2">
              {['1080p HD', '4K', 'SRT', 'Plain text'].map((chip) => (
                <span key={chip} className="text-xs font-medium text-[#F5A623] border border-[#F5A623]/30 rounded-full px-3 py-1">
                  {chip}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
