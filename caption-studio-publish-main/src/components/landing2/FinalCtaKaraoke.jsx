import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { motion } from 'framer-motion'

const languagePills = ['हिन्दी', 'English', 'தமிழ்', 'العربية', 'Español', 'Kiswahili']

function TicketButton({ children, accent = false, to }) {
  return (
    <Link
      to={to}
      className={`group relative inline-flex min-w-[9rem] items-center justify-center overflow-hidden rounded-[0.45rem] border px-6 py-3 text-sm font-semibold transition ${
        accent
          ? 'border-white bg-white text-black shadow-[0_12px_34px_-18px_rgba(255,255,255,0.9)] hover:bg-white/90'
          : 'border-white/[0.14] bg-transparent text-white hover:border-white/28'
      }`}
    >
      <span className={`absolute -left-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border ${accent ? 'border-white bg-[#070706]' : 'border-white/[0.12] bg-[#070706]'}`} />
      <span className={`absolute -right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border ${accent ? 'border-white bg-[#070706]' : 'border-white/[0.12] bg-[#070706]'}`} />
      <span className={`absolute inset-[4px] rounded-[0.28rem] border border-dashed ${accent ? 'border-black/25' : 'border-white/[0.12]'}`} />
      <span className="relative">{children}</span>
    </Link>
  )
}

export default function FinalCtaKaraoke() {
  return (
    <motion.section
      aria-label="Start creating with Lekha Captions"
      initial={{ opacity: 0, y: 48, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.82, ease: [0.22, 1, 0.36, 1] }}
      className="landing-section-cta relative px-5 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8"
    >
      <div className="mx-auto max-w-6xl rounded-[1.3rem] bg-[repeating-linear-gradient(135deg,#6ee7ff_0_14px,transparent_14px_28px,#f5a623_28px_42px,transparent_42px_56px,#ff8fa3_56px_70px,transparent_70px_84px)] p-[9px]">
        <div className="landing-cta-panel overflow-hidden rounded-[1rem] border border-white/[0.09] bg-[#0b0908] shadow-[0_40px_120px_-70px_rgba(0,0,0,1)]">
          <div className="grid lg:grid-cols-[1fr_1fr]">
            <div className="relative border-b border-white/[0.08] lg:border-b-0 lg:border-r lg:border-white/[0.08]">
              <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:100%_140px]" />
              <div className="relative px-7 py-8 sm:px-12 sm:py-10">
                <div className="absolute right-9 top-7 hidden h-20 w-20 rotate-[12deg] rounded-full border border-[#f5a623]/40 text-center text-[0.52rem] font-semibold uppercase tracking-[0.22em] text-[#f5a623] sm:flex sm:flex-col sm:items-center sm:justify-center">
                  <span>Ready</span>
                  <span>when</span>
                  <span>you are</span>
                </div>

                <motion.h2
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="max-w-md font-serif text-[2.7rem] leading-[1.04] tracking-[-0.05em] text-white sm:text-[3.25rem]"
                >
                  <span className="block italic">Your video already</span>
                  <span className="mt-1 block italic">has a voice.</span>
                </motion.h2>

                <p className="mt-7 max-w-sm text-base leading-7 text-white/68">
                  Give it 115+ more. Captions your audience can actually read — in their language.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <TicketButton accent to={createPageUrl('Dashboard')}>Upload Video</TicketButton>
                  <TicketButton to={createPageUrl('Dashboard')}>Try for Free</TicketButton>
                </div>
              </div>
            </div>

            <div className="relative flex min-h-[20rem] flex-col justify-between bg-[linear-gradient(180deg,rgba(40,28,8,0.16),transparent_36%)] px-8 py-8 sm:px-12 sm:py-10">
              <div className="flex flex-1 items-center justify-center">
                <div className="landing-cta-caption rounded-[0.55rem] border border-white/[0.14] bg-black/30 px-6 py-3 text-center text-xl font-semibold text-white shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] sm:text-2xl">
                  तुम्हारा वीडियो, हर भाषा में
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2.5 lg:flex-nowrap lg:justify-end">
                {languagePills.map((language) => (
                  <span key={language} className="landing-cta-language inline-flex items-center border border-white/[0.14] bg-black/22 px-3 py-1.5 text-xs text-white/82">
                    {language}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
