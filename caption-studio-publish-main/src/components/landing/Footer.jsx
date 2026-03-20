import React from 'react'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'

export default function Footer() {
  return (
    <footer className="py-12 bg-[#111111] border-t border-[#1A1A1A]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <CaptionStudioLogo size="default" showText={true} />
          </div>

          <p className="text-[#949494] text-sm font-medium">
            Built for every language, every creator 🌍
          </p>

          <p className="text-[#949494]/70 text-sm">
            © {new Date().getFullYear()} Lekha Captions
          </p>
        </div>
      </div>
    </footer>
  )
}
