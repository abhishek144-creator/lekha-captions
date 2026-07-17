import { motion } from 'framer-motion'
import { Download, Globe2, Languages, Palette, Type, WandSparkles, Zap } from 'lucide-react'

const catalog = [
  { number: '01', icon: WandSparkles, title: 'AI-powered generation', copy: 'Turn speech into timed, readable captions in a few focused steps.', color: '#f5a623' },
  { number: '02', icon: Type, title: 'Professional typography', copy: 'Shape hierarchy with premium fonts, sizing and spacing controls.', color: '#b993ff' },
  { number: '03', icon: Palette, title: 'Custom styling', copy: 'Control colors, highlights, backgrounds and placement.', color: '#ff7b9f' },
  { number: '04', icon: Globe2, title: 'Regional language reach', copy: 'Create for Indic, African, Arab, Asian and European audiences.', color: '#6ee7ff' },
  { number: '05', icon: Languages, title: '115+ languages', copy: 'Keep every writing system inside one creator workflow.', color: '#70d6a5' },
  { number: '06', icon: Download, title: 'Flexible export', copy: 'Publish in the formats your next editing step needs.', color: '#86a8ff' },
  { number: '07', icon: Zap, title: 'Built for speed', copy: 'A focused toolset for fast-moving short-form production.', color: '#ffd166' },
]

export default function FeatureIndex() {
  return (
    <section id="card-catalog" aria-label="Feature card catalog" className="landing-section-features relative px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="inline-flex border border-[#f5a623]/45 px-4 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-[#f5a623]">
            Card catalog · Features
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-5xl">
            Everything filed, <span className="font-serif font-normal italic text-[#f5a623]">nothing lost</span>
          </h2>
          <p className="mt-4 text-base text-white/55">Seven index cards from the Lekha drawer. Pull any one out.</p>
        </motion.div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalog.map((item, index) => (
            <motion.article
              key={item.number}
              initial={{ opacity: 0, y: 24, rotate: index % 2 === 0 ? -0.7 : 0.7 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: index * 0.055, duration: 0.56 }}
              className={`landing-feature-card group relative min-h-[13rem] overflow-hidden border border-white/[0.12] bg-[#0d0c0b]/78 p-6 shadow-[0_18px_50px_-36px_rgba(0,0,0,0.95)] ${index === 0 ? 'md:col-span-2' : ''}`}
            >
              <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#070706]" />
              <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#070706]" />
              <div aria-hidden="true" className="absolute inset-x-6 top-14 border-t border-dashed border-white/[0.09]" />
              <div className="relative flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center border border-white/[0.12] bg-black/25" style={{ color: item.color }}>
                  <item.icon className="h-[1.125rem] w-[1.125rem]" />
                </span>
                <span className="font-mono text-[0.58rem] font-semibold tracking-[0.24em] text-white/27">LKH-{item.number}</span>
              </div>
              <div className="relative mt-12">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/48">{item.copy}</p>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" style={{ background: item.color }} />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
