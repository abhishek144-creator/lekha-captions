import React from 'react'
import { Captions } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="py-12 bg-[#F5A623]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
              <Captions className="w-4 h-4 text-[#F5A623]" />
            </div>
            <span className="text-black font-semibold">Lekha Captions</span>
          </div>

          <p className="text-black/80 text-sm font-medium">
            Built for every language, every creator 🌍
          </p>

          <p className="text-black/50 text-sm">
            © {new Date().getFullYear()} Lekha Captions
          </p>
        </div>
      </div>
    </footer>
  )
}
