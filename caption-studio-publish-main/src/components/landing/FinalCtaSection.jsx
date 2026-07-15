import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { ArrowRight, Play } from 'lucide-react'
import { motion } from 'framer-motion'

export default function FinalCtaSection() {
  return (
    <section aria-label="Start creating with Lekha Captions" className="relative pb-24 pt-10 sm:pb-32 sm:pt-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative overflow-hidden rounded-[2rem] border border-[#f5a623]/20 bg-[#130f09] px-6 py-16 text-center shadow-[0_35px_100px_-45px_rgba(245,166,35,0.5)] sm:px-10 sm:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(245,166,35,0.27),transparent_36%),linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.025)_49%,transparent_50%)]" />
          <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f5a623]/10" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#f5a623]">Your next caption starts here</p>
            <h2 className="mx-auto mt-5 max-w-4xl text-4xl font-semibold leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">Bring the video.<br /><span className="font-serif font-normal italic text-[#f5a623]">Lekha brings the words to life.</span></h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/45">Upload your video, choose your language and style, then shape every detail before export.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to={createPageUrl('Dashboard')} className="group inline-flex items-center justify-center gap-2 rounded-md bg-[#f5a623] px-6 py-3.5 text-sm font-semibold text-[#15100a] transition hover:bg-[#ffb53a]"><Play className="h-4 w-4 fill-current" />Upload Video <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
              <Link to={createPageUrl('Dashboard')} className="inline-flex items-center justify-center rounded-md border border-white/15 bg-black/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.05]">Open the editor</Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
