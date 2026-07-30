import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { ArrowRight, AudioLines, Check, Play, Sparkles, Wand2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const stats = [
  ['115+', 'Languages supported'],
  ['100+', 'Caption styles'],
  ['120–180s', 'Shorts & Reels sweet spot'],
]

const rotatingLanguages = [
  'English',
  'Español',
  'Português',
  'Français',
  'Deutsch',
  'العربية',
  '中文',
  '日本語',
  'हिन्दी',
  'Kiswahili',
  'Bahasa',
]

const languageGroups = [
  [
    'हिन्दी · Hindi', 'বাংলা · Bengali', 'ਪੰਜਾਬੀ · Punjabi', 'ગુજરાતી · Gujarati', 'मराठी · Marathi',
    'தமிழ் · Tamil', 'తెలుగు · Telugu', 'ಕನ್ನಡ · Kannada', 'മലയാളം · Malayalam', 'ଓଡ଼ିଆ · Odia', 'অসমীয়া · Assamese',
    'नेपाली · Nepali', 'සිංහල · Sinhala', 'اردو · Urdu', 'کٲشُر · Kashmiri', 'मैथिली · Maithili', 'संस्कृतम् · Sanskrit',
    'कोंकणी · Konkani', 'डोगरी · Dogri', 'سنڌي · Sindhi', 'پښتو · Pashto', 'دری · Dari', 'فارسی · Persian',
    'العربية · Arabic', 'עברית · Hebrew', 'Türkçe · Turkish', 'Kurdî · Kurdish', 'Հայերեն · Armenian', 'ქართული · Georgian',
  ],
  [
    '中文 · Chinese', '日本語 · Japanese', '한국어 · Korean', 'Tiếng Việt · Vietnamese', 'ไทย · Thai', 'ລາວ · Lao',
    'ភាសាខ្មែរ · Khmer', 'မြန်မာ · Burmese', 'Bahasa Indonesia', 'Bahasa Melayu', 'Tagalog · Filipino', 'Cebuano',
    'Javanese', 'Sundanese', 'Монгол · Mongolian', 'Қазақша · Kazakh', 'O‘zbek · Uzbek', 'Кыргызча · Kyrgyz',
    'Тоҷикӣ · Tajik', 'Türkmençe · Turkmen', 'Azərbaycan · Azerbaijani', 'Русский · Russian', 'Українська · Ukrainian', 'Беларуская · Belarusian',
    'Polski · Polish', 'Čeština · Czech', 'Slovenčina · Slovak', 'Magyar · Hungarian', 'Română · Romanian', 'Български · Bulgarian',
  ],
  [
    'English', 'Español · Spanish', 'Português · Portuguese', 'Français · French', 'Deutsch · German', 'Italiano · Italian', 'Nederlands · Dutch',
    'Català · Catalan', 'Galego · Galician', 'Euskara · Basque', 'Gaeilge · Irish', 'Cymraeg · Welsh', 'Gàidhlig · Scottish Gaelic',
    'Íslenska · Icelandic', 'Norsk · Norwegian', 'Svenska · Swedish', 'Dansk · Danish', 'Suomi · Finnish', 'Eesti · Estonian',
    'Latviešu · Latvian', 'Lietuvių · Lithuanian', 'Ελληνικά · Greek', 'Shqip · Albanian', 'Hrvatski · Croatian', 'Српски · Serbian',
    'Bosanski · Bosnian', 'Slovenščina · Slovenian', 'Македонски · Macedonian', 'Malti · Maltese', 'Lëtzebuergesch · Luxembourgish', 'Yiddish · ייִדיש',
  ],
  [
    'Kiswahili · Swahili', 'Afrikaans', 'isiZulu · Zulu', 'isiXhosa · Xhosa', 'Yorùbá · Yoruba', 'Igbo',
    'Hausa', 'አማርኛ · Amharic', 'Soomaali · Somali', 'Oromo', 'Kinyarwanda', 'Kirundi',
    'Lingála · Lingala', 'Luganda', 'Sesotho', 'Setswana', 'Shona', 'Chichewa',
    'Malagasy', 'Wolof', 'Bambara', 'Akan', 'Eʋegbe · Ewe', 'Tigrinya',
    'Tamazight', 'Kreyòl Ayisyen · Haitian Creole', 'Papiamento', 'Māori', 'Gagana Sāmoa · Samoan', 'Lea Faka-Tonga · Tongan',
  ],
]

const languageBands = [
  [...languageGroups[2], ...languageGroups[0]],
  [...languageGroups[3], ...languageGroups[1]],
]

const floatingWords = [
  {
    text: 'SPEAK.',
    className: 'left-[4%] top-[3%] font-serif italic text-white',
    motion: { x: [0, 9, 0], y: [0, -8, 0], rotate: [-3, -1, -3] },
    duration: 7.8,
  },
  {
    text: 'STYLE.',
    className: 'right-[2%] top-[29%] text-[#6ee7ff]',
    motion: { x: [0, -8, 0], y: [0, 7, 0], rotate: [2, 0, 2] },
    duration: 8.6,
  },
  {
    text: 'CONNECT.',
    className: 'left-[7%] top-[55%] text-[#ff8fa3]',
    motion: { x: [0, 7, 0], y: [0, -6, 0], rotate: [-1, 1, -1] },
    duration: 9.2,
  },
  {
    text: 'EVERYWHERE.',
    className: 'bottom-[3%] right-0 font-serif italic text-[#ffd166]',
    motion: { x: [0, -10, 0], y: [0, 8, 0], rotate: [1, -1, 1] },
    duration: 8.1,
  },
]

function RollingLanguage() {
  const [index, setIndex] = useState(0)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (shouldReduceMotion) return undefined

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % rotatingLanguages.length)
    }, 4200)

    return () => window.clearInterval(interval)
  }, [shouldReduceMotion])

  return (
    <span className="relative mt-1 inline-grid min-h-[1.05em] min-w-[7.3ch] max-w-full overflow-hidden align-bottom font-serif font-normal italic text-[#f5a623] sm:min-w-[8.4ch]" aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={rotatingLanguages[index]}
          initial={{ opacity: 0, y: '105%', rotateX: -65, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: '0%', rotateX: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: '-105%', rotateX: 65, filter: 'blur(8px)' }}
          transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
          className="col-start-1 row-start-1 whitespace-nowrap pr-3"
        >
          {rotatingLanguages[index]}
        </motion.span>
      </AnimatePresence>
      <span className="pointer-events-none absolute bottom-0 left-1 right-2 h-px bg-gradient-to-r from-[#f5a623] via-[#ffd166] to-transparent shadow-[0_0_18px_#f5a623]" />
    </span>
  )
}

