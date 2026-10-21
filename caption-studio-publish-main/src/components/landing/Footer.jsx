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
            <nav aria-label="Product links" className="mt-6 text-xl text-white/86">
              <ul className="space-y-3.5">
                {['Features', 'Pricing', 'Templates', 'Languages'].map(label => <li key={label}><Link to={createPageUrl('Home')} className="block transition hover:text-white">{label}</Link></li>)}
              </ul>
            </nav>
          </div>

          <div>
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.34em] text-white/70">Support</p>
            <nav aria-label="Support links" className="mt-6 text-xl text-white/86">
              <ul className="space-y-3.5">
                {[
                  ['FAQ', createPageUrl('Faq')], ['Help', createPageUrl('HelpAndSupport')], ['Terms', createPageUrl('TermsAndConditions')],
                  ['Privacy', createPageUrl('PrivacyPolicy')], ['Refunds', createPageUrl('RefundPolicy')], ['Acceptable Use', createPageUrl('AcceptableUsePolicy')],
                  ['Known limitations', createPageUrl('KnownLimitations')], ['Changelog', createPageUrl('Changelog')],
                  ['Service status', createPageUrl('Status')], ['Contact', createPageUrl('HelpAndSupport')],
                ].map(([label, to]) => (
                  <li key={label}><Link to={to} className="block transition hover:text-white">{label}</Link></li>
                ))}
              </ul>
            </nav>
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
