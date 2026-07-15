import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { ArrowRight, AudioLines, Check, Play, Sparkles, Wand2 } from 'lucide-react'
import { motion } from 'framer-motion'

const stats = [
  ['115+', 'Languages supported'],
  ['25+', 'Caption styles'],
  ['120–180s', 'Shorts & Reels sweet spot'],
]

const languages = ['हिन्दी', 'English', 'தமிழ்', 'বাংলা', 'తెలుగు', 'العربية', 'मराठी', 'Français', 'ಕನ್ನಡ', 'Português']

function OpenCaptionStage() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.18 }} className="relative mx-auto min-h-[31rem] w-full max-w-[35rem] lg:mr-0">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f5a623]/10" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.07] motion-safe:animate-[spin_38s_linear_infinite]" />
      <div className="pointer-events-none absolute left-[46%] top-[46%] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5a623]/15 blur-[90px]" />

      <motion.div animate={{ y: [0, -7, 0], rotate: [-2, -1, -2] }} transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }} className="absolute left-[3%] top-[5%] w-[72%] -rotate-2 text-left">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.25em] text-white/25">The Poet · T157</p>
        <div className="flex items-baseline gap-2 text-3xl font-bold leading-none tracking-[-0.055em] text-white sm:text-4xl">
          <motion.span initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.2 }}>choose</motion.span>
          <motion.span initial={{ opacity: 0, rotate: -12, scale: 1.25 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ duration: 0.55, delay: 0.38 }} className="font-serif font-normal italic text-[#c9a7ff]">sharp</motion.span>
          <motion.span initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.56 }}>words.</motion.span>
        </div>
        <p className="mt-3 text-xs text-white/35">language is leverage.</p>
      </motion.div>

      <motion.div animate={{ x: [0, 7, 0], y: [0, 4, 0] }} transition={{ duration: 6.6, repeat: Infinity, ease: 'easeInOut' }} className="absolute right-0 top-[36%] w-[76%] text-right">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.25em] text-white/25">The Coach · T158</p>
        <div className="flex items-center justify-end gap-2">
          <motion.span initial={{ opacity: 0, scaleY: 0.1 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ duration: 0.42, delay: 0.65 }} className="text-6xl font-black leading-none tracking-[-0.08em] text-[#6ee7ff] sm:text-7xl">[REPS]</motion.span>
          <div className="text-left text-sm font-semibold uppercase leading-tight text-white/65 sm:text-base"><span className="block">beat</span><span className="block">talent.</span></div>
        </div>
        <p className="mt-3 text-xs text-white/35">sore today, strong tomorrow.</p>
      </motion.div>

      <motion.div animate={{ y: [0, 8, 0], rotate: [1, 2, 1] }} transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut' }} className="absolute bottom-[4%] left-[7%] w-[78%] rotate-1">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.25em] text-white/25">The Calm · T161</p>
        <div className="flex items-baseline gap-2 text-xl font-semibold leading-none text-white/70 sm:text-2xl">
          <motion.span initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }} animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }} transition={{ duration: 0.5, delay: 0.75 }}>in the</motion.span>
          <motion.span initial={{ opacity: 0, scale: 0.35 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: 0.95, ease: [0.22, 1, 0.36, 1] }} className="text-5xl font-black tracking-[-0.07em] text-[#ffd166] sm:text-6xl">PAUSE</motion.span>
        </div>
        <p className="ml-20 mt-2 text-sm font-semibold text-white/55">is the power.</p>
      </motion.div>

      <div className="absolute left-[48%] top-[27%] h-1.5 w-1.5 rounded-full bg-[#f5a623] shadow-[0_0_18px_#f5a623]" />
      <div className="absolute bottom-[24%] right-[9%] text-xl font-light text-white/15">＋</div>
      <div className="absolute left-[4%] top-[48%] text-lg font-light text-white/15">＋</div>
    </motion.div>
  )
}

function HeroBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute left-[52%] top-[44%] h-[52rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f5a623]/10" />
      <div className="absolute left-[52%] top-[44%] h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.07] motion-safe:animate-[spin_55s_linear_infinite]" />
      <div className="absolute left-[52%] top-[44%] h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]" />
      <div className="absolute left-0 top-[24%] h-px w-[42%] -rotate-[12deg] bg-gradient-to-r from-transparent via-[#f5a623]/40 to-transparent" />
      <div className="absolute right-0 top-[64%] h-px w-[44%] -rotate-[12deg] bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" />
      <p className="absolute -left-5 bottom-[4%] whitespace-nowrap text-[5.5rem] font-black uppercase leading-none tracking-[-0.08em] text-transparent opacity-50 [-webkit-text-stroke:1px_rgba(255,255,255,0.055)] sm:text-[10rem] lg:text-[14rem]">Words in motion</p>
    </div>
  )
}

export default function HeroSection() {
  return (
    <section aria-label="Lekha Captions introduction" className="relative isolate overflow-hidden pb-14 pt-20 sm:pb-20 sm:pt-28">
      <HeroBackground />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:px-8">
        <div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f5a623]/25 bg-[#f5a623]/[0.07] px-3.5 py-2 text-xs font-medium text-white shadow-2xl shadow-black/20 backdrop-blur-xl sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#f5a623]" />
              115+ Languages. Built for every global audience.
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08 }} className="mt-7 max-w-4xl text-5xl font-semibold leading-[0.92] tracking-[-0.067em] text-white drop-shadow-[0_8px_34px_rgba(0,0,0,0.65)] sm:text-6xl lg:text-[5.6rem]">
            Professional Captions in <span className="relative inline-block font-serif font-normal italic text-[#f5a623]">Your Language<span className="absolute -bottom-1 left-2 right-0 h-px bg-gradient-to-r from-transparent via-[#f5a623] to-transparent shadow-[0_0_18px_#f5a623]" /></span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mt-7 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg">
            115+ languages. Indic, African, Arab, Southeast Asian, European, and English. Professional captions at creator-friendly pricing.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to={createPageUrl('Dashboard')} className="group inline-flex items-center justify-center gap-2 rounded-md bg-[#f5a623] px-5 py-3 text-sm font-semibold text-[#15100a] shadow-[0_12px_40px_-12px_rgba(245,166,35,0.7)] transition hover:bg-[#ffb53a]">
              <Play className="h-4 w-4 fill-current" /> Upload Video <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to={createPageUrl('Dashboard')} className="inline-flex items-center justify-center rounded-md border border-white/20 bg-black/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:border-white/35 hover:bg-white/[0.07]">Try for Free</Link>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.42 }} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#f5a623]" />25+ visual styles</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#f5a623]" />Precise editing control</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#f5a623]" />HD &amp; 4K plan options</span>
          </motion.div>
        </div>

        <OpenCaptionStage />
      </div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.5 }} className="relative mx-auto mt-16 grid max-w-6xl divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/[0.1] bg-black/35 shadow-2xl shadow-black/30 backdrop-blur-xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {stats.map(([value, label], index) => (
          <div key={label} className="group relative overflow-hidden px-6 py-5 text-center">
            <div className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-[#f5a623] to-transparent transition-transform duration-500 group-hover:scale-x-100" />
            <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-1 text-xs text-white/40">{label}</p>
            {index === 0 && <AudioLines className="absolute -right-2 -top-3 h-16 w-16 text-[#f5a623]/[0.06]" />}
            {index === 1 && <Wand2 className="absolute -right-2 -top-3 h-16 w-16 text-[#f5a623]/[0.06]" />}
          </div>
        ))}
      </motion.div>

      <div className="relative mt-10 overflow-hidden border-y border-white/[0.06] bg-black/20 py-3 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="lekha-marquee flex w-max items-center whitespace-nowrap">
          {[...languages, ...languages].map((language, index) => <span key={`${language}-${index}`} className="mx-5 text-sm font-medium text-white/40"><span className="mr-10 text-[#f5a623]/70">✦</span>{language}</span>)}
        </div>
      </div>
    </section>
  )
}
