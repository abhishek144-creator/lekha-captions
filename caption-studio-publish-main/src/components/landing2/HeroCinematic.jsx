import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const rotatingHeroLanguages = [
  'English', 'தமிழ்', 'हिन्दी', 'বাংলা', 'తెలుగు', 'العربية', '中文', 'Deutsch',
  'Français', 'Português', 'Español', 'Kiswahili', '日本語',
]

const stampCards = [
  {
    label: 'हिन्दी', sublabel: 'Hindi · Indic',
    tone: 'text-[#f5a623] border-[#2b2416] bg-[#11100d]',
    style: 'left-[1%] top-[8%] rotate-[-7deg]',
    float: { x: [0, 11, -5, 0], y: [0, -12, 6, 0], rotate: [-4, -2, -5, -4] }, duration: 9.4,
  },
  {
    label: 'English', sublabel: 'English · Global',
    tone: 'text-[#f0f7ff] border-[#182230] bg-[#0b1017]',
    style: 'right-[3%] top-[-2%] rotate-[-4deg]',
    float: { x: [0, -7, 4, 0], y: [0, -9, 5, 0], rotate: [-4, -2, -5, -4] }, duration: 10.2,
    compact: true,
  },
  {
    label: 'العربية', sublabel: 'Arabic · RTL',
    tone: 'text-[#f8cb52] border-[#2d2410] bg-[#131008]',
    style: 'right-[-9%] top-[17%] rotate-[5deg]',
    float: { x: [0, -10, 5, 0], y: [0, 8, -9, 0], rotate: [1, -1, 3, 1] }, duration: 10.6,
  },
  {
    label: 'Kiswahili', sublabel: 'Swahili · African',
    tone: 'text-[#f0f4f8] border-[#142018] bg-[#0c100d]',
    style: 'left-[-15%] top-[79%] rotate-[6deg]',
    float: { x: [0, 9, -4, 0], y: [0, 10, -6, 0], rotate: [3, 1, 4, 3] }, duration: 11.4,
  },
  {
    label: '日本語', sublabel: 'Japanese · CJK',
    tone: 'text-[#f4f4f4] border-[#18212b] bg-[#0d1116]',
    style: 'right-[-13%] top-[62%] rotate-[-6deg]',
    float: { x: [0, -8, 4, 0], y: [0, -11, 7, 0], rotate: [-2, 0, -3, -2] }, duration: 9.9,
  },
  {
    label: '中文', sublabel: 'Chinese · CJK',
    tone: 'text-[#9cf6e8] border-[#102826] bg-[#081211]',
    style: 'left-[3%] top-[54%] rotate-[-9deg]',
    float: { x: [0, 8, -5, 0], y: [0, -8, 7, 0], rotate: [-2, -4, 0, -2] }, duration: 12.1,
  },
  {
    label: 'Deutsch', sublabel: 'German · Europe',
    tone: 'text-[#ffd166] border-[#30250d] bg-[#151105]',
    style: 'left-[7%] top-[101%] rotate-[4deg]',
    float: { x: [0, -7, 5, 0], y: [0, 8, -6, 0], rotate: [2, -1, 3, 2] }, duration: 10.1,
  },
  {
    label: 'Français', sublabel: 'French · Europe',
    tone: 'text-[#b9c7ff] border-[#1b2035] bg-[#0b0e18]',
    style: 'left-[-14%] top-[31%] rotate-[3deg]',
    float: { x: [0, 6, -4, 0], y: [0, 9, -5, 0], rotate: [-1, 2, -2, -1] }, duration: 11.7,
  },
  {
    label: 'Español', sublabel: 'Spanish · Global',
    tone: 'text-[#ffb4a2] border-[#30201c] bg-[#150d0a]',
    style: 'right-[-10%] top-[94%] rotate-[7deg]',
    float: { x: [0, -6, 5, 0], y: [0, -10, 6, 0], rotate: [2, 0, 4, 2] }, duration: 10.8,
  },
  {
    label: 'Português', sublabel: 'Portuguese · Global',
    tone: 'text-[#98f5a8] border-[#172a1b] bg-[#0b120c]',
    style: 'right-[2%] top-[39%] rotate-[-3deg]',
    float: { x: [0, -8, 5, 0], y: [0, -7, 8, 0], rotate: [1, 3, -1, 1] }, duration: 11.5,
  },
]

const proofTags = ['100+ visual styles', 'Precise editing control', 'HD & 4K plan options']

const stats = [
  { value: '115+', label: 'Languages' },
  { value: '100+', label: 'Caption styles' },
  { value: '120-180s', label: 'Typical turnaround' },
]

function TicketButton({ children, accent = false, to }) {
  return (
    <Link
      to={to}
      className={`group relative inline-flex min-w-[7.8rem] items-center justify-center overflow-hidden rounded-[0.4rem] border px-6 py-3 text-sm font-semibold transition ${accent ? 'border-white bg-white text-black shadow-[0_12px_34px_-18px_rgba(255,255,255,0.9)] hover:bg-white/90' : 'border-white/[0.14] bg-transparent text-white hover:border-white/28'}`}
    >
      <span className={`absolute -left-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border ${accent ? 'border-white bg-[#070706]' : 'border-white/[0.12] bg-[#070706]'}`} />
      <span className={`absolute -right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border ${accent ? 'border-white bg-[#070706]' : 'border-white/[0.12] bg-[#070706]'}`} />
      <span className={`absolute inset-[4px] rounded-[0.28rem] border border-dashed ${accent ? 'border-black/25' : 'border-white/[0.12]'}`} />
      <span className="relative">{children}</span>
    </Link>
  )
}

