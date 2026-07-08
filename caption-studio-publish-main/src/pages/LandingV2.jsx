import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'
import HeroCinema from '@/components/landing2/HeroCinema'
import LanguageMarquee from '@/components/landing2/LanguageMarquee'
import WorkflowStrip from '@/components/landing2/WorkflowStrip'
import FeatureBento from '@/components/landing2/FeatureBento'
import StyleStage from '@/components/landing2/StyleStage'
import PricingEditorial from '@/components/landing2/PricingEditorial'
import FinaleCta from '@/components/landing2/FinaleCta'

const FONT_LINK_ID = 'lv2-display-fonts'
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Rozha+One&display=swap'

const LV2_STYLES = `
  .lv2-display { font-family: 'Fraunces', 'Rozha One', Georgia, serif }
  .lv2-gold-text {
    background-image: linear-gradient(135deg, #BF953F 0%, #FCF6BA 45%, #B38728 70%, #AA771C 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .lv2-gold-bg {
    background-image: linear-gradient(135deg, #BF953F 0%, #FCF6BA 45%, #B38728 70%, #AA771C 100%);
  }
  .lv2-marquee-track {
    display: flex;
    align-items: center;
    width: max-content;
    animation: lv2-marquee var(--lv2-marquee-dur, 32s) linear infinite;
  }
  .lv2-marquee-reverse { animation-direction: reverse }
  @keyframes lv2-marquee {
    from { transform: translateX(0) }
    to { transform: translateX(-50%) }
  }
  .lv2-wavebar {
    animation: lv2-wave 1.15s ease-in-out infinite;
    transform-origin: bottom;
  }
  @keyframes lv2-wave {
    0%, 100% { transform: scaleY(0.3) }
    50% { transform: scaleY(1) }
  }
  .lv2-playhead { animation: lv2-playhead 12s linear infinite }
  @keyframes lv2-playhead {
    from { width: 3% }
    to { width: 100% }
  }
  .lv2-drift { animation: lv2-drift 9s ease-in-out infinite }
  .lv2-drift-slow { animation: lv2-drift 13s ease-in-out infinite reverse }
  @keyframes lv2-drift {
    0%, 100% { transform: translate(0, 0) scale(1) }
    50% { transform: translate(14px, -18px) scale(1.08) }
  }
  @media (prefers-reduced-motion: reduce) {
    .lv2-marquee-track, .lv2-wavebar, .lv2-playhead, .lv2-drift, .lv2-drift-slow { animation: none }
  }
`

export default function LandingV2() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return
    const link = document.createElement('link')
    link.id = FONT_LINK_ID
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    document.head.appendChild(link)
  }, [])

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white [scroll-behavior:smooth]">
      <style>{LV2_STYLES}</style>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0D0D0D]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to={createPageUrl('Home')} className="hover:opacity-80 transition-opacity">
            <CaptionStudioLogo size="default" showText={true} />
          </Link>
          <div className="hidden md:flex items-center gap-8 font-mono text-[11px] tracking-[0.25em] text-[#949494]">
            <a href="#styles" className="hover:text-white transition-colors">STYLES</a>
            <a href="#pricing" className="hover:text-white transition-colors">PRICING</a>
            <Link to={createPageUrl('Faq')} className="hover:text-white transition-colors">FAQ</Link>
            <Link to={createPageUrl('Help')} className="hover:text-white transition-colors">HELP</Link>
          </div>
          <Link
            to={createPageUrl('Dashboard')}
            className="rounded-full lv2-gold-bg text-black text-sm font-semibold px-5 py-2.5 hover:brightness-110 transition-all"
          >
            Open the editor
          </Link>
        </div>
      </nav>

      <HeroCinema />
      <LanguageMarquee />
      <WorkflowStrip />
      <FeatureBento />
      <StyleStage />
      <PricingEditorial />
      <FinaleCta />
    </div>
  )
}
