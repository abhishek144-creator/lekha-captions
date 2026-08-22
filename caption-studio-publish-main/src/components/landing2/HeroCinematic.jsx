import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const rotatingHeroLanguages = [
  'English', 'Spanish', 'Portuguese', 'French', 'German', 'Arabic', 'Hindi', 'Japanese', 'Swahili', 'Vietnamese',
]

const proofTags = ['100+ visual styles', 'Precise editing control', 'HD & 4K plan options']

const stats = [
  { value: '115+', label: 'Languages' },
  { value: '100+', label: 'Caption styles' },
  { value: '120-180s', label: 'Typical turnaround' },
]

const heroLanguageTransition = { duration: 0.62, ease: [0.22, 1, 0.36, 1] }

const craftScenes = [
  { id: 'T166', source: 'LC 2', layout: 'verdict', accent: '#ff8fa3', kicker: 'it always starts', hero: 'MESSY.' },
  { id: 'T168', source: 'LC 2', layout: 'bracket', accent: '#6ee7ff', kicker: 'discipline buys', hero: 'FREEDOM.', tail: 'every day.' },
  { id: 'T171', source: 'LC 2', layout: 'signal', accent: '#ffd166', kicker: 'stop proving', hero: 'IT TO THEM.' },
  { id: 'T173', source: 'LC 2', layout: 'echo', accent: '#b9c7ff', kicker: 'Softly say the', hero: 'HARD THING.' },
  { id: 'T175', source: 'LC 2', layout: 'tag', accent: '#9cf6e8', hero: 'RISK', badge: 'calculated' },
  { id: 'T182', source: 'LC 3', layout: 'pulse', accent: '#ffb4a2', words: ['FOCUS', 'beats', 'raw', 'hustle.'], highlightIndex: 0 },
  { id: 'T183', source: 'LC 3', layout: 'bracket', accent: '#ffd166', kicker: 'small steps', hero: 'COMPOUND.', tail: 'quietly.' },
  { id: 'T186', source: 'LC 3', layout: 'signal', accent: '#6ee7ff', kicker: 'stop chasing', hero: 'EVERYONE.' },
  { id: 'T188', source: 'LC 3', layout: 'echo', accent: '#c7b7ff', kicker: 'Gently say the', hero: 'TRUTH.' },
  { id: 'T191', source: 'LC 3', layout: 'verdict', accent: '#b7f27a', kicker: 'every frame', hero: 'EARNS ITS PLACE.' },
]

function TicketButton({ children, accent = false, to, className = '' }) {
  return (
    <Link
      to={to}
      className={`group relative inline-flex min-w-[7.8rem] items-center justify-center overflow-hidden rounded-[0.4rem] border px-6 py-3 text-sm font-semibold transition ${accent ? 'border-white bg-white text-black shadow-[0_12px_34px_-18px_rgba(255,255,255,0.9)] hover:bg-white/90' : 'border-white/[0.14] bg-transparent text-white hover:border-white/28'} ${className}`}
    >
      <span className={`absolute -left-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border ${accent ? 'border-white bg-[#070706]' : 'border-white/[0.12] bg-[#070706]'}`} />
      <span className={`absolute -right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border ${accent ? 'border-white bg-[#070706]' : 'border-white/[0.12] bg-[#070706]'}`} />
      <span className={`absolute inset-[4px] rounded-[0.28rem] border border-dashed ${accent ? 'border-black/25' : 'border-white/[0.12]'}`} />
      <span className="relative">{children}</span>
    </Link>
  )
}

function RollingHeroLanguage({ languageIndex }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <span className="relative grid min-h-[1.15em] min-w-[5.4ch] max-w-[70vw] overflow-hidden" aria-live="polite">
      <motion.span
        key={rotatingHeroLanguages[languageIndex]}
        initial={shouldReduceMotion ? false : { opacity: 0, y: '105%', filter: 'blur(5px)' }}
        animate={{ opacity: 1, y: '0%', filter: 'blur(0px)' }}
        transition={heroLanguageTransition}
        className="col-start-1 row-start-1 whitespace-nowrap text-center"
      >
        {rotatingHeroLanguages[languageIndex]}
      </motion.span>
    </span>
  )
}

