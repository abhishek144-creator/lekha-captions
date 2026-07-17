import React from 'react'
import { motion } from 'framer-motion'

const ROW_A = [
  'हिन्दी', 'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ', 'മലയാളം', 'मराठी', 'বাংলা', 'ગુજરાતી',
  'ਪੰਜਾਬੀ', 'ଓଡ଼ିଆ', 'অসমীয়া', 'اردو', 'नेपाली', 'සිංහල',
]

const ROW_B = [
  'العربية', 'Kiswahili', 'አማርኛ', 'Yorùbá', 'Hausa', 'English', 'Español',
  'Français', 'Deutsch', 'Português', 'Bahasa', 'Tiếng Việt', 'ไทย', 'Filipino',
]

function MarqueeRow({ items, reverse = false, duration = 42 }) {
  const doubled = [...items, ...items]
  return (
    <div className="relative overflow-hidden py-3">
      <motion.div
        className="flex w-max items-center gap-8 whitespace-nowrap"
        animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
        transition={{ duration, ease: 'linear', repeat: Infinity }}
      >
        {doubled.map((lang, i) => (
          <span key={i} className="flex items-center gap-8">
            <span className="text-2xl md:text-3xl font-medium text-white/70 hover:text-white transition-colors">
              {lang}
            </span>
            <span className="text-[#F5A623] text-xs">✦</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}

export default function LanguageMarquee() {
  return (
    <section aria-label="Languages" className="relative bg-[#0d0d0d] border-y border-white/[0.06] py-10 overflow-hidden">
      <div className="text-center mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-[#949494]">
          one upload · <span className="text-[#F5A623]">115+ languages</span> · every audience
        </p>
      </div>
      <MarqueeRow items={ROW_A} duration={46} />
      <MarqueeRow items={ROW_B} reverse duration={52} />

      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0d0d0d] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0d0d0d] to-transparent" />
    </section>
  )
}
