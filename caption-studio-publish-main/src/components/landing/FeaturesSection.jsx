import { motion } from 'framer-motion'
import { Wand2, Type, Palette, Globe, Languages, Download, Zap } from 'lucide-react'

const features = [
  { icon: Wand2, number: '01', title: 'AI-Powered Generation', description: 'Auto-transcribe and generate punchy captions that match speech rhythm perfectly.', className: 'md:col-span-2 lg:col-span-2', accent: 'from-[#f5a623]/25 via-[#f5a623]/5 to-transparent' },
  { icon: Type, number: '02', title: 'Professional Typography', description: 'Premium fonts, precise sizing, and spacing controls for that polished look.', className: 'lg:row-span-2', accent: 'from-violet-500/20 via-violet-500/5 to-transparent' },
  { icon: Palette, number: '03', title: 'Custom Styling', description: 'Full control over colors, highlights, backgrounds, and positioning.', accent: 'from-rose-500/20 via-rose-500/5 to-transparent' },
  { icon: Globe, number: '04', title: 'Every Regional Language', description: '115+ languages spanning the Americas, Europe, Africa, the Middle East, South Asia, and East Asia. Best-in-class speech AI is picked automatically for each language family.', className: 'md:col-span-2 lg:col-span-1', accent: 'from-cyan-500/15 via-cyan-500/5 to-transparent' },
  { icon: Languages, number: '05', title: 'Multi-Language', description: 'Support for 115+ languages including English, Spanish, Arabic, Portuguese, Hindi & more.', accent: 'from-emerald-500/15 via-emerald-500/5 to-transparent' },
  { icon: Download, number: '06', title: 'Easy Export', description: 'Download as SRT, plain text, or copy directly to your editor.', accent: 'from-blue-500/15 via-blue-500/5 to-transparent' },
  { icon: Zap, number: '07', title: 'Built for Speed', description: 'Optimized for short-form. No bloat, no complexity.', className: 'md:col-span-2 lg:col-span-1', accent: 'from-[#f5a623]/20 via-[#f5a623]/5 to-transparent' },
]

export default function FeaturesSection() {
  return (
    <section id="features" aria-label="Features" className="relative py-24 sm:py-32">
      <div className="pointer-events-none absolute -left-44 top-20 h-[28rem] w-[28rem] rounded-full bg-violet-600/[0.08] blur-[140px]" />
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f5a623]">The creative toolkit</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl">Everything you need.<br /><span className="font-serif font-normal italic text-white/45">Nothing in the way.</span></h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-white/50 lg:justify-self-end sm:text-lg">Professional tools designed for short-form creators everywhere — ready for audiences in any language.</p>
        </motion.div>

        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article key={feature.title} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ delay: index * 0.06 }} className={`group relative min-h-[15rem] overflow-hidden rounded-[1.4rem] border border-white/[0.09] bg-[#11100f]/65 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-[#f5a623]/25 ${feature.className || ''}`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-60 transition-opacity duration-500 group-hover:opacity-100`} />
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/[0.06] transition-transform duration-700 group-hover:scale-125" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-[#f5a623]"><feature.icon className="h-5 w-5" /></span>
                  <span className="text-[10px] font-bold tracking-[0.22em] text-white/25">{feature.number}</span>
                </div>
                <div className="mt-auto pt-10">
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/45">{feature.description}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
