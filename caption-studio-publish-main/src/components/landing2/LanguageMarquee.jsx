import React from 'react'

const ROW_ONE = [
  'हिन्दी', 'தமிழ்', 'తెలుగు', 'বাংলা', 'मराठी', 'ગુજરાતી', 'ಕನ್ನಡ', 'മലയാളം',
  'ਪੰਜਾਬੀ', 'ଓଡ଼ିଆ', 'اردو', 'English', 'नेपाली', 'অসমীয়া'
]

const ROW_TWO = [
  'Español', 'Français', 'العربية', 'Português', 'Deutsch', 'Bahasa', '日本語',
  '한국어', 'Kiswahili', 'Türkçe', 'Italiano', 'Русский', 'Tiếng Việt', 'ไทย'
]

function MarqueeRow({ items, reverse = false, dim = false, duration = '32s' }) {
  const doubled = [...items, ...items]
  return (
    <div className="overflow-hidden">
      <div
        className={`lv2-marquee-track ${reverse ? 'lv2-marquee-reverse' : ''}`}
        style={{ '--lv2-marquee-dur': duration }}
      >
        {doubled.map((name, i) => (
          <span key={i} className="flex items-center shrink-0">
            <span className={`text-xl md:text-2xl font-semibold px-6 md:px-8 ${dim ? 'text-white/25' : 'text-white/70'}`}>
              {name}
            </span>
            <span className="w-1 h-1 rounded-full bg-[#F5A623]/70 shrink-0" aria-hidden="true" />
          </span>
        ))}
      </div>
    </div>
  )
}

export default function LanguageMarquee() {
  return (
    <section aria-label="Supported languages" className="relative bg-[#0B0B0C] border-y border-white/5 py-8 space-y-5 overflow-hidden">
      <MarqueeRow items={ROW_ONE} duration="36s" />
      <MarqueeRow items={ROW_TWO} reverse dim duration="46s" />
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0B0B0C] to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0B0B0C] to-transparent" aria-hidden="true" />
    </section>
  )
}
