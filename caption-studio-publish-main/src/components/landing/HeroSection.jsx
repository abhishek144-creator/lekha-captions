import React from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import { Button } from '@/components/ui/button'
import { Play, Sparkles, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-[#111111]">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Top band — Badge + Heading */}
          <div className="pb-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/15 mb-8">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">115+ Languages. Built for every global audience.</span>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-3">
              Professional Captions in
              <span className="block bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 45%, #B38728 70%, #AA771C 100%)' }}>
                Your Language
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-[#949494] max-w-2xl mx-auto mt-10">
              115+ languages. Indic, African, Arab, Southeast Asian, European, and English. Professional captions at creator-friendly pricing.
            </p>
          </div>

          {/* Middle band — CTAs, slightly separated */}
          <div className="py-8 border-t border-white/[0.06]">
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to={createPageUrl('Dashboard')}>
                <Button
                  size="lg"
                  className="bg-white hover:bg-gray-100 text-black px-8 py-6 text-lg rounded-[4px] font-semibold group"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Upload Video
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="bg-transparent border border-white text-white hover:bg-white/10 px-8 py-6 text-lg rounded-[4px] font-semibold"
                onClick={() => window.location.href = createPageUrl('Dashboard')}
              >
                Try for Free
              </Button>
            </div>
          </div>

          {/* Bottom band — Stats, darker bg strip */}
          <div className="py-8 border-t border-white/[0.06] bg-[#0D0D0D]/60 rounded-xl">
            <div className="flex flex-wrap justify-center gap-8">
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
                  <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-[#949494] mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
