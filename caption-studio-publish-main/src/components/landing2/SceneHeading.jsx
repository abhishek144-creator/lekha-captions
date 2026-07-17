import { motion } from 'framer-motion'

export default function SceneHeading({ scene, timecode, kicker, title, italic, description, align = 'left' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}
    >
      <div className={`flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.26em] text-[#f5a623] ${align === 'center' ? 'justify-center' : ''}`}>
        <span className="inline-flex items-center gap-2 rounded-[3px] border border-[#f5a623]/30 bg-[#f5a623]/[0.08] px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#f5a623]" />
          Scene {scene}
        </span>
        <span className="font-mono tracking-[0.14em] text-white/30">{timecode}</span>
        <span className="hidden h-px flex-1 bg-gradient-to-r from-[#f5a623]/40 to-transparent sm:block" />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-white/40">{kicker}</p>
      <h2 className="mt-3 text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl">
        {title}
        {italic && <><br /><span className="font-serif font-normal italic text-white/45">{italic}</span></>}
      </h2>
      {description && <p className={`mt-5 text-base leading-7 text-white/50 sm:text-lg ${align === 'center' ? 'mx-auto max-w-xl' : 'max-w-xl'}`}>{description}</p>}
    </motion.div>
  )
}
