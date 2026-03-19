import React from 'react'
import { Captions } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="py-12 bg-[#1B4D3E] border-t border-[#2ECC9A]/20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#2ECC9A] flex items-center justify-center">
              <Captions className="w-4 h-4 text-[#0A3D2C]" />
            </div>
            <span className="text-white font-semibold">Lekha Captions</span>
          </div>

          <p className="text-[#2ECC9A]/80 text-sm">
            Built for every language, every creator 🌍
          </p>

          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} Lekha Captions
          </p>
        </div>
      </div>
    </footer>
  )
}
