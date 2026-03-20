import React from 'react'
import { motion } from 'framer-motion'
import {
  Wand2,
  Type,
  Palette,
  Globe,
  Languages,
  Download,
  Zap
} from 'lucide-react'

const features = [
  {
    icon: Wand2,
    title: 'AI-Powered Generation',
    description: 'Auto-transcribe and generate punchy captions that match speech rhythm perfectly.',
    gradient: 'from-[#0A0A0A] to-[#F5A623]'
  },
  {
    icon: Type,
    title: 'Professional Typography',
    description: 'Premium fonts, precise sizing, and spacing controls for that polished look.',
    gradient: 'from-[#F5A623] to-[#0A0A0A]'
  },
  {
    icon: Palette,
    title: 'Custom Styling',
    description: 'Full control over colors, highlights, backgrounds, and positioning.',
    gradient: 'from-[#F5A623] to-[#F5A623]'
  },
  {
    icon: Globe,
    title: 'Every Regional Language',
    description: '115+ languages including South Asian, African, Southeast Asian, Middle Eastern, and European regional languages. Powered by Sarvam AI for Indian languages and Whisper for global languages.',
    gradient: 'from-[#0A0A0A] to-[#F5A623]'
  },
  {
    icon: Languages,
    title: 'Multi-Language',
    description: 'Support for 115+ languages including Hindi, Tamil, Telugu, Marathi, Bengali & more.',
    gradient: 'from-[#F5A623] to-[#F5A623]'
  },
  {
    icon: Download,
    title: 'Easy Export',
    description: 'Download as SRT, plain text, or copy directly to your editor.',
    gradient: 'from-[#0A0A0A] to-[#F5A623]'
  },
  {
    icon: Zap,
    title: 'Built for Speed',
    description: 'Optimized for short-form. No bloat, no complexity.',
    gradient: 'from-[#F5A623] to-[#0A0A0A]'
  }
]

export default function FeaturesSection() {
  return (
    <section className="py-24 bg-[#111111] relative">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Everything You Need
          </h2>
          <p className="text-[#949494] max-w-xl mx-auto">
            Professional tools designed specifically for Indian short-form creators
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group p-6 rounded-2xl bg-[#1A1A1A] border border-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-white/5 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} p-0.5 mb-4`}>
                <div className="w-full h-full rounded-xl bg-[#1A1A1A] flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-[#F5A623]" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-[#949494] text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