function HeroLanguageBackdrop({ languageIndex }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          key={rotatingHeroLanguages[languageIndex]}
          initial={shouldReduceMotion ? false : { opacity: 0, x: '8%', scale: 0.94 }}
          animate={{ opacity: 0.72, x: '0%', scale: 1 }}
          transition={heroLanguageTransition}
          className="landing-hero-cycling-language whitespace-nowrap"
        >
          {rotatingHeroLanguages[languageIndex]}
        </motion.span>
      </div>
    </div>
  )
}

function CraftScene({ scene, compact = false }) {
  if (scene.layout === 'bracket') {
    return (
      <div className="landing-phone-caption grid w-full min-w-0 grid-cols-[auto_1fr] items-center gap-x-2 text-left">
        <motion.span
          initial={{ opacity: 0, scaleY: 0.08 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 0.68, 0.26, 1] }}
          className={`${compact ? 'text-[2.2rem]' : 'text-[2.8rem]'} row-span-2 origin-top font-black leading-none`}
          style={{ color: scene.accent }}
        >
          {scene.hero}
        </motion.span>
        <motion.span
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.14 }}
          className={`${compact ? 'text-[0.55rem]' : 'text-xs'} font-bold uppercase tracking-[0.12em] text-white/58`}
        >
          {scene.kicker}
        </motion.span>
        <motion.span
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={{ delay: 0.24, duration: 0.55 }}
          className={`${compact ? 'text-[0.7rem]' : 'text-sm'} max-w-full font-black uppercase leading-tight text-white`}
        >
          {scene.tail}
        </motion.span>
      </div>
    )
  }

  if (scene.layout === 'tag') {
    return (
      <div className="landing-phone-caption flex w-full min-w-0 items-start justify-center gap-2 text-center">
        <motion.span
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${compact ? 'text-[2rem]' : 'text-[3.2rem]'} min-w-0 font-black uppercase leading-none`}
          style={{ color: scene.accent }}
        >
          {scene.hero}
        </motion.span>
        <motion.span
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.18, duration: 0.48, ease: [0.22, 0.68, 0.26, 1] }}
          className={`${compact ? 'mt-1 text-[0.45rem]' : 'mt-2 text-[0.55rem]'} shrink-0 rounded-full border px-2 py-1 font-bold uppercase tracking-[0.12em]`}
          style={{ borderColor: scene.accent, color: scene.accent }}
        >
          {scene.badge}
        </motion.span>
      </div>
    )
  }

  return (
    <div className="landing-phone-caption flex w-full min-w-0 flex-col items-center text-center">
      <motion.span initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className={`${compact ? 'text-[0.55rem]' : 'text-xs'} font-bold uppercase tracking-[0.16em] text-white/62`}>
        Decide, then
      </motion.span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.35, 1] }}
        transition={{ delay: 0.14, duration: 0.6 }}
        className={`${compact ? 'mt-1 text-[1.65rem]' : 'mt-2 text-[2.65rem]'} max-w-full border-b-2 font-black uppercase leading-none`}
        style={{ color: scene.accent, borderColor: scene.accent }}
      >
        Commit.
      </motion.span>
    </div>
  )
}

function LegacyCraftPhoneShowcase() {
  const [sceneIndex, setSceneIndex] = useState(0)
  const shouldReduceMotion = useReducedMotion()
  const leftScene = craftScenes[sceneIndex]
  const centerScene = craftScenes[(sceneIndex + 1) % craftScenes.length]
  const rightScene = craftScenes[(sceneIndex + 2) % craftScenes.length]

  useEffect(() => {
    if (shouldReduceMotion) return undefined
    const interval = window.setInterval(() => {
      setSceneIndex((current) => (current + 1) % craftScenes.length)
    }, 3200)
    return () => window.clearInterval(interval)
  }, [shouldReduceMotion])

  return (
    <motion.section
      aria-label="Selected caption templates"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.7 }}
      className="landing-section-craft relative overflow-hidden px-5 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl text-center">
      <p className="font-mono text-[0.56rem] font-semibold uppercase tracking-[0.28em] text-white/32">Selected from the Craft Set · T131—T165</p>
      <div className="relative mt-5 flex min-h-[34rem] items-center justify-center">
        <motion.div
          aria-hidden="true"
          animate={shouldReduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
          className="absolute h-[25rem] w-[25rem] rounded-full border border-dashed border-white/[0.08] sm:h-[31rem] sm:w-[31rem]"
        />
        <motion.div
          aria-hidden="true"
          animate={shouldReduceMotion ? undefined : { y: [0, -10, 0], rotate: [-7, -4, -7] }}
          transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
          className="landing-hero-phone absolute left-[3%] top-[13%] hidden aspect-[9/17] w-[12rem] rounded-[2.1rem] border border-white/[0.18] bg-[#090a0c] p-2 shadow-[0_28px_80px_-40px_rgba(0,0,0,1)] md:block lg:left-[7%] lg:w-[13.5rem]"
        >
          <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[1.65rem] border border-white/[0.05] bg-[radial-gradient(circle_at_30%_20%,rgba(110,231,255,0.08),transparent_44%),#0d0e10] p-5">
            <span className="absolute left-1/2 top-3 h-4 w-12 -translate-x-1/2 rounded-full bg-black" />
            <AnimatePresence mode="wait">
              <motion.div
                key={leftScene.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="relative w-full min-w-0"
              >
                <CraftScene scene={leftScene} compact />
              </motion.div>
            </AnimatePresence>
            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.42rem] uppercase tracking-[0.2em] text-white/24">{leftScene.id}</span>
          </div>
        </motion.div>

        <div className="landing-hero-phone relative z-10 aspect-[9/17] w-[17rem] rounded-[3rem] border border-white/[0.22] bg-[#08090a] p-2.5 shadow-[0_38px_110px_-54px_rgba(0,0,0,1)] sm:w-[19rem]">
          <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[2.45rem] border border-white/[0.055] bg-[radial-gradient(circle_at_50%_45%,rgba(245,166,35,0.07),transparent_35%),#0d0e10] px-6">
            <span className="absolute left-1/2 top-4 z-20 h-5 w-16 -translate-x-1/2 rounded-full bg-black" />
            <AnimatePresence mode="wait">
              <motion.div
                key={centerScene.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 18, rotateX: 20 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                exit={{ opacity: 0, y: -14, rotateX: -14 }}
                transition={{ duration: 0.42, ease: [0.22, 0.68, 0.26, 1] }}
                className="relative flex min-h-[10rem] w-full min-w-0 items-center justify-center"
              >
                <CraftScene scene={centerScene} />
              </motion.div>
            </AnimatePresence>
            <div className="absolute inset-x-6 bottom-8">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.46rem] uppercase tracking-[0.18em] text-white/26">{centerScene.id}</span>
                <span className="h-1.5 w-5 rounded-full" style={{ background: centerScene.accent }} />
              </div>
              <div className="mt-3 h-px bg-white/[0.08]" />
              <p className="mt-3 text-center font-mono text-[0.42rem] uppercase tracking-[0.28em] text-white/24">Live specimen · Auto loop</p>
            </div>
          </div>
        </div>

        <motion.div
          aria-hidden="true"
          animate={shouldReduceMotion ? undefined : { y: [0, 12, 0], rotate: [6, 3, 6] }}
          transition={{ duration: 6.4, repeat: Infinity, ease: 'easeInOut' }}
          className="landing-hero-phone absolute right-[3%] top-[13%] hidden aspect-[9/17] w-[12rem] rounded-[2.1rem] border border-white/[0.18] bg-[#090a0c] p-2 shadow-[0_28px_80px_-40px_rgba(0,0,0,1)] md:block lg:right-[7%] lg:w-[13.5rem]"
        >
          <div className="relative flex h-full items-center justify-center overflow-hidden rounded-[1.65rem] border border-white/[0.05] bg-[radial-gradient(circle_at_70%_20%,rgba(255,143,163,0.08),transparent_44%),#0d0e10] p-5">
            <span className="absolute left-1/2 top-3 h-4 w-12 -translate-x-1/2 rounded-full bg-black" />
            <AnimatePresence mode="wait">
              <motion.div
                key={rightScene.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="relative w-full min-w-0"
              >
                <CraftScene scene={rightScene} compact />
              </motion.div>
            </AnimatePresence>
            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.42rem] uppercase tracking-[0.2em] text-white/24">{rightScene.id}</span>
          </div>
        </motion.div>
      </div>
      <span className="sr-only">Animated caption templates from the Lekha Craft Set.</span>
      </div>
    </motion.section>
  )
}

function CraftTemplatePreview({ scene, shouldReduceMotion }) {
  const loop = shouldReduceMotion ? {} : { repeat: Infinity, repeatDelay: 1.2 }

  if (scene.layout === 'bracket') {
    return (
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 text-left">
        <motion.span
          animate={shouldReduceMotion ? undefined : { scaleY: [0.08, 1, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 2.5, ease: [0.22, 0.68, 0.26, 1], ...loop }}
          className="row-span-2 origin-bottom text-[clamp(3rem,8vw,6.5rem)] font-black leading-[0.75]"
          style={{ color: scene.accent }}
        >
          TIME
        </motion.span>
        <motion.span
          animate={shouldReduceMotion ? undefined : { x: [24, 0, 0], opacity: [0, 1, 1] }}
          transition={{ duration: 2.5, delay: 0.1, ...loop }}
          className="text-xs font-bold uppercase tracking-[0.22em] text-white/48 sm:text-sm"
        >
          is the only
        </motion.span>
        <motion.span
          animate={shouldReduceMotion ? undefined : { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)', 'inset(0 0% 0 0)'] }}
          transition={{ duration: 2.5, delay: 0.18, ...loop }}
          className="text-xl font-black uppercase leading-none text-white sm:text-3xl"
        >
          real currency.
        </motion.span>
      </div>
    )
  }

  if (scene.layout === 'tag') {
    return (
      <div className="flex flex-col items-center text-center">
        <motion.span
          animate={shouldReduceMotion ? undefined : { y: [-24, 0, 0], opacity: [0, 1, 1] }}
          transition={{ duration: 2.4, ...loop }}
          className="text-[clamp(3.6rem,8vw,6.6rem)] font-black uppercase leading-[0.8]"
          style={{ color: scene.accent }}
        >
          Risk
        </motion.span>
        <motion.span
          animate={shouldReduceMotion ? undefined : { scale: [0.35, 1.06, 1], opacity: [0, 1, 1] }}
          transition={{ duration: 2.4, delay: 0.16, ...loop }}
          className="mt-4 rounded-full border px-4 py-1.5 text-[0.58rem] font-bold uppercase tracking-[0.25em]"
          style={{ borderColor: scene.accent, color: scene.accent }}
        >
          calculated
        </motion.span>
      </div>
    )
  }

  if (scene.layout === 'verdict') {
    return (
      <div className="text-center">
        <motion.p
          animate={shouldReduceMotion ? undefined : { y: [-14, 0, 0], opacity: [0, 1, 1] }}
          transition={{ duration: 2.7, ...loop }}
          className="text-sm font-semibold uppercase tracking-[0.28em] text-white/48"
        >
          {scene.kicker}
        </motion.p>
        <motion.p
          animate={shouldReduceMotion ? undefined : { opacity: [0, 1, 0.4, 1], scale: [0.92, 1, 1, 1] }}
          transition={{ duration: 2.7, delay: 0.14, ...loop }}
          className="mt-3 border-b-4 text-[clamp(2.8rem,7vw,5.4rem)] font-black uppercase leading-none"
          style={{ color: scene.accent, borderColor: scene.accent }}
        >
          {scene.hero}
        </motion.p>
      </div>
    )
  }

  if (scene.layout === 'pulse') {
    return (
      <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center text-[clamp(2.2rem,5vw,4.7rem)] font-black uppercase leading-[0.88]">
        {scene.words.map((word, index) => (
          <motion.span
            key={word}
            animate={shouldReduceMotion ? undefined : { y: [22, 0, 0], opacity: [0, 1, 1], scale: [0.9, 1.06, 1] }}
            transition={{ duration: 2.9, delay: index * 0.12, ...loop }}
            style={{ color: index === scene.highlightIndex ? scene.accent : 'currentColor' }}
          >
            {word}
          </motion.span>
        ))}
      </div>
    )
  }

  if (scene.layout === 'echo') {
    return (
      <div className="relative flex min-h-36 items-center justify-center text-center">
        {[2, 1, 0].map((layer) => (
          <motion.p
            key={layer}
            animate={shouldReduceMotion ? undefined : { x: [24 - layer * 12, layer * 9, layer * 9], opacity: [0, layer === 0 ? 1 : 0.18, layer === 0 ? 1 : 0.18] }}
            transition={{ duration: 2.8, delay: layer * 0.08, ...loop }}
            className="absolute text-[clamp(2.4rem,6vw,5.6rem)] font-black uppercase leading-[0.84] tracking-[-0.06em]"
            style={{ color: layer === 0 ? 'currentColor' : scene.accent }}
          >
            {scene.hero}
          </motion.p>
        ))}
      </div>
    )
  }

  return (
    <div className="relative text-left">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/42">{scene.kicker}</p>
      <div className="relative mt-2 inline-block">
        <motion.span
          animate={shouldReduceMotion ? undefined : { scaleX: [0, 1, 1] }}
          transition={{ duration: 2.6, originX: 0, ...loop }}
          className="absolute inset-x-[-0.2em] bottom-[0.08em] h-[0.42em] origin-left"
          style={{ background: scene.accent }}
        />
        <motion.span
          animate={shouldReduceMotion ? undefined : { y: [18, 0, 0], opacity: [0, 1, 1] }}
          transition={{ duration: 2.6, delay: 0.1, ...loop }}
          className="relative text-[clamp(3rem,7vw,5.8rem)] font-black uppercase leading-none text-white"
        >
          {scene.hero}
        </motion.span>
      </div>
    </div>
  )
}

function CraftTemplateCard({ scenes, index, shouldReduceMotion }) {
  const [activeTemplate, setActiveTemplate] = useState(0)
  const scene = scenes[activeTemplate]

  useEffect(() => {
    if (shouldReduceMotion) return undefined
    const interval = window.setInterval(() => {
      setActiveTemplate((current) => (current + 1) % scenes.length)
    }, 3600 + index * 450)
    return () => window.clearInterval(interval)
  }, [index, scenes.length, shouldReduceMotion])

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ delay: index * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={shouldReduceMotion ? undefined : { y: -5 }}
      className="group relative min-h-[24rem] overflow-hidden rounded-[1rem] border border-white/[0.11] bg-[#090b10]/90 p-5 text-left shadow-[0_26px_70px_-50px_rgba(0,0,0,0.95)] sm:min-h-[27rem] sm:p-6 lg:col-span-6"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 75% 18%, ${scene.accent}20, transparent 34%), linear-gradient(135deg, transparent, ${scene.accent}08)` }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: scene.accent, boxShadow: `0 0 18px ${scene.accent}` }} />
          <span className="font-mono text-[0.56rem] font-semibold uppercase tracking-[0.22em] text-white/46">Live preview</span>
        </div>
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-white/24">5 rotating styles</span>
      </div>

      <div className="relative flex min-h-[16rem] items-center justify-center px-2 py-8 sm:min-h-[18rem] sm:px-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={scene.id}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 14, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, filter: 'blur(5px)' }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <CraftTemplatePreview scene={scene} shouldReduceMotion={shouldReduceMotion} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative grid grid-cols-5 gap-2">
        {scenes.map((template, templateIndex) => (
          <button
            key={template.id}
            type="button"
            onClick={() => setActiveTemplate(templateIndex)}
            className={`craft-template-selector h-2.5 min-w-0 rounded-full border transition ${
              templateIndex === activeTemplate ? 'is-active' : ''
            }`}
            style={{ '--template-accent': template.accent }}
            aria-pressed={templateIndex === activeTemplate}
            aria-label={`Show caption style ${templateIndex + 1}`}
          >
            <span className="sr-only">Caption style {templateIndex + 1}</span>
          </button>
        ))}
      </div>
    </motion.article>
  )
}

