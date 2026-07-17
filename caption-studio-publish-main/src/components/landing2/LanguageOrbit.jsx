import { motion } from 'framer-motion'

const languageTags = ['हिन्दी', 'தமிழ்', 'తెలుగు', 'বাংলা', 'मराठी', 'العربية', 'English', 'Français']

const marketCards = [
  { stamp: 'Admitted · 12 Mar 2026 · LKH-091', title: 'South Asia', copy: 'Hindi, Tamil, Telugu, Bangla, Marathi & more', accent: true },
  { stamp: 'Admitted · 04 Apr 2026 · LKH-118', title: 'Africa', copy: 'Kiswahili, Yorùbá, Amharic & more' },
  { stamp: 'Admitted · 19 Feb 2026 · LKH-064', title: 'Southeast Asia', copy: 'Bahasa, Thai, Vietnamese & more' },
  { stamp: 'Admitted · 27 May 2026 · LKH-203', title: 'Middle East', copy: 'Arabic, Farsi, Urdu & more', accent: true },
  { stamp: 'Admitted · 08 Jan 2026 · LKH-032', title: 'Europe', copy: 'French, German, Spanish, Portuguese & more' },
  { stamp: 'Admitted · 30 Jun 2026 · LKH-245', title: 'English-speaking markets', copy: 'US, UK, Australia, Canada & beyond' },
]

export default function LanguageOrbit() {
  return (
    <section id="languages" aria-label="Language coverage" className="relative px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[0.95rem] border border-white/[0.12] bg-[#0d0c0b]/75 px-6 py-9 shadow-[0_40px_120px_-70px_rgba(0,0,0,1)] backdrop-blur-2xl sm:px-10 sm:py-12 lg:px-12">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(245,166,35,0.08),transparent_28%)]" />
          <div aria-hidden="true" className="absolute left-[32%] top-[34%] hidden -translate-x-1/2 -translate-y-1/2 rotate-[-9deg] text-[18rem] font-black leading-none tracking-[-0.12em] text-[#f5a623]/[0.07] lg:block">LKH</div>

          <div className="relative grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
            <motion.div initial={{ opacity: 0, x: -18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="inline-flex border border-[#f5a623]/35 px-4 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-[#f5a623]">
                Visa page · Language reach
              </p>
              <h2 className="mt-5 max-w-sm text-4xl font-semibold leading-[1.04] tracking-[-0.06em] text-white">
                Built for <span className="font-serif font-normal italic text-[#f5a623]">every language,</span> every creator.
              </h2>
              <p className="mt-5 max-w-sm text-base leading-7 text-white/62">
                Indic, African, Arab, Southeast Asian and European languages — all first-class.
              </p>

              <div className="mt-7 flex max-w-sm flex-wrap gap-2.5">
                {languageTags.map((language, index) => (
                  <span
                    key={language}
                    className={`inline-flex items-center border px-3 py-1.5 text-sm ${
                      index % 3 === 1 ? 'border-[#f5a623]/45 text-[#f5a623]' : 'border-white/[0.15] text-white/82'
                    }`}
                  >
                    {language}
                  </span>
                ))}
              </div>
            </motion.div>

            <div className="relative grid gap-3.5 md:grid-cols-2">
              {marketCards.map((card, index) => (
                <motion.article
                  key={card.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative min-h-[6.2rem] overflow-hidden border bg-black/14 px-4 py-4 shadow-[0_18px_42px_-34px_rgba(0,0,0,0.8)] ${
                    card.accent ? 'border-[#f5a623]/28' : 'border-white/[0.11]'
                  }`}
                >
                  <div aria-hidden="true" className="absolute inset-0 opacity-40 [background:linear-gradient(135deg,rgba(255,255,255,0.06),transparent_38%)]" />
                  <p className={`text-[0.58rem] font-semibold uppercase tracking-[0.28em] ${card.accent ? 'text-[#dca12a]' : 'text-white/33'}`}>{card.stamp}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.035em] text-white">{card.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-white/58">{card.copy}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
