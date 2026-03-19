import React from 'react'
import { Captions } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="py-12 bg-[#0A0A0A] border-t border-[#F5A623]/20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F5A623] flex items-center justify-center">
              <Captions className="w-4 h-4 text-[#000000]" />
            </div>
            <span className="text-white font-semibold">Lekha Captions</span>
          </div>

          <p className="text-[#F5A623]/80 text-sm">
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