function StampCard({ label, sublabel, tone, style, float, duration, compact = false }) {
  const shouldReduceMotion = useReducedMotion()
  const usesCompactLabel = ['Kiswahili', 'Français', 'Español', 'Português'].includes(label)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`absolute hidden ${compact ? 'w-[7.35rem]' : 'w-[8.1rem]'} lg:block ${style}`}
    >
      <motion.div
        animate={shouldReduceMotion ? undefined : float}
        transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
        className={`landing-stamp-card relative rounded-[0.35rem] border ${compact ? 'px-3.5 py-3.5' : 'px-4 py-4'} shadow-[0_18px_50px_rgba(0,0,0,0.38)] ${tone}`}
      >
        <div className="absolute right-3 top-3 h-5 w-5 rounded-full border border-current/50" />
        <div className="absolute inset-0 opacity-30 [clip-path:polygon(0_10%,3%_0,97%_0,100%_10%,100%_90%,97%_100%,3%_100%,0_90%)] [background:linear-gradient(90deg,transparent_0,transparent_6%,rgba(255,255,255,0.08)_6%,rgba(255,255,255,0.08)_12%,transparent_12%,transparent_88%,rgba(255,255,255,0.08)_88%,rgba(255,255,255,0.08)_94%,transparent_94%)]" />
        <div className="relative">
          <p className={`${compact ? 'text-[1.42rem]' : usesCompactLabel ? 'text-[1.65rem]' : 'text-[1.95rem]'} font-semibold leading-none`}>{label}</p>
          <p className={`${compact ? 'mt-2.5 text-[0.42rem]' : 'mt-3 text-[0.48rem]'} uppercase tracking-[0.24em] text-white/42`}>{sublabel}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function RollingHeroLanguage() {
  const [index, setIndex] = useState(0)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (shouldReduceMotion) return undefined
    const interval = window.setInterval(() => setIndex((current) => (current + 1) % rotatingHeroLanguages.length), 2800)
    return () => window.clearInterval(interval)
  }, [shouldReduceMotion])

  return (
    <span className="relative grid min-h-[1.15em] w-[5.4ch] max-w-[70vw] overflow-hidden" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={rotatingHeroLanguages[index]}
          initial={shouldReduceMotion ? false : { opacity: 0, y: '105%', filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: '0%', filter: 'blur(0px)' }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: '-105%', filter: 'blur(5px)' }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          className={`col-start-1 row-start-1 whitespace-nowrap text-center ${rotatingHeroLanguages[index] === 'Kiswahili' ? 'text-[0.68em] tracking-[-0.035em]' : ''}`}
        >
          {rotatingHeroLanguages[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export default function HeroCinematic() {
  return (
    <section aria-label="Lekha Captions introduction" className="landing-section-hero relative overflow-hidden px-5 pb-24 pt-7 sm:px-6 sm:pb-32 lg:px-8">
      <div className="relative mx-auto max-w-7xl py-12 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[44rem]">
          <div className="absolute inset-[8%] rounded-[2rem] bg-[radial-gradient(circle_at_50%_42%,rgba(245,166,35,0.07),transparent_38%)]" />
          {stampCards.map((card) => <StampCard key={card.label} {...card} />)}
        </div>

        <div className="relative z-10 mx-auto flex max-w-[64rem] flex-col items-center pt-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-[2rem] font-semibold leading-[0.96] tracking-[-0.06em] text-white min-[420px]:text-[2.35rem] sm:text-[4.45rem] lg:text-[5rem]"
          >
            <span className="block whitespace-nowrap">Professional Captions in</span>
            <span className="mt-5 inline-flex items-center rounded-[0.35rem] border border-[#f5a623] px-4 py-1.5 text-[#f5a623] shadow-[0_0_0_1px_rgba(245,166,35,0.2)] sm:mt-6">
              <RollingHeroLanguage />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-6 max-w-[35rem] text-base leading-8 text-white/72"
          >
            115+ languages. Indic, African, Arab, Southeast Asian, European, and English. Professional captions at <span className="font-serif italic text-white/92">creator-friendly</span> pricing.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"
          >
            <TicketButton accent to={createPageUrl('Dashboard')}>Upload Video</TicketButton>
            <TicketButton to={createPageUrl('Dashboard')}>Try for Free</TicketButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24 }}
            className="mt-6 flex flex-wrap justify-center gap-3"
          >
            {proofTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-2 border border-white/[0.1] px-3 py-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-white/62">
                <span className="text-[#f5a623]">&#9745;</span>
                {tag}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 w-full border-t border-white/[0.08] pt-5"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="landing-stat-card relative rounded-[0.45rem] border border-white/[0.12] bg-[#080807]/80 px-4 pb-3 pt-4 backdrop-blur-sm">
                  <span className="absolute -top-3 left-8 h-6 w-px bg-white/[0.2]" />
                  <span className="absolute -top-[0.38rem] left-[1.9rem] h-2.5 w-2.5 rounded-full border border-white/[0.2] bg-[#070706]" />
                  <p className="text-[1.8rem] font-semibold tracking-[-0.04em] text-white">{stat.value}</p>
                  <p className="mt-1 text-[0.58rem] uppercase tracking-[0.22em] text-white/42">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
