import React from 'react'
import { motion } from 'framer-motion'
import { Upload, AudioLines, Palette } from 'lucide-react'
import { DISPLAY_FONT } from './brand'

const steps = [
  {
    num: '01',
    icon: Upload,
    title: 'Drop your short',
    body: 'Upload a reel or short — the 120–180 second sweet spot. No timeline fiddling, no project setup.',
  },
  {
    num: '02',
    icon: AudioLines,
    title: 'AI listens, word by word',
    body: 'Sarvam AI for Indian languages, Whisper for the world. Every word lands with precise, speech-matched timing.',
  },
  {
    num: '03',
    icon: Palette,
    title: 'Style it. Ship it.',
    body: 'Pick from 25+ caption styles, fine-tune per word, then export burned-in 1080p or 4K — or grab the SRT.',
  },
]

export default function WorkflowSection() {
  return (
    <section aria-label="How it works" className="bg-[#111111] py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 md:mb-20"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-[#F5A623] mb-4">How it works</p>
          <h2 className="text-3xl md:text-5xl text-white font-semibold max-w-xl leading-tight" style={{ fontFamily: DISPLAY_FONT }}>
            From raw clip to captioned cut in three moves
          </h2>
        </motion.div>

        <div className="divide-y divide-white/[0.08] border-t border-b border-white/[0.08]">
          {steps.map((step, idx) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.12 }}
              className="group grid md:grid-cols-[140px_1fr_auto] gap-6 md:gap-10 items-center py-10 md:py-12 hover:bg-white/[0.02] transition-colors md:px-4"
            >
              <span
                className="text-6xl md:text-7xl font-bold leading-none select-none"
                style={{
                  fontFamily: DISPLAY_FONT,
                  color: 'transparent',
                  WebkitTextStroke: '1.5px rgba(245,166,35,0.45)',
                }}
              >
                {step.num}
              </span>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-[#949494] max-w-xl leading-relaxed">{step.body}</p>
              </div>
              <div className="hidden md:flex w-14 h-14 rounded-full border border-white/10 items-center justify-center group-hover:border-[#F5A623]/50 transition-colors">
                <step.icon className="w-6 h-6 text-[#F5A623]" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
