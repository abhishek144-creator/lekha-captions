import { motion, useReducedMotion } from 'framer-motion'

const canvases = [
  { ratio: '9:16', title: 'Reels & Shorts', className: 'aspect-[9/14] w-[8.5rem]', text: 'STAY / FOR THIS', accent: '#f5a623' },
  { ratio: '1:1', title: 'Social posts', className: 'aspect-square w-[10.5rem]', text: 'MAKE IT / CLEAR', accent: '#ff8fa3' },
  { ratio: '16:9', title: 'Video & web', className: 'aspect-video w-[15rem]', text: 'EVERY WORD / COUNTS', accent: '#6ee7ff' },
]

export default function FormatCanvasSection() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section aria-label="Caption formats" className="landing-section-formats relative px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[1.4rem] border border-white/[0.1] bg-[#090b10]/84">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
          <div className="border-b border-white/[0.09] px-7 py-10 sm:px-10 sm:py-14 lg:border-b-0 lg:border-r">
            <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-[#6ee7ff]">One edit · every canvas</p>
            <h2 className="mt-5 text-4xl font-semibold leading-[1] tracking-[-0.055em] text-white sm:text-5xl">
              Your caption style, <span className="landing-highlight landing-highlight-gold font-serif font-normal italic text-[#6ee7ff]">wherever it plays.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/58">
              Build a visual language once, then keep it consistent across vertical, square and widescreen content.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {['Vertical', 'Square', 'Widescreen', 'HD', '4K plan options'].map((item) => (
                <span key={item} className="border border-white/[0.1] px-3 py-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/48">{item}</span>
              ))}
            </div>
          </div>

          <div className="relative flex min-h-[30rem] items-end justify-center overflow-hidden px-4 pb-10 pt-14 sm:px-8">
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div className="relative flex w-full flex-wrap items-end justify-center gap-4">
              {canvases.map((canvas, index) => (
                <motion.div
                  key={canvas.ratio}
                  initial={{ opacity: 0, y: 30, rotate: index === 0 ? -3 : index === 2 ? 3 : 0 }}
                  whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  className="text-center"
                >
                  <div className={`landing-format-card relative mx-auto flex items-center justify-center overflow-hidden rounded-[0.65rem] border border-white/[0.14] bg-[linear-gradient(145deg,#11172a,#191020_60%,#0b1118)] shadow-[0_24px_60px_-34px_rgba(0,0,0,1)] ${canvas.className}`}>
                    <motion.div
                      aria-hidden="true"
                      animate={shouldReduceMotion ? undefined : { scale: [0.85, 1.12, 0.85], rotate: [0, 8, 0] }}
                      transition={{ delay: index * 0.25, duration: 5.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute h-20 w-20 rounded-full blur-2xl"
                      style={{ background: `${canvas.accent}55` }}
                    />
                    <motion.p
                      animate={shouldReduceMotion ? undefined : { y: [5, -5, 5] }}
                      transition={{ delay: index * 0.18, duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative z-10 whitespace-pre-line px-3 text-center text-sm font-black leading-[0.95] tracking-[-0.04em] text-white"
                    >
                      {canvas.text.replace(' / ', '\n')}
                    </motion.p>
                    <span className="absolute bottom-2 left-2 rounded-sm px-1.5 py-0.5 font-mono text-[0.42rem] font-bold text-black" style={{ background: canvas.accent }}>{canvas.ratio}</span>
                  </div>
                  <p className="mt-3 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/38">{canvas.title}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