export function CraftPhoneShowcase() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section aria-label="Selected caption templates" className="landing-section-craft relative overflow-hidden px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.65 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.3em] text-[#ffd166]">Selected from LC 2 + LC 3 · T166—T195</p>
          <h2 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl">
            Templates that <span className="landing-highlight landing-highlight-violet font-serif font-normal italic">perform.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/58">
            A live contact sheet of caption systems—each one rendered in code, timed for attention, and ready to make your words feel directed.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 lg:grid-cols-12">
          <CraftTemplateCard scenes={craftScenes.slice(0, 5)} index={0} shouldReduceMotion={shouldReduceMotion} />
          <CraftTemplateCard scenes={craftScenes.slice(5, 10)} index={1} shouldReduceMotion={shouldReduceMotion} />
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-white/[0.08] pt-5 text-center sm:flex-row sm:text-left">
          <p className="font-mono text-[0.54rem] uppercase tracking-[0.24em] text-white/30">Two live reels · Ten source templates · 100+ styles in the full library</p>
          <Link to={`${createPageUrl('Dashboard')}?action=upload`} className="text-sm font-semibold text-[#ffd166] transition-colors hover:text-white">
            Explore templates →
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function HeroCinematic() {
  const [languageIndex, setLanguageIndex] = useState(0)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (shouldReduceMotion) return undefined
    const interval = window.setInterval(() => {
      setLanguageIndex((current) => (current + 1) % rotatingHeroLanguages.length)
    }, 2800)
    return () => window.clearInterval(interval)
  }, [shouldReduceMotion])

  return (
    <section aria-label="Lekha Captions introduction" className="landing-section-hero relative overflow-hidden px-5 pb-24 pt-7 sm:px-6 sm:pb-32 lg:px-8">
      <HeroLanguageBackdrop languageIndex={languageIndex} />
      <div aria-hidden="true" className="landing-hero-geometry pointer-events-none absolute inset-0 z-[1]">
        <span className="landing-hero-shape landing-hero-shape-diamond" />
        <span className="landing-hero-shape landing-hero-shape-square" />
        <span className="landing-hero-shape landing-hero-shape-triangle" />
        <span className="landing-hero-shape landing-hero-shape-bars" />
      </div>
      <div className="relative mx-auto max-w-7xl py-12 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] overflow-hidden">
          <div className="absolute left-1/2 top-[22%] h-[29rem] w-[29rem] -translate-x-1/2 rounded-full border border-[#f5a623]/10 bg-[radial-gradient(circle,rgba(245,166,35,0.13),transparent_62%)]" />
          <div className="absolute left-1/2 top-[20%] h-[18rem] w-[18rem] -translate-x-1/2 rotate-12 rounded-[1rem] border border-dashed border-white/[0.08]" />
          <div className="absolute inset-x-[14%] top-[42%] h-px bg-gradient-to-r from-transparent via-[#f5a623]/40 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-[64rem] flex-col items-center pt-6 text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-[2rem] font-semibold leading-[0.96] tracking-[-0.06em] text-white min-[420px]:text-[2.35rem] sm:text-[4.45rem] lg:text-[5rem]">
            <span className="block whitespace-nowrap">Professional Captions in</span>
            <span className="landing-highlight landing-highlight-lime mt-5 inline-flex items-center rounded-[0.35rem] border border-current px-4 py-1.5 shadow-[0_0_0_1px_rgba(183,242,122,0.2)] sm:mt-6">
              <RollingHeroLanguage languageIndex={languageIndex} />
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="landing-hero-subtext mt-6 max-w-[35rem] text-base leading-8 text-white/72">
            115+ languages across the Americas, Europe, Africa, the Middle East and Asia. Professional captions at <span className="landing-hero-subtext-highlight font-serif italic text-white/92">creator-friendly</span> pricing.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <TicketButton accent to={`${createPageUrl('Dashboard')}?action=upload`}>Upload Video</TicketButton>
            <TicketButton to={`${createPageUrl('Dashboard')}?action=upload`} className="landing-hero-secondary">Try for Free</TicketButton>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 }} className="landing-hero-proof-tags mt-6 flex flex-wrap justify-center gap-3">
            {proofTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-2 border border-white/[0.1] px-3 py-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-white/62">
                <span className="text-[#f5a623]">*</span>
                {tag}
              </span>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-10 w-full border-t border-white/[0.08] pt-5">
            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="landing-stat-card relative rounded-[0.45rem] border border-white/[0.12] bg-[#080807]/80 px-4 pb-3 pt-4 backdrop-blur-sm">
                  <span className="absolute -top-3 left-8 h-6 w-px bg-white/[0.2]" />
                  <span className="absolute -top-[0.38rem] left-[1.9rem] h-2.5 w-2.5 rounded-full border border-white/[0.2] bg-[#070706]" />
                  <p className="text-[1.8rem] font-semibold tracking-[-0.04em] text-white">{stat.value}</p>
                  <p className="mt-1 text-[0.58rem] uppercase tracking-[0.22em] text-white/42">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
