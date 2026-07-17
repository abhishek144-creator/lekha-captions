import { motion } from 'framer-motion'
import { Globe2, Languages, Sparkles } from 'lucide-react'

const regions = ['South Asia', 'Africa', 'Southeast Asia', 'Middle East', 'Europe', 'English-speaking markets']
const languageExamples = ['हिन्दी', 'தமிழ்', 'తెలుగు', 'বাংলা', 'मराठी', 'العربية', 'English', 'Français']

export default function LanguageReachSection() {
  return (
    <section id="languages" aria-label="Language coverage" className="relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f5a623]/[0.07]" />
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.1] bg-[#0d0c0b]/70 p-6 backdrop-blur-2xl sm:p-10 lg:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(110,231,255,0.09),transparent_28%),radial-gradient(circle_at_88%_82%,rgba(245,166,35,0.12),transparent_30%)]" />
          <div className="relative grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#f5a623]"><Globe2 className="h-4 w-4" />Language reach</div>
              <p className="mt-5 text-[6rem] font-semibold leading-[0.8] tracking-[-0.09em] text-white sm:text-[8rem]">115<span className="text-[#f5a623]">+</span></p>
              <p className="mt-5 max-w-sm text-lg leading-7 text-white/55">Regional and global languages inside one creator workflow.</p>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/35">Powered by Sarvam AI for Indian languages and Whisper for global languages.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <div className="grid gap-3 sm:grid-cols-2">
                {regions.map((region, index) => <div key={region} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-white/65"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f5a623]/10 text-[9px] font-bold text-[#f5a623]">{String(index + 1).padStart(2, '0')}</span>{region}</div>)}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {languageExamples.map((language, index) => <span key={language} className={`rounded-full border px-3 py-1.5 text-xs ${index % 3 === 0 ? 'border-[#f5a623]/20 bg-[#f5a623]/[0.06] text-[#f5a623]' : 'border-white/[0.08] bg-black/20 text-white/40'}`}>{language}</span>)}
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-white/35"><Languages className="h-4 w-4 text-[#6ee7ff]" />One editor, many writing systems <Sparkles className="ml-auto h-4 w-4 text-[#f5a623]" /></div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
