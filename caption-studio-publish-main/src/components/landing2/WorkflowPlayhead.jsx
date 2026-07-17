import { motion } from 'framer-motion'

const steps = [
  {
    number: '1',
    title: 'Upload your video',
    description: 'Drop in your file. Any aspect ratio, up to 4K.',
    caption: 'Waypoint 01 · Departure',
  },
  {
    number: '2',
    title: 'Generate, then make it yours',
    description: 'AI drafts the captions; you fine-tune style, timing and placement.',
    caption: 'Waypoint 02 · Layover',
  },
  {
    number: '3',
    title: 'Export and publish',
    description: 'Download in HD or 4K and post everywhere.',
    caption: 'Waypoint 03 · Arrival',
  },
]

export default function WorkflowPlayhead() {
  return (
    <motion.section
      id="workflow"
      aria-label="How Lekha Captions works"
      initial={{ opacity: 0, y: 46 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
      className="landing-section-workflow relative px-5 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex border border-[#8e71ff]/35 px-4 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-[#b993ff]">
            Flight plan · Workflow
          </p>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-white sm:text-6xl">
            Three stops to <span className="font-serif font-normal italic text-[#c5a5ff]">everywhere</span>
          </h2>
        </div>

        <div className="landing-workflow-route relative mt-16 hidden h-44 lg:block">
          <svg viewBox="0 0 1200 240" className="h-full w-full" aria-hidden="true">
            <motion.path
              d="M40 170 C190 70, 420 170, 650 130 S980 10, 1160 78"
              fill="none"
              stroke="rgba(185,147,255,0.45)"
              strokeWidth="3"
              strokeDasharray="4 12"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1.25, ease: 'easeOut' }}
            />
          </svg>

          <span className="absolute left-[4.5%] top-[58%] h-6 w-6 rounded-full border border-[#b993ff]/55 bg-[#0c0a0f] shadow-[0_0_0_5px_rgba(185,147,255,0.08)]">
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c5a5ff]" />
          </span>
          <span className="absolute left-[57.8%] top-[24%] h-6 w-6 rounded-full border border-[#b993ff]/55 bg-[#0c0a0f] shadow-[0_0_0_5px_rgba(185,147,255,0.08)]">
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c5a5ff]" />
          </span>
          <span className="absolute right-[4.8%] top-[11%] h-6 w-6 rounded-full border border-[#b993ff]/55 bg-[#0c0a0f] shadow-[0_0_0_5px_rgba(185,147,255,0.08)]">
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c5a5ff]" />
          </span>
          <span className="absolute left-[60.8%] top-[9%] rotate-[25deg] text-xl text-[#c5a5ff]">✈</span>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-9">
          {steps.map((step, index) => (
            <motion.article
              key={step.number}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: index * 0.08 }}
              className="landing-workflow-card relative rounded-[0.8rem] border border-white/[0.11] bg-black/18 p-6 pt-10 shadow-[0_24px_60px_-48px_rgba(0,0,0,0.95)]"
            >
              <span className="absolute left-6 top-0 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#b993ff]/55 bg-[#0c0a0f] text-lg font-semibold text-white shadow-[0_0_0_5px_rgba(185,147,255,0.07)]">
                {step.number}
              </span>
              <h3 className="text-[1.95rem] font-semibold tracking-[-0.035em] text-white sm:text-[2.05rem] lg:text-[1.95rem]">{step.title}</h3>
              <p className="mt-3 text-lg leading-8 text-white/62">{step.description}</p>
              <p className="mt-7 text-[0.62rem] uppercase tracking-[0.28em] text-white/28">{step.caption}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