function FloatingCopyField() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="relative mx-auto min-h-[32rem] w-full max-w-[36rem] lg:mr-0" aria-label="Creative floating words">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5a623]/10 blur-[100px]" />
      {floatingWords.map((word) => (
        <motion.span
          key={word.text}
          animate={shouldReduceMotion ? undefined : word.motion}
          transition={{ duration: word.duration, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute whitespace-nowrap text-[clamp(2.5rem,6.2vw,4.8rem)] font-black leading-none tracking-[-0.07em] ${word.className}`}
        >
          {word.text}
        </motion.span>
      ))}
    </div>
  )
}

function HeroBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute left-[52%] top-[44%] h-[52rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f5a623]/10" />
      <div className="absolute left-[52%] top-[44%] h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.07] motion-safe:animate-[spin_55s_linear_infinite]" />
      <div className="absolute left-[52%] top-[44%] h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]" />
      <div className="absolute left-0 top-[24%] h-px w-[42%] -rotate-[12deg] bg-gradient-to-r from-transparent via-[#f5a623]/40 to-transparent" />
      <div className="absolute right-0 top-[64%] h-px w-[44%] -rotate-[12deg] bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" />
      <p className="absolute -left-5 bottom-[4%] whitespace-nowrap text-[5.5rem] font-black uppercase leading-none tracking-[-0.08em] text-transparent opacity-50 [-webkit-text-stroke:1px_rgba(255,255,255,0.055)] sm:text-[10rem] lg:text-[14rem]">Words in motion</p>
    </div>
  )
}

export default function HeroSection() {
  return (
    <section aria-label="Lekha Captions introduction" className="relative isolate overflow-hidden pb-14 pt-20 sm:pb-20 sm:pt-28">
      <HeroBackground />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:px-8">
        <div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f5a623]/25 bg-[#f5a623]/[0.07] px-3.5 py-2 text-xs font-medium text-white shadow-2xl shadow-black/20 backdrop-blur-xl sm:text-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#f5a623]" />
              115+ Languages. Built for every global audience.
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.08 }} className="mt-7 max-w-4xl text-5xl font-semibold leading-[0.92] tracking-[-0.067em] text-white drop-shadow-[0_8px_34px_rgba(0,0,0,0.65)] sm:text-6xl lg:text-[5.35rem]">
            Professional Captions in <span className="sr-only">Your Language</span><RollingLanguage />
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mt-7 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg">
            115+ languages across the Americas, Europe, Africa, the Middle East and Asia. Professional captions at creator-friendly pricing.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to={createPageUrl('Dashboard')} className="landing-button group inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold shadow-[0_12px_40px_-12px_rgba(255,255,255,0.45)]">
              <Play className="h-4 w-4 fill-current" /> Upload Video <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to={createPageUrl('Dashboard')} className="landing-button inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold">Try for Free</Link>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.42 }} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#f5a623]" />100+ visual styles</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#f5a623]" />Precise editing control</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#f5a623]" />HD &amp; 4K plan options</span>
          </motion.div>
        </div>

        <FloatingCopyField />
      </div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.5 }} className="relative mx-auto mt-16 grid max-w-6xl divide-y divide-white/[0.07] overflow-hidden rounded-2xl border border-white/[0.1] bg-black/35 shadow-2xl shadow-black/30 backdrop-blur-xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {stats.map(([value, label], index) => (
          <div key={label} className="group relative overflow-hidden px-6 py-5 text-center">
            <div className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-transparent via-[#f5a623] to-transparent transition-transform duration-500 group-hover:scale-x-100" />
            <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-1 text-xs text-white/40">{label}</p>
            {index === 0 && <AudioLines className="absolute -right-2 -top-3 h-16 w-16 text-[#f5a623]/[0.06]" />}
            {index === 1 && <Wand2 className="absolute -right-2 -top-3 h-16 w-16 text-[#f5a623]/[0.06]" />}
          </div>
        ))}
      </motion.div>

      <div className="relative mt-14 flex flex-col gap-6 overflow-hidden py-7 [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)] sm:gap-8" aria-label="Global language coverage">
        {languageBands.map((band, bandIndex) => (
          <div key={`language-band-${bandIndex}`} className={`language-ribbon relative left-1/2 w-[112vw] -translate-x-1/2 border-y py-6 sm:py-8 ${bandIndex % 2 === 0 ? 'border-[#f5a623]/20 bg-[#f5a623]/[0.065]' : 'border-[#6ee7ff]/20 bg-[#6ee7ff]/[0.05]'}`}>
            <div className={`${bandIndex % 2 === 0 ? 'lekha-marquee' : 'lekha-marquee-reverse'} flex w-max items-center whitespace-nowrap`}>
              {[...band, ...band].map((language, index) => (
                <span key={`${bandIndex}-${language}-${index}`} className="mx-8 inline-flex items-center gap-8 text-lg font-medium text-white/65 sm:mx-11 sm:gap-11 sm:text-2xl">
                  <span>{language}</span><span className={bandIndex % 2 === 0 ? 'text-[#f5a623]' : 'text-[#6ee7ff]'}>✦</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
