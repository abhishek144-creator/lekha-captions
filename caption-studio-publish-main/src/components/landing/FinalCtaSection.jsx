import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { ArrowRight, Captions, Globe2, Play, Sparkles } from 'lucide-react'
import { motion, useScroll, useTransform } from 'framer-motion'

const storyBeats = [
  { time: '00:01', label: 'SAY IT.', className: 'text-white' },
  { time: '00:02', label: 'STYLE IT.', className: 'font-serif italic text-[#ffd166]' },
  { time: '00:03', label: 'TRANSLATE IT.', className: 'text-[#6ee7ff]' },
  { time: '00:04', label: 'SHARE IT.', className: 'text-white' },
]

const languageSignals = ['हिन्दी', 'English', 'தமிழ்', 'العربية', 'Español', 'Kiswahili']

export default function FinalCtaSection() {
  const sectionRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })
  const wordY = useTransform(scrollYProgress, [0, 1], [70, -70])
  const worldY = useTransform(scrollYProgress, [0, 1], [-35, 55])

  return (
    <section ref={sectionRef} aria-label="Start creating with Lekha Captions" className="relative overflow-hidden pb-24 pt-16 sm:pb-32 sm:pt-24">
      <motion.p aria-hidden="true" style={{ y: wordY }} className="pointer-events-none absolute -left-8 top-[8%] text-[9rem] font-black uppercase leading-none tracking-[-0.09em] text-transparent opacity-40 [-webkit-text-stroke:1px_rgba(255,255,255,0.06)] sm:text-[15rem]">Words</motion.p>
      <motion.p aria-hidden="true" style={{ y: worldY }} className="pointer-events-none absolute -right-8 bottom-[4%] text-[8rem] font-black uppercase leading-none tracking-[-0.09em] text-transparent opacity-40 [-webkit-text-stroke:1px_rgba(245,166,35,0.12)] sm:text-[14rem]">World</motion.p>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.25rem] border border-white/[0.12] bg-[#0d0c0a]/90 shadow-[0_45px_120px_-48px_rgba(245,166,35,0.55)] backdrop-blur-2xl">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(245,166,35,0.17),transparent_30%),radial-gradient(circle_at_92%_82%,rgba(110,231,255,0.09),transparent_28%),linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.025)_48%,transparent_49%)]" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_right,black,transparent_78%)]" />

          <div className="relative grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col justify-center border-b border-white/[0.08] p-7 sm:p-12 lg:border-b-0 lg:border-r lg:p-16">
              <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.45 }} className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.28em] text-[#f5a623]">
                <span className="h-px w-10 bg-[#f5a623]" />One upload. Global impact.
              </motion.div>

              <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.65 }} className="mt-7 max-w-2xl text-5xl font-semibold leading-[0.9] tracking-[-0.065em] text-white sm:text-6xl lg:text-[5.25rem]">
                Your video<br />already has<br /><span className="font-serif font-normal italic text-[#f5a623]">a voice.</span>
              </motion.h2>

              <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ delay: 0.12 }}>
                <p className="mt-7 max-w-lg text-lg leading-8 text-white/50">Give it captions people can see, feel, and understand—wherever they are.</p>
                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <Link to={`${createPageUrl('Dashboard')}?entry=editor`} className="landing-button group inline-flex items-center justify-center gap-2 rounded-md px-6 py-3.5 text-sm font-semibold"><Play className="h-4 w-4 fill-current" />Start with a video <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
                  <Link to={`${createPageUrl('Dashboard')}?entry=editor`} className="landing-button inline-flex items-center justify-center gap-2 rounded-md px-6 py-3.5 text-sm font-semibold"><Captions className="h-4 w-4" />Open the editor</Link>
                </div>
              </motion.div>
            </div>

            <div className="relative min-h-[34rem] overflow-hidden p-7 sm:p-12 lg:p-14">
              <div className="mb-10 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/40"><Sparkles className="h-3.5 w-3.5 text-[#f5a623]" />Caption sequence</div>
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#6ee7ff]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6ee7ff]" />Live</div>
              </div>

              <div className="relative pl-10">
                <div aria-hidden="true" className="absolute bottom-0 left-[5px] top-0 w-px bg-white/10" />
                <motion.div aria-hidden="true" initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="absolute bottom-0 left-[5px] top-0 w-px origin-top bg-gradient-to-b from-[#f5a623] via-[#ffd166] to-[#6ee7ff] shadow-[0_0_16px_rgba(245,166,35,0.55)]" />

                <div className="space-y-6">
                  {storyBeats.map((beat, index) => (
                    <motion.div key={beat.label} initial={{ opacity: 0, x: 28 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.65 }} transition={{ delay: index * 0.1, duration: 0.5 }} className="group relative border-b border-white/[0.07] pb-5">
                      <span className="absolute -left-[2.42rem] top-1 h-3 w-3 rounded-full border-2 border-[#0d0c0a] bg-[#f5a623] shadow-[0_0_12px_rgba(245,166,35,0.8)]" />
                      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25">{beat.time}</p>
                      <p className={`mt-1 text-[clamp(2.4rem,6vw,4.8rem)] font-black leading-none tracking-[-0.065em] ${beat.className}`}>{beat.label}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex flex-col gap-4 border-t border-white/[0.08] px-7 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-12">
            <div className="flex items-center gap-2 text-xs text-white/35"><Globe2 className="h-4 w-4 text-[#f5a623]" />One story, ready for the world.</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-white/45">
              {languageSignals.map((language) => <span key={language}>{language}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
