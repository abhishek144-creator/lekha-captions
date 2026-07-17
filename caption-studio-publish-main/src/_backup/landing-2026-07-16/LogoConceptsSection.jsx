import { motion } from 'framer-motion'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

const concepts = [
  { id: 'A', variant: 'signal', name: 'Caption Signal', description: 'A precise caption-bar symbol with a live amber signal. Clear, compact, and product-first.' },
  { id: 'B', variant: 'orbit', name: 'Language Orbit', description: 'A multilingual “ल” surrounded by a global orbit—built around Lekha’s language reach.' },
  { id: 'C', variant: 'cut', name: 'Caption Cut', description: 'Layered editorial frames with an LC monogram. Expressive, cinematic, and creator-led.' },
]

export default function LogoConceptsSection() {
  return (
    <section id="brand-marks" aria-label="Lekha Captions logo concepts" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12 grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#f5a623]">Three original brand directions</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl">Choose how Lekha<br /><span className="font-serif font-normal italic text-white/45">signs its name.</span></h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/45 lg:justify-self-end">All three marks are built in code, stay sharp at every size, and can be used across the landing page and editor.</p>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          {concepts.map((concept, index) => (
            <motion.article key={concept.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className={`relative overflow-hidden rounded-[1.5rem] border p-6 sm:p-8 ${index === 0 ? 'border-[#f5a623]/25 bg-[#f5a623]/[0.055]' : 'border-white/[0.09] bg-[#0d0c0b]/70'}`}>
              {index === 0 && <span className="absolute right-5 top-5 rounded-full border border-[#f5a623]/20 bg-[#f5a623]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#f5a623]">Current default</span>}
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">Variation {concept.id}</p>
              <div className="my-14 flex min-h-20 items-center justify-center"><CaptionStudioLogo size="large" showText={true} forceText={true} variant={concept.variant} /></div>
              <div className="border-t border-white/[0.07] pt-5">
                <h3 className="text-lg font-semibold text-white">{concept.name}</h3>
                <p className="mt-2 text-sm leading-6 text-white/40">{concept.description}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
