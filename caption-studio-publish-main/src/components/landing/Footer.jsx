import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

export default function Footer() {
  return (
    <footer className="landing-section-footer bg-transparent py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="grid gap-12 border-t border-white/[0.08] pt-12 md:grid-cols-[1.3fr_0.7fr_0.7fr]">
          <div>
            <div className="flex items-center gap-3">
              <CaptionStudioLogo size="default" showText={false} />
              <span className="text-2xl font-semibold tracking-[-0.04em] text-white">Lekha Captions</span>
            </div>
            <p className="landing-footer-tagline mt-5 max-w-sm text-2xl leading-10 text-white">Professional captions for every language.</p>
          </div>

          <div>
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.34em] text-white/70">Product</p>
            <div className="mt-6 space-y-3.5 text-xl text-white/86">
              <Link to={createPageUrl('Home')} className="block transition hover:text-white">Features</Link>
              <Link to={createPageUrl('Home')} className="block transition hover:text-white">Pricing</Link>
              <Link to={createPageUrl('Home')} className="block transition hover:text-white">Templates</Link>
              <Link to={createPageUrl('Home')} className="block transition hover:text-white">Languages</Link>
            </div>
          </div>

          <div>
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.34em] text-white/70">Support</p>
            <div className="mt-6 space-y-3.5 text-xl text-white/86">
              <Link to={createPageUrl('Faq')} className="block transition hover:text-white">FAQ</Link>
              <Link to={createPageUrl('HelpAndSupport')} className="block transition hover:text-white">Help</Link>
              <Link to={createPageUrl('TermsAndConditions')} className="block transition hover:text-white">Terms</Link>
              <Link to={createPageUrl('PrivacyPolicy')} className="block transition hover:text-white">Privacy</Link>
              <Link to={createPageUrl('RefundPolicy')} className="block transition hover:text-white">Refunds</Link>
              <Link to={createPageUrl('AcceptableUsePolicy')} className="block transition hover:text-white">Acceptable Use</Link>
              <Link to={createPageUrl('KnownLimitations')} className="block transition hover:text-white">Known limitations</Link>
              <Link to={createPageUrl('Changelog')} className="block transition hover:text-white">Changelog</Link>
              <Link to={createPageUrl('HelpAndSupport')} className="block transition hover:text-white">Contact</Link>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/[0.08] pt-6 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Lekha Captions. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span>Creator-friendly captions for audiences everywhere</span>
            <span className="inline-flex gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2c9f6f]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#365ed6]" />
            </span>
          </p>
        </div>
      </div>
    </footer>
  )
}
