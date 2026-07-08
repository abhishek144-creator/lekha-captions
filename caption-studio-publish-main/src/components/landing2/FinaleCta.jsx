import React from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

export default function FinaleCta() {
  return (
    <>
      <section aria-label="Get started" className="relative bg-[#0D0D0D] py-32 overflow-hidden">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-[#F5A623]/[0.07] blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="lv2-display text-[clamp(2.6rem,7vw,5.5rem)] leading-[1.05] text-white">
              कहो एक बार।
              <span className="block italic lv2-gold-text pb-2">Caption it everywhere.</span>
            </h2>
            <p className="mt-6 text-[#949494] max-w-lg mx-auto">
              Your first captions are minutes away. Upload a video and watch every word land — in any of 115+ languages.
            </p>
            <div className="mt-10 flex justify-center">
              <Link
                to={createPageUrl('Dashboard')}
                className="group inline-flex items-center gap-2 rounded-full lv2-gold-bg text-black font-semibold px-10 py-5 text-lg hover:brightness-110 transition-all"
              >
                Upload your first video
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <p className="mt-6 font-mono text-[11px] tracking-[0.25em] text-[#949494]/70">
              FREE TO TRY · NO WATERMARK
            </p>
          </motion.div>
        </div>
      </section>

      <footer className="bg-[#0B0B0C] border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
            <div className="flex flex-col gap-3">
              <CaptionStudioLogo size="default" showText={true} />
              <p className="text-[#949494] text-sm max-w-xs">
                Professional captions in 115+ languages. Built for every creator.
              </p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] tracking-[0.2em] text-[#949494]">
              <Link to="/" className="hover:text-white transition-colors">HOME</Link>
              <Link to="/Dashboard" className="hover:text-white transition-colors">EDITOR</Link>
              <Link to="/Faq" className="hover:text-white transition-colors">FAQ</Link>
              <Link to="/HelpAndSupport" className="hover:text-white transition-colors">HELP &amp; SUPPORT</Link>
              <Link to="/TermsAndConditions" className="hover:text-white transition-colors">TERMS</Link>
            </nav>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-[#949494]/60 text-sm">© {new Date().getFullYear()} Lekha Captions. All rights reserved.</p>
            <p className="text-[#949494] text-sm">Built for every language, every creator 🌍</p>
          </div>
        </div>
      </footer>
    </>
  )
}
