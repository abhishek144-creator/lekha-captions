import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { ArrowRight, Download, SlidersHorizontal, Upload } from 'lucide-react'
import { motion } from 'framer-motion'

const steps = [
  { number: '01', icon: Upload, title: 'Upload your video', description: 'Bring in a Short, Reel, or any creator video up to your plan’s length.' },
  { number: '02', icon: SlidersHorizontal, title: 'Generate, then make it yours', description: 'Choose a language and style, then refine the words, timing, type, colors, and position.' },
  { number: '03', icon: Download, title: 'Export and publish', description: 'Download captions or a finished video in the quality included with your plan.' },
]

export default function WorkflowSection() {
  return (
    <section id="workflow" aria-label="How Lekha Captions works" className="relative py-12 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.1] bg-[#0d0c0b]/70 p-6 shadow-[0_40px_100px_-55px_rgba(245,166,35,0.5)] backdrop-blur-2xl sm:p-10 lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(245,166,35,0.13),transparent_32%),linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.025)_48%,transparent_49%)]" />
          <div className="relative grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:gap-16">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f5a623]">From raw clip to ready</p>
              <h2 className="mt-4 text-4xl font-semibold leading-none tracking-[-0.05em] text-white">Three steps.<br /><span className="font-serif font-normal italic text-[#f5a623]">One flow.</span></h2>
              <p className="mt-5 max-w-sm text-sm leading-6 text-white/45">AI handles the first draft. You keep creative control over every word and frame.</p>
              <Link to={`${createPageUrl('Dashboard')}?action=upload`} className="landing-button group mt-7 inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold">Start with a video <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
            </motion.div>

            <div className="grid gap-3">
              {steps.map((step, index) => (
                <motion.article key={step.number} initial={{ opacity: 0, x: 22 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className="group grid grid-cols-[auto_1fr] items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-[#f5a623]/20 hover:bg-[#f5a623]/[0.035] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-[#f5a623]"><step.icon className="h-5 w-5" /></span>
                  <div><p className="font-semibold text-white">{step.title}</p><p className="mt-1 text-sm leading-6 text-white/40">{step.description}</p></div>
                  <span className="hidden text-3xl font-black tracking-[-0.08em] text-white/[0.08] sm:block">{step.number}</span>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
