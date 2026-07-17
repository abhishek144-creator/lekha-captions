import { motion } from 'framer-motion'

const bubbles = [
  { label: 'मराठी', sublabel: 'Marathi', tone: 'border-white/[0.13] text-white/80', style: 'left-[5%] top-10' },
  { label: 'ગુજરાતી', sublabel: 'Gujarati', tone: 'border-[#f5a623]/40 text-[#f5a623]', style: 'left-[15%] top-14' },
  { label: 'ਪੰਜਾਬੀ', sublabel: 'Punjabi', tone: 'border-white/[0.13] text-white/75', style: 'left-[25%] top-10' },
  { label: 'Yorùbá', sublabel: 'Yoruba', tone: 'border-[#52c7ff]/35 text-[#6ee7ff]', style: 'left-[36%] top-[3.8rem]' },
  { label: 'አማርኛ', sublabel: 'Amharic', tone: 'border-white/[0.13] text-white/70', style: 'left-[47%] top-10' },
  { label: 'Bahasa', sublabel: 'Indonesian', tone: 'border-[#8e71ff]/35 text-[#b993ff]', style: 'left-[58%] top-12' },
  { label: 'ไทย', sublabel: 'Thai', tone: 'border-white/[0.13] text-white/70', style: 'left-[69%] top-[4.4rem]' },
  { label: 'Tiếng Việt', sublabel: 'Vietnamese', tone: 'border-[#ff7b9f]/35 text-[#ff8fa3]', style: 'left-[78%] top-9' },
  { label: '한국어', sublabel: 'Korean', tone: 'border-white/[0.13] text-white/70', style: 'right-[6%] top-14' },
  { label: 'Français', sublabel: 'French', tone: 'border-[#f5a623]/35 text-[#ffd166]', style: 'left-[24%] top-[11.2rem]' },
  { label: 'Deutsch', sublabel: 'German', tone: 'border-white/[0.13] text-white/72', style: 'left-[37%] top-[13rem]' },
  { label: 'Español', sublabel: 'Spanish', tone: 'border-white/[0.13] text-white/72', style: 'left-[47%] top-[11.2rem]' },
  { label: 'Português', sublabel: 'Portuguese', tone: 'border-white/[0.13] text-white/72', style: 'left-[58%] top-[12rem]' },
  { label: 'Türkçe', sublabel: 'Turkish', tone: 'border-[#f5a623]/35 text-[#f5a623]', style: 'left-[69%] top-[11.2rem]' },
]

function Bubble({ label, sublabel, tone, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26, scale: 0.86 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
      className={`landing-language-bubble absolute hidden h-24 w-24 rounded-full border bg-black/30 backdrop-blur-sm sm:flex sm:flex-col sm:items-center sm:justify-center ${tone} ${style}`}
    >
      <span className="text-[1.15rem] font-semibold leading-none">{label}</span>
      <span className="mt-2 text-[0.55rem] uppercase tracking-[0.22em] text-white/35">{sublabel}</span>
    </motion.div>
  )
}

export default function LanguagePassportStrip() {
  return (
    <motion.section
      aria-label="Language strip"
      initial={{ opacity: 0, y: 42 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      className="landing-section-languages relative px-5 pt-6 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.05] bg-black/10 px-4 pb-10 pt-6 sm:px-8 sm:pb-14">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_38%)]" />
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px] opacity-35" />

          <div className="relative h-[15.5rem]">
            {bubbles.map((bubble) => <Bubble key={bubble.label} {...bubble} />)}

            <div className="flex h-full items-end justify-center sm:hidden">
              <div className="grid grid-cols-2 gap-3">
                {bubbles.slice(0, 8).map((bubble) => (
                  <div key={bubble.label} className={`landing-language-bubble flex h-20 w-20 flex-col items-center justify-center rounded-full border bg-black/35 text-center ${bubble.tone}`}>
                    <span className="text-sm font-semibold leading-none">{bubble.label}</span>
                    <span className="mt-2 text-[0.45rem] uppercase tracking-[0.18em] text-white/35">{bubble.sublabel}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px border-t border-dashed border-white/[0.12]" />
        </div>
      </div>
    </motion.section>
  )
}
