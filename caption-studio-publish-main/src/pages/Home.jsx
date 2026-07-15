import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import HeroSection from '@/components/landing/HeroSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import UseCasesSection from '@/components/landing/UseCasesSection'
import WorkflowSection from '@/components/landing/WorkflowSection'
import TemplateShowcase from '@/components/landing/TemplateShowcase'
import LanguageReachSection from '@/components/landing/LanguageReachSection'
import PricingSection from '@/components/landing/PricingSection'
import FinalCtaSection from '@/components/landing/FinalCtaSection'
import Footer from '@/components/landing/Footer'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070706] text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_-12%,rgba(245,166,35,0.21),transparent_34%),radial-gradient(circle_at_105%_28%,rgba(98,50,180,0.13),transparent_28%),radial-gradient(circle_at_-8%_58%,rgba(26,126,136,0.09),transparent_25%),linear-gradient(180deg,#070706_0%,#0c0a08_38%,#070707_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_94%)]" />
        <div className="absolute inset-y-0 left-[7%] w-px bg-gradient-to-b from-transparent via-white/[0.05] to-transparent" />
        <div className="absolute inset-y-0 right-[7%] w-px bg-gradient-to-b from-transparent via-white/[0.05] to-transparent" />
      </div>
      <nav className="sticky top-0 z-50 h-16 border-b border-white/[0.07] bg-[#080807]/70 px-5 shadow-[0_10px_50px_rgba(0,0,0,0.18)] backdrop-blur-2xl md:px-8">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
          <Link to={createPageUrl('Home')} className="transition-opacity hover:opacity-80" aria-label="Lekha Captions home">
            <CaptionStudioLogo size="default" showText={true} />
          </Link>
          <div className="hidden items-center gap-7 sm:flex">
            <Link to={createPageUrl('Faq')} className="text-sm text-[#949494] transition-colors hover:text-white">FAQ</Link>
            <Link to={createPageUrl('HelpAndSupport')} className="text-sm text-[#949494] transition-colors hover:text-white">Help &amp; Support</Link>
            <Link to={createPageUrl('TermsAndConditions')} className="text-sm text-[#949494] transition-colors hover:text-white">Terms</Link>
            <Link to={createPageUrl('Dashboard')} className="rounded-[4px] border border-white/15 px-3.5 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/5">Open editor</Link>
          </div>
          <Link to={createPageUrl('Dashboard')} className="rounded-[4px] bg-white px-3 py-2 text-xs font-semibold text-black sm:hidden">Try free</Link>
        </div>
      </nav>
      <main className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <UseCasesSection />
        <WorkflowSection />
        <TemplateShowcase />
        <LanguageReachSection />
        <PricingSection />
        <FinalCtaSection />
      </main>
      <div className="relative z-10"><Footer /></div>
    </div>
  )
}
