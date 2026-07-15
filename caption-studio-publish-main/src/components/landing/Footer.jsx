import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-black/20 py-12 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div>
            <CaptionStudioLogo size="default" showText={true} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#949494]">Professional captions in 115+ languages. Built for every creator.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-8 text-sm">
            <div><p className="mb-3 font-medium text-white">Product</p><div className="space-y-2.5 text-[#949494]"><Link to={createPageUrl('Home')} className="block transition hover:text-white">Home</Link><Link to={createPageUrl('Dashboard')} className="block transition hover:text-white">Editor</Link></div></div>
            <div><p className="mb-3 font-medium text-white">Support</p><div className="space-y-2.5 text-[#949494]"><Link to={createPageUrl('Faq')} className="block transition hover:text-white">FAQ</Link><Link to={createPageUrl('HelpAndSupport')} className="block transition hover:text-white">Help &amp; Support</Link><Link to={createPageUrl('TermsAndConditions')} className="block transition hover:text-white">Terms &amp; Conditions</Link><Link to={createPageUrl('PrivacyPolicy')} className="block transition hover:text-white">Privacy Policy</Link></div></div>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/[0.07] pt-6 text-xs text-[#949494] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Lekha Captions. All rights reserved.</p>
          <p>Built for every language, every creator 🌍</p>
        </div>
      </div>
    </footer>
  )
}
