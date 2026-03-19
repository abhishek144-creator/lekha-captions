import React from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { Button } from '@/components/ui/button'
import { Play, Sparkles, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      {/* Decorative gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1B4D3E]/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#2ECC9A]/15 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#2ECC9A]/5 rounded-full blur-3xl" />

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(46,204,154,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(46,204,154,0.04)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2ECC9A]/10 border border-[#2ECC9A]/30 mb-8">
            <Sparkles className="w-4 h-4 text-[#2ECC9A]" />
            <span className="text-sm text-[#2ECC9A] font-medium">115+ Languages. Every language your audience speaks.</span>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
            Professional Captions in
            <span className="block bg-gradient-to-r from-[#2ECC9A] to-[#F5A623] bg-clip-text text-transparent">
              Your Language
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            The only caption platform built for regional and non-English languages. Tamil, Telugu, Bengali, Yoruba, Arabic, Tagalog, and 109+ more. Editor-grade captions at a fraction of the cost of English-first tools.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to={createPageUrl('Dashboard')}>
              <Button
                size="lg"
                className="bg-[#2ECC9A] hover:bg-[#27b889] text-[#0A3D2C] px-8 py-6 text-lg rounded-xl shadow-lg shadow-[#2ECC9A]/25 group font-semibold"
              >
                <Play className="w-5 h-5 mr-2" />
                Upload Video
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="bg-zinc-800 border border-white/10 text-white hover:bg-zinc-700 px-8 py-6 text-lg rounded-xl font-semibold"
              onClick={() => window.location.href = createPageUrl('Dashboard')}
            >
              Try for Free
            </Button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 mt-16 pt-8 border-t border-white/10">
            {[
              { value: '115+', label: 'Languages Supported' },
              { value: '25+', label: 'Caption Styles' },
              { value: '120–180s', label: 'Shorts & Reels Sweet Spot' },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl md:text-3xl font-bold text-[#2ECC9A]">{stat.value}</div>
                <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
