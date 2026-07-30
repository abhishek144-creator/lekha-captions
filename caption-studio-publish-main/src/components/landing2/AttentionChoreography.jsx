import { motion, useReducedMotion } from 'framer-motion'

const beats = [
  { number: '01', label: 'HOOK', copy: 'Lead with the word that stops the scroll.', color: '#ff8fa3' },
  { number: '02', label: 'EMPHASIZE', copy: 'Give the important idea weight, color and rhythm.', color: '#f5a623' },
  { number: '03', label: 'LAND', copy: 'Finish the thought with clarity people remember.', color: '#6ee7ff' },
]

export default function AttentionChoreography() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section aria-label="Caption attention choreography" className="landing-section-attention relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div aria-hidden="true" className="landing-light-geometry landing-section-shapes">
        <span className="landing-extra-shape landing-extra-burst left-[8%] top-[16%]" />
        <span className="landing-extra-shape landing-extra-pill right-[8%] bottom-[14%]" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <p className="inline-flex border border-[#ff8fa3]/40 px-4 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-[#ff8fa3]">
            Attention choreography
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.06em] text-white sm:text-6xl">
            Don&apos;t just subtitle it. <span className="landing-highlight landing-highlight-gold font-serif font-normal italic text-[#ff8fa3]">Direct the eye.</span>
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/58">
            Lekha turns a sentence into a sequence—guiding attention one meaningful beat at a time.
          </p>
        </motion.div>

        <div className="relative min-h-[29rem] overflow-hidden rounded-[1.2rem] border border-white/[0.11] bg-[#0b0d13]/85 p-5 sm:p-8">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(255,143,163,0.12),transparent_28%),radial-gradient(circle_at_16%_86%,rgba(110,231,255,0.1),transparent_25%)]" />
          <div className="relative space-y-4">
            {beats.map((beat, index) => (
              <motion.article
                key={beat.number}
                initial={{ opacity: 0, x: 36 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.45 }}
                transition={{ delay: index * 0.12, duration: 0.55 }}
                className="group relative grid min-h-[7rem] grid-cols-[3.5rem_1fr] items-center overflow-hidden border border-white/[0.1] bg-white/[0.035] p-4 sm:grid-cols-[4.8rem_1fr]"
              >
                <span className="font-mono text-xs text-white/28">{beat.number}</span>
                <div>
                  <motion.h3
                    animate={shouldReduceMotion ? undefined : { letterSpacing: ['0.08em', '0.01em', '0.08em'] }}
                    transition={{ delay: index * 0.3, duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-xl font-black tracking-[0.08em] sm:text-3xl"
                    style={{ color: beat.color }}
                  >
                    {beat.label}
                  </motion.h3>
                  <p className="mt-1 text-sm leading-6 text-white/52">{beat.copy}</p>
                </div>
                <motion.span
                  aria-hidden="true"
                  animate={shouldReduceMotion ? { scaleX: 0.8 } : { scaleX: [0.08, 1, 0.08] }}
                  transition={{ delay: index * 0.35, duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-x-0 bottom-0 h-px origin-left"
                  style={{ background: beat.color }}
                />
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
