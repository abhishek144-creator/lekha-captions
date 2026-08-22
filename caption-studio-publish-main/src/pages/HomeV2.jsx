import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
// Landing-only CSS, imported from the lazy route so it stays out of the entry bundle.
import '@/styles/landing.css'
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import HeroCinematic from '@/components/landing2/HeroCinematic'
import FeatureIndex from '@/components/landing2/FeatureIndex'
import AttentionChoreography from '@/components/landing2/AttentionChoreography'
import UseCaseReel from '@/components/landing2/UseCaseReel'
import WorkflowPlayhead from '@/components/landing2/WorkflowPlayhead'
import FormatCanvasSection from '@/components/landing2/FormatCanvasSection'
import TemplateShowcase from '@/components/landing/TemplateShowcase'
import PricingSection from '@/components/landing/PricingSection'
import FinalCtaKaraoke from '@/components/landing2/FinalCtaKaraoke'
import Footer from '@/components/landing/Footer'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

const TOTAL_RUNTIME_SECONDS = 204

function formatTimecode(fraction) {
  const seconds = Math.round(fraction * TOTAL_RUNTIME_SECONDS)
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  const remainder = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${remainder}`
}

function ScrubberRail() {
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 24, mass: 0.3 })
  const [timecode, setTimecode] = useState('00:00')

  useEffect(() => scrollYProgress.on('change', (value) => setTimecode(formatTimecode(value))), [scrollYProgress])

  if (shouldReduceMotion) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-16 z-40">
      <div className="h-[3px] w-full bg-white/[0.06]">
        <motion.div style={{ scaleX: progress }} className="h-full origin-left bg-gradient-to-r from-[#f5a623] via-[#ffd166] to-[#6ee7ff] shadow-[0_0_14px_rgba(245,166,35,0.45)]" />
      </div>
      <div className="mx-auto flex max-w-7xl justify-end px-5 sm:px-8">
        <span className="mt-1.5 rounded-b-md border border-t-0 border-white/[0.08] bg-black/70 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] text-[#f5a623] backdrop-blur-xl">
          TC {timecode} / {formatTimecode(1)}
        </span>
      </div>
    </div>
  )
}

export default function HomeV2() {
  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-[#070706] text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_-12%,rgba(245,166,35,0.21),transparent_34%),radial-gradient(circle_at_105%_28%,rgba(13,126,132,0.1),transparent_28%),radial-gradient(circle_at_-5%_30%,rgba(34,113,118,0.09),transparent_28%),radial-gradient(circle_at_-8%_58%,rgba(26,126,136,0.09),transparent_25%),linear-gradient(180deg,#070706_0%,#0c0a08_38%,#070707_100%)]" />
        <div className="absolute inset-y-0 left-[7%] w-px bg-gradient-to-b from-transparent via-white/[0.05] to-transparent" />
        <div className="absolute inset-y-0 right-[7%] w-px bg-gradient-to-b from-transparent via-white/[0.05] to-transparent" />
      </div>

      <nav className="sticky top-0 z-50 h-16 border-b border-white/[0.07] bg-[#080807]/70 px-3 shadow-[0_10px_50px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:px-4 lg:px-5">
        <div className="mx-auto flex h-full max-w-[90rem] items-center justify-between">
          <Link to={createPageUrl('Home')} className="transition-opacity hover:opacity-80" aria-label="Lekha Captions home">
            <CaptionStudioLogo size="default" showText={true} beta={true} />
          </Link>
          <div className="hidden items-center gap-7 sm:flex">
            <Link to={createPageUrl('Faq')} className="text-sm text-[#949494] transition-colors hover:text-white">FAQ</Link>
            <Link to={createPageUrl('HelpAndSupport')} className="text-sm text-[#949494] transition-colors hover:text-white">Help &amp; Support</Link>
            <Link to={createPageUrl('TermsAndConditions')} className="text-sm text-[#949494] transition-colors hover:text-white">Terms</Link>
            <Link to={`${createPageUrl('Dashboard')}?action=upload`} className="landing-button rounded-[4px] px-3.5 py-2 text-sm font-semibold">Open editor</Link>
          </div>
          <Link to={`${createPageUrl('Dashboard')}?action=upload`} className="landing-button rounded-[4px] px-3 py-2 text-xs font-semibold sm:hidden">Try free</Link>
        </div>
      </nav>

      <ScrubberRail />

      <main className="landing-story relative z-10">
        <HeroCinematic />
        <FeatureIndex />
        <AttentionChoreography />
        <UseCaseReel />
        <WorkflowPlayhead />
        <FormatCanvasSection />
        <TemplateShowcase />
        <PricingSection />
        <FinalCtaKaraoke />
      </main>
      <div className="relative z-10"><Footer /></div>
    </div>
  )
}
