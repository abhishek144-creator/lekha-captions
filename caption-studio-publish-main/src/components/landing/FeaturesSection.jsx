import React from 'react';
import { motion } from 'framer-motion';
import { 
  Wand2, 
  Type, 
  Palette, 
  Languages, 
  Download, 
  Zap 
} from 'lucide-react';

const features = [
  {
    icon: Wand2,
    title: 'AI-Powered Generation',
    description: 'Auto-transcribe and generate punchy captions that match speech rhythm perfectly.',
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    icon: Type,
    title: 'Professional Typography',
    description: 'Premium fonts, precise sizing, and spacing controls for that polished look.',
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    icon: Palette,
    title: 'Custom Styling',
    description: 'Full control over colors, highlights, backgrounds, and positioning.',
    gradient: 'from-orange-500 to-red-500'
  },
  {
    icon: Languages,
    title: 'Multi-Language',
    description: 'Support for 20+ Indian languages including Hindi, Tamil, Telugu, Marathi, Bengali & more.',
    gradient: 'from-green-500 to-emerald-500'
  },
  {
    icon: Download,
    title: 'Easy Export',
    description: 'Download as SRT, plain text, or copy directly to your editor.',
    gradient: 'from-violet-500 to-purple-500'
  },
  {
    icon: Zap,
    title: 'Built for Speed',
    description: 'Optimized for short-form. No bloat, no complexity.',
    gradient: 'from-yellow-500 to-orange-500'
  }
];

export default function FeaturesSection() {
  return (
    <section className="py-24 bg-[#0a0a0a] relative">
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
          <p className="text-gray-400 max-w-xl mx-auto">
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
              className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} p-0.5 mb-4`}>
                <div className="w-full h-full rounded-xl bg-[#0a0a0a] flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}