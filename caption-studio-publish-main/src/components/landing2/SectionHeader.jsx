import React from 'react'
import { motion } from 'framer-motion'

export default function SectionHeader({ index, kicker, title, blurb, align = 'left' }) {
  const centered = align === 'center'
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`mb-14 ${centered ? 'text-center' : ''}`}
    >
      <p className={`font-mono text-[11px] tracking-[0.3em] text-[#949494] mb-5 flex items-center gap-3 ${centered ? 'justify-center' : ''}`}>
        <span className="text-[#F5A623]">{index}</span>
        <span className="w-8 h-px bg-[#F5A623]/50" aria-hidden="true" />
        {kicker}
      </p>
      <h2 className="lv2-display text-4xl md:text-5xl text-white font-semibold leading-tight">{title}</h2>
      {blurb && (
        <p className={`mt-5 text-[#949494] max-w-xl leading-relaxed ${centered ? 'mx-auto' : ''}`}>{blurb}</p>
      )}
    </motion.div>
  )
}
