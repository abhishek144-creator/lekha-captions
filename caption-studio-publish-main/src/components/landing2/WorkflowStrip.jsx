import React from 'react'
import { motion } from 'framer-motion'
import SectionHeader from './SectionHeader'

const STEPS = [
  {
    tc: '00:00',
    title: 'Upload',
    desc: 'Drop any short-form video — Reels, Shorts, up to 3 minutes.'
  },
  {
    tc: '00:12',
    title: 'AI transcribes',
    desc: 'Sarvam AI for Indian languages, Whisper for the world. Word-level timing included.'
  },
  {
    tc: '00:47',
    title: 'Style it',
    desc: '25+ caption styles with full control over fonts, colors and highlights — per word if you want.'
  },
  {
    tc: '01:30',
    title: 'Export',
    desc: 'Burned-in 1080p or 4K video, or take the SRT and go.'
  }
]

export default function WorkflowStrip() {
  return (
    <section aria-label="How it works" className="bg-[#0D0D0D] py-28">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          index="01"
          kicker="HOW IT WORKS"
          title="Upload to export, like clips on a timeline."
          blurb="No timelines to learn, no keyframes to fight. The whole flow takes about as long as watching your video once."
        />

        <div className="grid md:grid-cols-4 gap-x-8 gap-y-12">
          {STEPS.map((step, idx) => (
            <motion.div
              key={step.tc}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.12 }}
              className="relative pt-8"
            >
              {/* timeline rail + marker */}
              <div className="absolute top-0 left-0 right-0 border-t border-white/10" aria-hidden="true" />
              <div className="absolute -top-[5px] left-0 w-2.5 h-2.5 rounded-full lv2-gold-bg" aria-hidden="true" />

              <p className="font-mono text-xs tracking-[0.2em] text-[#F5A623] mb-3">{step.tc}</p>
              <h3 className="lv2-display text-2xl text-white mb-3">{step.title}</h3>
              <p className="text-sm text-[#949494] leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
