import { motion } from 'framer-motion'

const routes = [
  {
    code: 'Gate R1',
    title: 'Reels & Shorts',
    description: 'Punchy, styled captions that keep viewers watching to the end.',
    color: '#6ee7ff',
  },
  {
    code: 'Seat 2A',
    title: 'Talking-head videos',
    description: 'Clean, readable captions for interviews, vlogs and founder updates.',
    color: '#70d6a5',
  },
  {
    code: 'Gate T3',
    title: 'Tutorials & explainers',
    description: 'Step-by-step clarity, even watched on mute.',
    color: '#ffd166',
  },
  {
    code: 'Seat 4C',
    title: 'Product stories',
    description: 'Launch videos that land in any language, any market.',
    color: '#ff7b9f',
  },
]

function Barcode({ color }) {
  return (
    <motion.div
      aria-hidden="true"
      className="h-6 w-40 opacity-55"
      animate={{ backgroundPositionX: ['0px', '42px'] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
      style={{
        background: `repeating-linear-gradient(90deg, ${color} 0 1px, transparent 1px 4px, ${color} 4px 6px, transparent 6px 10px)`,
      }}
    />
  )
}

export default function UseCaseReel() {
  return (
    <motion.section
      id="use-cases"
      aria-label="Who Lekha Captions is for"
      initial={{ opacity: 0, y: 42 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.76, ease: [0.22, 1, 0.36, 1] }}
      className="landing-section-use-cases relative px-5 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div aria-hidden="true" className="landing-light-geometry landing-section-shapes">
        <span className="landing-extra-shape landing-extra-chevron right-[6%] top-[18%]" />
        <span className="landing-extra-shape landing-extra-hexagon bottom-[14%] left-[5%]" />
        <span className="landing-extra-shape landing-extra-dots bottom-[24%] right-[12%]" />
      </div>
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <p className="landing-use-case-eyebrow inline-flex border border-[#6ee7ff]/40 px-4 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-white">
            Boarding · Use cases
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-5xl">
            Four routes, <span className="landing-highlight landing-highlight-cyan font-serif font-normal italic">one destination</span>
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-white/62">
            Whatever you shoot, it boards the same flight: raw footage in, ready-to-publish out.
          </p>
        </div>

        <div className="mt-14 grid gap-7 lg:grid-cols-2">
          {routes.map((route, index) => (
            <motion.article
              key={route.title}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.28 }}
              transition={{ delay: index * 0.07, duration: 0.58 }}
              className="landing-use-case-card relative grid min-h-[10.6rem] overflow-hidden rounded-[0.75rem] border border-white/[0.13] bg-[#0c0b0a]/76 sm:grid-cols-[10rem_1fr]"
            >
              <div className="relative border-b border-dashed border-white/[0.12] px-5 py-5 sm:border-b-0 sm:border-r">
                <span className="absolute -right-2.5 -top-2.5 hidden h-5 w-5 rounded-full bg-[#070706] sm:block" />
                <span className="absolute -bottom-2.5 -right-2.5 hidden h-5 w-5 rounded-full bg-[#070706] sm:block" />
                <p className="text-[0.52rem] uppercase tracking-[0.25em] text-white/34">From</p>
                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white">Raw footage</p>
                <p className="my-3 text-lg" style={{ color: route.color }}>→</p>
                <p className="text-[0.52rem] uppercase tracking-[0.25em] text-white/34">To</p>
                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white">Ready to publish</p>
                <span className="mt-4 inline-flex rotate-[-2deg] border px-2 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: route.color, color: route.color }}>
                  {route.code}
                </span>
              </div>

              <div className="flex flex-col px-6 py-6">
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">{route.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-white/62">{route.description}</p>
                <div className="mt-auto pt-7"><Barcode color={route.color} /></div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
