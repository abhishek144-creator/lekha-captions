import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, CirclePlay, Clapperboard } from 'lucide-react'

const demos = [
  {
    id: 'studio-workflow',
    src: '/landing/lekha-studio-workflow-2026-07.mp4',
    poster: '/landing/lekha-studio-workflow-2026-07.jpg',
    take: 'Take 01',
    label: 'Studio workflow',
    title: 'Shape the story, not just the subtitles.',
    description: 'A real edit inside Lekha, from template choice to precise styling.',
    duration: '16 sec',
  },
  {
    id: 'template-library',
    src: '/landing/lekha-template-library-2026-07.mp4',
    poster: '/landing/lekha-template-library-2026-07.jpg',
    take: 'Take 02',
    label: 'Template library',
    title: 'Find a motion language that feels like you.',
    description: 'A fast tour through expressive caption systems built for short-form video.',
    duration: '20 sec',
  },
]

const proofPoints = [
  ['Real product', 'No mockups'],
  ['115+ languages', 'One workflow'],
  ['100+ styles', 'Ready to move'],
]

function FilmCard({ demo, index }) {
  const [playbackState, setPlaybackState] = useState('loading')

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: index * 0.1, duration: 0.55 }}
      className="landing-film-card overflow-hidden rounded-[1.5rem] border border-white/[0.11] bg-[#11100f]/75 shadow-[0_35px_85px_-45px_rgba(0,0,0,0.95)] backdrop-blur-xl"
    >
      <div className="flex h-11 items-center justify-between border-b border-white/[0.08] px-4">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#f5a623]" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
        </div>
        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">
          <Clapperboard className="h-3.5 w-3.5 text-[#f5a623]" />
          {demo.take} / {demo.duration}
        </div>
        <span className={`h-1.5 w-1.5 rounded-full ${playbackState === 'error' ? 'bg-red-400' : 'bg-[#f5a623]'}`} />
      </div>

      <div className="relative aspect-video overflow-hidden bg-black">
        <video
          className="h-full w-full object-contain"
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="auto"
          poster={demo.poster}
          aria-label={`${demo.label} product film`}
          onLoadStart={() => setPlaybackState('loading')}
          onCanPlay={(event) => {
            setPlaybackState('ready')
            event.currentTarget.play().catch(() => {})
          }}
          onPlaying={() => setPlaybackState('playing')}
          onWaiting={() => setPlaybackState('loading')}
          onError={() => setPlaybackState('error')}
        >
          <source src={demo.src} type="video/mp4" />
          Your browser does not support embedded videos.
        </video>

        <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur-md">
          {playbackState === 'error' ? 'Playback unavailable' : demo.label}
        </div>

        {playbackState === 'loading' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs text-white/70 backdrop-blur-md">
              <CirclePlay className="h-4 w-4 animate-pulse text-[#f5a623]" />
              Loading film
            </div>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold leading-tight tracking-[-0.025em] text-white">{demo.title}</p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">{demo.description}</p>
          </div>
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f5a623]/15 text-[#f5a623]"><Check className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </motion.article>
  )
}

export default function TemplateShowcase() {
  return (
    <section id="templates" aria-label="Caption template demos" className="landing-section-templates relative isolate overflow-hidden pb-24 pt-8 sm:pb-32 sm:pt-12">
      <div aria-hidden="true" className="landing-section-shapes landing-section-shapes-templates">
        <span className="landing-extra-shape landing-extra-diamond" />
        <span className="landing-extra-shape landing-extra-ring" />
        <span className="landing-extra-shape landing-extra-cross" />
      </div>
      <div aria-hidden="true" className="landing-light-geometry landing-section-shapes">
        <span className="landing-extra-shape landing-extra-burst left-[9%] top-[18%]" />
        <span className="landing-extra-shape landing-extra-hexagon bottom-[18%] right-[8%]" />
      </div>
      <div className="pointer-events-none absolute -left-48 top-36 -z-10 h-[32rem] w-[32rem] rounded-full bg-[#f5a623]/[0.08] blur-[140px]" />
      <div className="pointer-events-none absolute -right-52 bottom-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-[#f5a623]/[0.05] blur-[130px]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="text-3xl font-semibold leading-[1] tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
            Templates that <span className="landing-highlight landing-highlight-violet font-serif font-normal italic">perform.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/58">
            A live contact sheet of caption systems—each one rendered in code, timed for attention, and ready to make your words feel directed.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:gap-7">
          {demos.map((demo, index) => <FilmCard key={demo.id} demo={demo} index={index} />)}
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 border-b border-white/[0.08] sm:grid-cols-3">
          {proofPoints.map(([value, label], index) => (
            <div key={value} className={`flex items-center justify-between px-5 py-5 sm:block sm:px-8 sm:py-7 ${index > 0 ? 'border-t border-white/[0.08] sm:border-l sm:border-t-0' : ''}`}>
              <p className="text-sm font-semibold text-white">{value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
