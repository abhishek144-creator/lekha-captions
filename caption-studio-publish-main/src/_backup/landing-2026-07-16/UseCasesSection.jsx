import { motion } from 'framer-motion'
import { Clapperboard, GraduationCap, Megaphone, Mic2 } from 'lucide-react'

const useCases = [
  { icon: Clapperboard, label: 'Reels & Shorts', title: 'Keep fast stories easy to follow.', description: 'Turn quick speech into paced, readable captions designed for vertical content.', accent: 'text-[#f5a623]' },
  { icon: Mic2, label: 'Talking-head videos', title: 'Make every idea land clearly.', description: 'Give interviews, commentary, and direct-to-camera videos a strong visual rhythm.', accent: 'text-[#c9a7ff]' },
  { icon: GraduationCap, label: 'Tutorials & explainers', title: 'Help viewers follow every step.', description: 'Use precise text, hierarchy, and timing to make useful information easier to absorb.', accent: 'text-[#6ee7ff]' },
  { icon: Megaphone, label: 'Product stories', title: 'Keep the message on-brand.', description: 'Shape fonts, colors, highlights, and position into a consistent caption system.', accent: 'text-[#ff8fa3]' },
]

export default function UseCasesSection() {
  return (
    <section id="use-cases" aria-label="Who Lekha Captions is for" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f5a623]">Made for the way you publish</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl">One caption engine.<br /><span className="font-serif font-normal italic text-white/45">Many kinds of stories.</span></h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/45 sm:text-base">From the first hook to the final point, captions should support the story—not compete with it.</p>
        </motion.div>

        <div className="grid gap-px overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-white/[0.09] sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((item, index) => (
            <motion.article key={item.label} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="group min-h-[19rem] bg-[#0b0a09]/90 p-6 transition hover:bg-[#12100e]">
              <div className="flex items-center justify-between"><item.icon className={`h-5 w-5 ${item.accent}`} /><span className="text-[10px] font-bold tracking-[0.18em] text-white/20">0{index + 1}</span></div>
              <div className="mt-20">
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${item.accent}`}>{item.label}</p>
                <h3 className="mt-3 text-xl font-semibold leading-tight text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/40">{item.description}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
