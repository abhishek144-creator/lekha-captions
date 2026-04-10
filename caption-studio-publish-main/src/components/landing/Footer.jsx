import React from 'react'
import { Link } from 'react-router-dom'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

export default function Footer() {
  return (
    <footer className="py-12 bg-[#111111] border-t border-[#1A1A1A]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <CaptionStudioLogo size="default" showText={true} />
            <p className="text-[#949494] text-sm max-w-xs">
              Professional captions in 115+ languages. Built for every creator.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-16">
            <div>
              <p className="text-white text-sm font-semibold mb-3">Product</p>
              <ul className="space-y-2 text-sm text-[#949494]">
                <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
                <li><Link to="/Dashboard" className="hover:text-white transition-colors">Editor</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-white text-sm font-semibold mb-3">Help</p>
              <ul className="space-y-2 text-sm text-[#949494]">
                <li><Link to="/Faq" className="hover:text-white transition-colors">FAQ</Link></li>
                <li><Link to="/HelpAndSupport" className="hover:text-white transition-colors">Help &amp; Support</Link></li>
                <li><Link to="/TermsAndConditions" className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-[#1A1A1A] pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-[#949494]/70 text-sm">© {new Date().getFullYear()} Lekha Captions. All rights reserved.</p>
          <p className="text-[#949494] text-sm">Built for every language, every creator 🌍</p>
        </div>
      </div>
    </footer>
  )
}

