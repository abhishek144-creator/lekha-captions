import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { createPageUrl } from '@/utils'
import CaptionStudioLogo from '@/components/dashboard/CaptionStudioLogo'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'What is Lekha Captions?',
    a: 'Lekha Captions is an AI-powered caption tool that auto-transcribes your videos and lets you style, edit, and burn professional captions in 115+ languages.',
  },
  {
    q: 'Which languages are supported?',
    a: 'We support 115+ languages including Hindi, Tamil, Telugu, Marathi, Bengali, Kannada, Malayalam, Punjabi, Arabic, French, Spanish, German, Japanese, Korean, and many more. Indic languages are powered by Sarvam AI; global languages use OpenAI Whisper.',
  },
  {
    q: 'How many video credits do I get?',
    a: 'Starter plan: 15 credits/month. Creator plan: 45 credits/month. Pro plan: 100 credits/month. Each processed video consumes one credit.',
  },
  {
    q: 'What video length is supported?',
    a: 'Starter: up to 2 minutes. Creator & Pro: up to 3 minutes per video. We are optimized for short-form content (Reels, Shorts, TikTok).',
  },
  {
    q: 'Can I edit captions after they are generated?',
    a: 'Yes. You can click any word in the caption timeline to edit text, change timing, split or merge captions, and apply per-word styling.',
  },
  {
    q: 'Does the exported video have a watermark?',
    a: 'No watermark on any paid plan. Free plan videos may include a subtle Lekha branding.',
  },
  {
    q: 'How long is the download link valid?',
    a: 'Starter: 2 hours. Creator: 24 hours. Pro: 72 hours. Download your video promptly after export.',
  },
  {
    q: 'Can I customize the caption style?',
    a: 'Yes — font, size, color, background, stroke, shadow, animations, and 26+ pre-built templates are available in the Style tab.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. The free plan gives you 3 video credits to try the product. No credit card required.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'You can manage or cancel your subscription at any time from the Account page. Credits remain usable until the end of the billing period.',
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`border border-white/10 rounded-xl overflow-hidden transition-colors ${open ? 'bg-white/5' : 'bg-white/[0.02] hover:bg-white/[0.04]'}`}
    >
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-sm font-medium text-white">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">{a}</div>
      )}
    </div>
  )
}

export default function Faq() {
  return (
    <div className="min-h-screen bg-[#111111]">
      <nav className="sticky top-0 z-50 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-white/5 h-14 flex items-center justify-between px-6">
        <Link to={createPageUrl('Home')} className="hover:opacity-80 transition-opacity">
          <CaptionStudioLogo size="default" showText={true} />
        </Link>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap justify-end">
          <Link to={createPageUrl('Faq')} className="text-sm text-white font-medium">FAQ</Link>
          <Link to={createPageUrl('Help')} className="text-sm text-gray-400 hover:text-white transition-colors">Help</Link>
          <Link to={createPageUrl('Terms')} className="text-sm text-gray-400 hover:text-white transition-colors">Terms</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 md:py-16">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Frequently Asked Questions</h1>
        <p className="text-gray-500 mb-10">Everything you need to know about Lekha Captions.</p>
        <div className="space-y-3">
          {faqs.map((item, i) => <FaqItem key={i} {...item} />)}
        </div>
        <p className="mt-10 text-sm text-gray-500">
          Still have questions?{' '}
          <Link to={createPageUrl('Help')} className="text-[#F5A623] hover:underline">Contact support</Link>
        </p>
      </div>
    </div>
  )
}
