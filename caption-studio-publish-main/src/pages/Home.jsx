import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { createPageUrl } from '@/utils'
// Landing-only CSS, imported from the lazy route so it stays out of the entry bundle.
import '@/styles/landing.css'
import HeroCinematic from '@/components/landing2/HeroCinematic'
import FeatureIndex from '@/components/landing2/FeatureIndex'
import UseCaseReel from '@/components/landing2/UseCaseReel'
import WorkflowPlayhead from '@/components/landing2/WorkflowPlayhead'
import TemplateShowcase from '@/components/landing/TemplateShowcase'
import PricingSection from '@/components/landing/PricingSection'
import FinalCtaKaraoke from '@/components/landing2/FinalCtaKaraoke'
import Footer from '@/components/landing/Footer'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

const LANDING_THEME_KEY = 'lekha-landing-theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const savedTheme = window.localStorage.getItem(LANDING_THEME_KEY)
  return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark'
}

function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={onToggle}
      className="landing-theme-toggle inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      aria-pressed={isLight}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
    >
      {isLight ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
    </button>
  )
}

export default function Home() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    window.localStorage.setItem(LANDING_THEME_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')

  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden" data-theme={theme}>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="landing-atmosphere absolute inset-0" />
        <div className="landing-guide absolute inset-y-0 left-[7%] w-px" />
        <div className="landing-guide absolute inset-y-0 right-[7%] w-px" />
      </div>
      <nav className="landing-nav sticky top-0 z-50 h-16 border-b px-3 backdrop-blur-2xl sm:px-4 lg:px-5">
        <div className="mx-auto flex h-full max-w-[90rem] items-center justify-between">
          <Link to={createPageUrl('Home')} className="transition-opacity hover:opacity-80" aria-label="Lekha Captions home">
            <CaptionStudioLogo size="default" showText={true} beta={true} />
          </Link>
          <div className="hidden items-center gap-7 sm:flex">
            <Link to={createPageUrl('Faq')} className="landing-nav-link text-sm transition-colors">FAQ</Link>
            <Link to={createPageUrl('HelpAndSupport')} className="landing-nav-link text-sm transition-colors">Help &amp; Support</Link>
            <Link to={createPageUrl('TermsAndConditions')} className="landing-nav-link text-sm transition-colors">Terms</Link>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Link to={`${createPageUrl('Dashboard')}?action=upload`} className="landing-button rounded-[4px] px-3.5 py-2 text-sm font-semibold">Open editor</Link>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <Link to={`${createPageUrl('Dashboard')}?action=upload`} className="landing-button rounded-[4px] px-3 py-2 text-xs font-semibold">Try free</Link>
          </div>
        </div>
      </nav>
      <main className="landing-story relative z-10">
        <HeroCinematic />
        <FeatureIndex />
        <UseCaseReel />
        <WorkflowPlayhead />
        <TemplateShowcase />
        <PricingSection />
        <FinalCtaKaraoke />
      </main>
      <div className="relative z-10"><Footer /></div>
    </div>
  )
}
